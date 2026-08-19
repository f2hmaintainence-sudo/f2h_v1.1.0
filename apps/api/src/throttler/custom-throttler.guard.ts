import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limiting keyed by identity rather than by origin.
 *
 * The previous implementation skipped throttling whenever the request carried an
 * `Origin` header pointing at localhost or the configured frontend. `Origin` is set
 * by the client, so that disabled rate limiting on every route — including
 * `/auth/login` — for anyone who chose to send it. There is no bypass now: routes
 * that genuinely need a higher ceiling declare it with `@Throttle()`, and the dev
 * ergonomics come from raising the limits in config, not from short-circuiting.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Authenticated callers share a bucket per user so a single account cannot
    // multiply its allowance by rotating IPs; anonymous callers fall back to IP
    // ('trust proxy' is configured in main.ts, so req.ip is the real client).
    return req.user?.user_id ?? req.ip ?? 'unknown';
  }
}
