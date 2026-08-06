import { Injectable } from '@nestjs/common';
import { AuthService as SharedAuthService } from 'src/auth/auth.service';

@Injectable()
export class AuthService extends SharedAuthService {}
