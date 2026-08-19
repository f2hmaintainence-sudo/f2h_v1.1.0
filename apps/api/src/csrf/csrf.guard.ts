import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf.constants';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF check.
 *
 * Only requests that authenticate through the `access_token` *cookie* are at risk:
 * those carry ambient credentials a third-party site can trigger. The Flutter apps
 * send a Bearer header, which a browser never attaches cross-origin, so they have
 * no CSRF surface and are not required to carry a token.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest();

    if (SAFE_METHODS.has(request.method)) return true;

    const usesCookieAuth = Boolean(request.cookies?.access_token);
    if (!usesCookieAuth) return true;

    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = request.headers?.[CSRF_HEADER_NAME];

    if (!cookieToken || !headerToken || Array.isArray(headerToken)) {
      throw new ForbiddenException('Missing CSRF token');
    }

    if (!this.matches(String(cookieToken), String(headerToken))) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }

  private matches(cookieToken: string, headerToken: string): boolean {
    const a = Buffer.from(cookieToken);
    const b = Buffer.from(headerToken);
    // timingSafeEqual throws on a length mismatch, so compare lengths first.
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
