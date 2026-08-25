import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();

    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // Skip JWT validation for public routes
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      // `info` carries the reason (TokenExpiredError, JsonWebTokenError, No auth
      // token). Dropping it made every 401 look identical in the logs.
      const req = context.switchToHttp().getRequest();
      const reason = info?.message || err?.message || 'no user resolved';
      console.error(
        `[JwtAuthGuard] ❌ Authentication failed on ${req?.method} ${req?.originalUrl || req?.url}: ${reason}`,
      );
      throw new UnauthorizedException('Invalid or expired token');
    }

    return user;
  }
}
