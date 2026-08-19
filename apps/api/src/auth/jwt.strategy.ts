import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { TokenRevocationService } from './token-revocation.service';
import { ConfigService } from '@nestjs/config';
import {
  RedisService,
  CACHE_KEYS,
  CACHE_TTL,
} from 'src/shared/redis/redis.service';
import { DataService } from 'src/shared/database/Data.service';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    protected readonly tokenRevocationService: TokenRevocationService,
    protected readonly configService: ConfigService,
    protected readonly redisService: RedisService,
    protected readonly Data: DataService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.access_token;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      // Expiry is enforced. Ignoring it made every issued token permanent, since
      // nothing else in the request path checks `exp`.
      ignoreExpiration: false,
      secretOrKey: (() => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret)
          throw new Error(
            'CRITICAL: JWT_SECRET environment variable is not set',
          );
        return secret;
      })(),
    });
  }

  async findUser(userId: string, email: string) {
    return userId
      ? await this.authService.findUserById(userId)
      : await this.authService.findUserByEmail(email);
  }

  async validate(payload: any) {
    const userId = payload?.sub || payload?.user_id;
    const email = payload?.email;
    const jti = payload?.jti;
    const tokenType = payload?.type;
    const deviceId = payload?.device_id;

    if (!userId && !email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Check if token has been revoked using paired sessions structure
    if (jti && userId) {
      const userPrefix = `f2h_user_jwt_${userId}`;
      const sessionData = await this.redisService.fetch(userPrefix);

      if (!sessionData) {
        throw new UnauthorizedException('Token has been revoked (user logged out)');
      }

      try {
        const parsed =
          typeof sessionData === 'string'
            ? JSON.parse(sessionData)
            : sessionData;

        const sessions = parsed.sessions || [];
        const matchedSession = sessions.find(
          (session: any) =>
            (session.accessJti !== null && session.accessJti === jti) ||
            session.refreshJti === jti,
        );

        if (!matchedSession) {
          throw new UnauthorizedException('Token has been revoked');
        }

      } catch (parseError) {
        console.error('[JwtStrategy] Failed to parse session data:', parseError);
        throw new UnauthorizedException('Invalid token state');
      }
    }

    if (jti && (await this.tokenRevocationService.isRevoked(jti))) {
      throw new UnauthorizedException('Token has been revoked (legacy check)');
    }

    const user = await this.findUser(userId, email);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (userId && deviceId) {
      try {
        const result = await this.Data.query('user_devices', {
          select: ['id', 'is_active', 'revoked_at'],
          where: [
            { column: 'user_id', operator: '=', value: userId },
            { column: 'device_id', operator: '=', value: deviceId },
          ],
          limit: 1,
        });
        const row = result?.data?.[0];
        const hasRow = !!row;
        const isActive =
          row?.is_active === 1 ||
          row?.is_active === true ||
          row?.is_active === '1' ||
          row?.is_active === 'true';

        if (hasRow && (!isActive || row?.revoked_at)) {
          throw new UnauthorizedException('Device session revoked');
        }
      } catch (e) {
        if (e instanceof UnauthorizedException) {
          throw e;
        }
        console.warn(
          '[JwtStrategy] Device check skipped due to query error:',
          (e as Error)?.message || e,
        );
      }
    }

    // `role` is what the token claimed at login. It is exposed for logging and for
    // handlers that want a hint, but authorization decisions go through RolesGuard,
    // which re-reads role_assignments — a claim cannot outlive a revoked grant.
    return {
      user_id: user.user_id,
      email: user.email,
      jti: jti,
      type: tokenType,
      device_id: deviceId || null,
      role: (payload?.role ?? user.role_id ?? null) || null,
    };
  }
}
