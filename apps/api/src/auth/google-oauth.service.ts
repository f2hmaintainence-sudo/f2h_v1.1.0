import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';

/**
 * The identity Google vouched for. Every field here comes from a signature-
 * verified token — never from the request body.
 */
export interface VerifiedGoogleIdentity {
  /** Google's stable account identifier (`sub`). */
  googleId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

/**
 * Verifies Google Sign-In credentials coming from the mobile and web clients.
 *
 * Clients send whichever credential their platform can produce:
 *   - `id_token`  — Android/iOS, where `serverClientId` is configured.
 *   - `code`      — Web, where the GIS code client is the only flow that
 *                   yields something the server can verify. Exchanged here
 *                   using the client secret, which never leaves the server.
 *
 * Neither is trusted until Google has signed off on it.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(private readonly configService: ConfigService) {}

  private get webClientId(): string {
    return this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
  }

  private get clientSecret(): string {
    return this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
  }

  /**
   * Every client id that may legitimately appear as the `aud` of an id_token.
   * Android and iOS mint tokens for the *web* client id when the app sets
   * `serverClientId`, so that one covers the common case; the platform ids are
   * accepted too when they are configured.
   *
   * The platform variables are comma-separated because F2H ships two Android
   * and two iOS apps (customer and delivery), each with its own OAuth client.
   */
  private get allowedAudiences(): string[] {
    const raw = [
      this.webClientId,
      this.configService.get<string>('GOOGLE_ANDROID_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_IOS_CLIENT_ID'),
    ];
    const ids = raw
      .flatMap((value) => (value ?? '').split(','))
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    return [...new Set(ids)];
  }

  get isConfigured(): boolean {
    return Boolean(this.webClientId);
  }

  /**
   * Resolves a client-supplied credential to a verified Google identity.
   *
   * @throws UnauthorizedException when the credential is missing, malformed,
   *         issued for another application, or tied to an unverified email.
   */
  async verify(credential: {
    idToken?: string;
    code?: string;
  }): Promise<VerifiedGoogleIdentity> {
    if (!this.isConfigured) {
      this.logger.error(
        'GOOGLE_CLIENT_ID is not set — refusing Google Sign-In',
      );
      throw new UnauthorizedException(
        'Google Sign-In is not configured on this server',
      );
    }

    const idToken = credential.idToken?.trim()
      ? credential.idToken.trim()
      : await this.exchangeCodeForIdToken(credential.code?.trim());

    if (!idToken) {
      throw new UnauthorizedException(
        'Google Sign-In requires an id_token or an authorization code',
      );
    }

    return this.toIdentity(await this.verifyIdToken(idToken));
  }

  /**
   * Exchanges an authorization code for Google's id_token.
   *
   * The redirect URI depends on where the code came from: the browser GIS code
   * client requires the literal `postmessage`, while the Android/iOS plugins
   * issue codes bound to no redirect at all. Both are attempted.
   */
  private async exchangeCodeForIdToken(
    code?: string,
  ): Promise<string | undefined> {
    if (!code) return undefined;

    if (!this.clientSecret) {
      this.logger.error(
        'GOOGLE_CLIENT_SECRET is not set — cannot exchange an authorization code',
      );
      throw new UnauthorizedException(
        'Google Sign-In is not configured on this server',
      );
    }

    const redirectUris = [
      'postmessage',
      this.configService.get<string>('GOOGLE_REDIRECT_URI') || '',
    ].filter((uri, index, all) => uri !== '' && all.indexOf(uri) === index);

    let lastError: unknown;
    for (const redirectUri of redirectUris) {
      try {
        const client = new OAuth2Client(
          this.webClientId,
          this.clientSecret,
          redirectUri,
        );
        const { tokens } = await client.getToken(code);
        if (tokens.id_token) return tokens.id_token;
        lastError = new Error(
          'Google returned no id_token for the authorization code',
        );
      } catch (error) {
        lastError = error;
      }
    }

    this.logger.warn(
      `Google authorization code exchange failed: ${String(lastError)}`,
    );
    throw new UnauthorizedException(
      'Could not verify the Google authorization code',
    );
  }

  private async verifyIdToken(idToken: string): Promise<TokenPayload> {
    try {
      const ticket = await new OAuth2Client().verifyIdToken({
        idToken,
        audience: this.allowedAudiences,
      });
      const payload = ticket.getPayload();
      if (!payload) throw new Error('Google id_token carried no payload');
      return payload;
    } catch (error) {
      this.logger.warn(`Google id_token verification failed: ${String(error)}`);
      throw new UnauthorizedException(
        'Could not verify the Google sign-in token',
      );
    }
  }

  private toIdentity(payload: TokenPayload): VerifiedGoogleIdentity {
    const email = payload.email?.toLowerCase().trim();

    if (!email) {
      throw new UnauthorizedException(
        'Google did not return an email for this account',
      );
    }
    // An unverified Google email can be attacker-chosen, so it must never be
    // allowed to match an existing F2H account. Google sets this claim on every
    // id_token it issues, so a missing value is treated as unverified.
    if (!payload.email_verified) {
      throw new UnauthorizedException(
        'Please verify your email with Google before signing in',
      );
    }
    if (!payload.sub) {
      throw new UnauthorizedException(
        'Google did not return an account identifier',
      );
    }

    return {
      googleId: payload.sub,
      email,
      emailVerified: true,
      name: payload.name,
      picture: payload.picture,
    };
  }
}
