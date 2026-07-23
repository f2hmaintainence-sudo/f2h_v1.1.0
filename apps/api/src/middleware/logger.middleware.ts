import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { ip, method, originalUrl } = req;
    const userAgent = req.get('user-agent') || '';
    const start = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length');
      const duration = Date.now() - start;
      const message = `${method} ${originalUrl} ${statusCode} ${contentLength} - ${userAgent} ${ip} +${duration}ms`;

      if (statusCode >= 500) {
        this.logger.error(message);
        return;
      }

      if (statusCode >= 400) {
        this.logger.warn(message);
        return;
      }

      if (duration > 1500) {
        this.logger.warn(`[SLOW] ${message}`);
      }
    });

    next();
  }
}
