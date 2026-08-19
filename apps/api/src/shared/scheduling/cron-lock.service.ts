import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/shared/redis/redis.service';

/**
 * A Redis lock that lets exactly one instance run a scheduled handler.
 *
 * Every `@Cron` in this codebase is registered in the API process. Today that is a
 * single PM2 fork, so nothing double-runs — but the moment `instances: 'max'` is
 * set, every instance runs every cron: duplicate subscription orders, duplicate
 * bills, duplicate wallet debits. None of the generation paths are idempotent, so
 * this lock is what makes horizontal scaling safe.
 */
@Injectable()
export class CronLockService {
  private readonly logger = new Logger(CronLockService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Claims the right to run `job` for this tick. Returns false when another
   * instance already holds it, in which case the caller must return immediately.
   *
   * The lock is never released explicitly: holding it for the full TTL is what
   * stops an instance whose clock runs a few seconds behind from starting the same
   * run. Pick a TTL above the expected runtime and below the schedule interval.
   */
  async acquire(job: string, ttlSeconds: number): Promise<boolean> {
    const acquired = await this.redis.acquireLock(`cron_lock:${job}`, ttlSeconds);
    if (!acquired) {
      this.logger.log(`Skipping ${job}: another instance holds the lock`);
    }
    return acquired;
  }
}
