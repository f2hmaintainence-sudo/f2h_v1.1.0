import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const path = request.path;

    // Bypass throttling in development environment to avoid "Too Many Requests" errors
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }

    // Bypass throttling if request is from the same origin (e.g. frontend app)
    const origin = request.headers.origin;
    const referer = request.headers.referer;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (
      (origin && frontendUrl.includes(origin)) ||
      (referer && referer.startsWith(frontendUrl)) ||
      (origin && origin.includes('localhost'))
    ) {
      console.log(
        `[CustomThrottlerGuard] Skipping throttle for same origin: ${origin || referer}`,
      );
      return true;
    }

    console.log(`[CustomThrottlerGuard] Request path: ${path}`);
    if (path === '/profile' || path.startsWith('/profile') || path.includes('/location/update')) {
      console.log(`[CustomThrottlerGuard] Skipping throttle for ${path}`);
      return true;
    }
    return super.canActivate(context);
  }
}
