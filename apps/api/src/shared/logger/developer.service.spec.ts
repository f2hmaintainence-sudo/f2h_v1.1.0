import { ConfigService } from '@nestjs/config';
import { DeveloperService } from './Developer.service';

/**
 * Guards the redaction layer added after the login handler was found logging whole
 * request bodies — passwords included — into PM2 log files.
 */
describe('DeveloperService redaction', () => {
  const written: any[] = [];

  const service = new DeveloperService({
    get: (key: string) => {
      if (key === 'LOG_FILE') return '/tmp/f2h-developer-service-spec.log';
      if (key === 'LOG_LEVELS') return 'error,warning,info,debug';
      return undefined;
    },
  } as unknown as ConfigService);

  beforeEach(() => {
    written.length = 0;
    // Capture what would reach the transport.
    (service as any).logger = { log: (entry: any) => written.push(entry) };
  });

  it('redacts credential-bearing keys in the context', () => {
    service.log('info', 'login attempt', {
      identifier: 'user@example.com',
      password: 'hunter2',
      otp: '123456',
    });

    expect(written[0].context.password).toBe('[REDACTED]');
    expect(written[0].context.otp).toBe('[REDACTED]');
    // Non-sensitive fields survive so the log is still useful.
    expect(written[0].context.identifier).toBe('user@example.com');
  });

  it('redacts nested values, not just top-level keys', () => {
    service.log('error', 'request failed', {
      request: { headers: { authorization: 'Bearer abc' }, body: { password: 'x' } },
    });

    expect(written[0].context.request.headers.authorization).toBe('[REDACTED]');
    expect(written[0].context.request.body.password).toBe('[REDACTED]');
  });

  it('redacts SQL bindings, which are real row values', () => {
    service.log('error', 'query failed', { table: 'users', bindings: ['$2b$10$hash'] });

    expect(written[0].context.bindings).toBe('[REDACTED]');
    expect(written[0].context.table).toBe('users');
  });

  it('is case-insensitive about key names', () => {
    service.log('info', 'x', { Password: 'p', ACCESS_TOKEN: 't' });

    expect(written[0].context.Password).toBe('[REDACTED]');
    expect(written[0].context.ACCESS_TOKEN).toBe('[REDACTED]');
  });

  it('survives circular structures instead of throwing', () => {
    const cyclic: any = { name: 'node' };
    cyclic.self = cyclic;

    expect(() => service.log('info', 'cyclic', { cyclic })).not.toThrow();
    expect(written[0].context.cyclic.self).toBe('[Circular]');
  });
});
