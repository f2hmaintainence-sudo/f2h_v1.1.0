import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf.constants';

describe('CsrfGuard', () => {
  const guard = new CsrfGuard();

  const contextFor = (request: any): ExecutionContext =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  const cookieRequest = (method: string, cookieToken?: string, headerToken?: string) => ({
    method,
    cookies: { access_token: 'a.jwt.value', ...(cookieToken ? { [CSRF_COOKIE_NAME]: cookieToken } : {}) },
    headers: headerToken ? { [CSRF_HEADER_NAME]: headerToken } : {},
  });

  it('allows safe methods', () => {
    expect(guard.canActivate(contextFor(cookieRequest('GET')))).toBe(true);
  });

  it('allows requests that do not authenticate through a cookie', () => {
    // The Flutter apps send a Bearer header; a browser never attaches that
    // cross-origin, so there is no CSRF surface to protect.
    expect(
      guard.canActivate(
        contextFor({ method: 'POST', cookies: {}, headers: { authorization: 'Bearer x' } }),
      ),
    ).toBe(true);
  });

  it('rejects a cookie-authenticated mutation with no CSRF header', () => {
    expect(() => guard.canActivate(contextFor(cookieRequest('POST', 'abc')))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a mismatched token', () => {
    expect(() =>
      guard.canActivate(contextFor(cookieRequest('POST', 'abc', 'def'))),
    ).toThrow(ForbiddenException);
  });

  it('rejects tokens that differ only in length', () => {
    expect(() =>
      guard.canActivate(contextFor(cookieRequest('DELETE', 'abcdef', 'abc'))),
    ).toThrow(ForbiddenException);
  });

  it('accepts a matching double-submit token', () => {
    expect(guard.canActivate(contextFor(cookieRequest('POST', 'abc123', 'abc123')))).toBe(
      true,
    );
  });
});
