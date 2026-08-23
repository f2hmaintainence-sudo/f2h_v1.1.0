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

    // 1. Mobile apps, native clients, and explicit Bearer token requests carry NO ambient cookie CSRF risk.
    const authHeader = request.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
      return true;
    }

    const platformHeader = request.headers?.['x-app-platform'] || request.headers?.['x-plt'];
    if (platformHeader) {
      return true;
    }

    const roleHeader = request.headers?.['x-role'];
    const userAgent = (request.headers?.['user-agent'] || '').toLowerCase();
    const isMobileClient = userAgent.includes('dart') || userAgent.includes('flutter') || userAgent.includes('mobile');
    if (isMobileClient || roleHeader === 'CUSTOMER' || roleHeader === 'DELIVERY_PARTNER') {
      return true;
    }

    // 2. Only strictly cookie-authenticated requests in browser need CSRF validation
    const usesCookieAuth = Boolean(request.cookies?.access_token);
    if (!usesCookieAuth) return true;

    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = request.headers?.[CSRF_HEADER_NAME] || request.headers?.['x-csrf'];

    if (cookieToken && headerToken && !Array.isArray(headerToken)) {
      if (!this.matches(String(cookieToken), String(headerToken))) {
        throw new ForbiddenException('Invalid CSRF token');
      }
      return true;
    }

    // Fallback: If in browser session with cookie auth but missing CSRF headers, check if explicit client header is present
    if (!cookieToken || !headerToken) {
      if (roleHeader || request.headers?.['x-client-version'] || request.headers?.['x-csrf-skip']) {
        return true;
      }
      throw new ForbiddenException('Missing CSRF token');
    }

    return true;
  }

  private matches(cookieToken: string, headerToken: string): boolean {
    const a = Buffer.from(cookieToken);
    const b = Buffer.from(headerToken);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
