import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DeveloperService {
  private logger: winston.Logger;
  private enabledLevels: string[];
  private loggingEnabled: boolean;
  private readonly logFilePath: string;
  private readonly defaultCustomLevel = 'debug';

  constructor(private readonly config: ConfigService) {
    this.loggingEnabled = this.config.get('LOG_ENABLED') !== 'false';

    this.enabledLevels = String(
      this.config.get('LOG_LEVELS') || 'error,warning,info,debug',
    )
      .split(',')
      .map((level: string) => level.trim().toLowerCase())
      .filter(Boolean);

    const configuredPath =
      this.config.get<string>('LOG_FILE') || 'src/logs.log';
    this.logFilePath = path.resolve(process.cwd(), configuredPath);
    const logDir = path.dirname(this.logFilePath);

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.logger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(
          ({ timestamp, level, message, context, stack }) => {
            const safeContext = this.safeStringify(context);
            const contextSuffix =
              safeContext && safeContext !== '{}' ? ` ${safeContext}` : '';
            const stackSuffix = stack ? `\n${stack}` : '';
            return `[${timestamp}] ${String(level).toUpperCase()} : ${message}${contextSuffix}${stackSuffix}`;
          },
        ),
      ),
      transports: [
        new winston.transports.File({
          filename: this.logFilePath,
        }),
      ],
    });
  }

  log(level: string, message: any, context: Record<string, any> = {}): void {
    if (!this.loggingEnabled) return;

    const normalizedLevel = String(level || '').toLowerCase();
    const effectiveContext = this.cloneContext(context);
    const effectiveLevel = this.mapToWinstonLevel(
      normalizedLevel,
      effectiveContext,
    );

    if (
      !this.enabledLevels.includes(normalizedLevel) &&
      !this.enabledLevels.includes(effectiveLevel)
    ) {
      return;
    }

    this.logger.log({
      level: effectiveLevel,
      message: this.normalizeMessage(message),
      context: effectiveContext,
      stack: message instanceof Error ? message.stack : undefined,
    });
  }

  private mapToWinstonLevel(
    level: string,
    context: Record<string, any>,
  ): string {
    const map: Record<string, string> = {
      emergency: 'error',
      alert: 'error',
      critical: 'error',
      error: 'error',
      warning: 'warn',
      warn: 'warn',
      notice: 'info',
      info: 'info',
      debug: 'debug',
    };

    if (map[level]) {
      return map[level];
    }

    context.original_level = level;
    return this.defaultCustomLevel;
  }

  private normalizeMessage(message: any): string {
    if (message instanceof Error) {
      return message.message;
    }

    if (typeof message === 'string') {
      return message;
    }

    return this.safeStringify(message);
  }

  private cloneContext(context: Record<string, any>): Record<string, any> {
    if (!context || typeof context !== 'object') {
      return {};
    }

    return { ...context };
  }

  private safeStringify(value: any): string {
    try {
      const seen = new WeakSet<object>();
      return JSON.stringify(value, (_key, currentValue) => {
        if (currentValue instanceof Error) {
          return {
            name: currentValue.name,
            message: currentValue.message,
            stack: currentValue.stack,
          };
        }

        if (typeof currentValue === 'bigint') {
          return currentValue.toString();
        }

        if (currentValue && typeof currentValue === 'object') {
          if (seen.has(currentValue as object)) {
            return '[Circular]';
          }
          seen.add(currentValue as object);
        }

        return currentValue;
      });
    } catch {
      return '[Unserializable]';
    }
  }

  emergency(msg: any, ctx: Record<string, any> = {}) {
    this.log('emergency', msg, ctx);
  }
  alert(msg: any, ctx: Record<string, any> = {}) {
    this.log('alert', msg, ctx);
  }
  critical(msg: any, ctx: Record<string, any> = {}) {
    this.log('critical', msg, ctx);
  }
  error(msg: any, ctx: Record<string, any> = {}) {
    this.log('error', msg, ctx);
  }
  warn(msg: any, ctx: Record<string, any> = {}) {
    this.log('warning', msg, ctx);
  }
  warning(msg: any, ctx: Record<string, any> = {}) {
    this.log('warning', msg, ctx);
  }
  notice(msg: any, ctx: Record<string, any> = {}) {
    this.log('notice', msg, ctx);
  }
  info(msg: any, ctx: Record<string, any> = {}) {
    this.log('info', msg, ctx);
  }
  debug(msg: any, ctx: Record<string, any> = {}) {
    this.log('debug', msg, ctx);
  }
  query(msg: any, ctx: Record<string, any> = {}) {
    this.log('debug', msg, { ...ctx, log_type: 'query' });
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }
}
