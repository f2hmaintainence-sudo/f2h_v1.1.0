import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy as GoogleStrategyBase } from 'passport-google-oauth20';

/*===============================================================================================
  OAuth Google
================================================================================================*/
@Injectable()
export class GoogleStrategy extends PassportStrategy(
  GoogleStrategyBase,
  'google',
) {
  constructor(private configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID') || 'dummy-google-client-id';
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET') || 'dummy-google-client-secret';

    super({
      clientID,
      clientSecret,
      callbackURL:
        configService.get<string>('GOOGLE_REDIRECT_URI') ||
        'http://localhost:4000/auth/google/callback',
      scope: ['email', 'profile'],
      tokenURL: 'https://oauth2.googleapis.com/token',
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: Function,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    const user = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos[0].value,
      accessToken,
    };
    done(null, user);
  }
}
