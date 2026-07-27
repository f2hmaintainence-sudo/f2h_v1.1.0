// Trigger backend build: 2026-07-23-v2
// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : main.ts
// Description : NestJS API entry point — URI-versioned (/api/v1/), compact
//               headers (X-Role, X-Plt, X-Ver, X-Csrf), gzip compression.
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { config } from 'dotenv';
import helmet from 'helmet';
import session from 'express-session';
import { json, urlencoded } from 'express';
import type { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { RedisService } from './redis/redis.service';
import { RoleHeaderMiddleware } from './middleware/role-header.middleware';

// Load environment variables before anything else
config();

async function bootstrap() {
  const env = (globalThis as any).process?.env ?? {};
  const isDev = env.NODE_ENV !== 'production';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: isDev ? ['log', 'error', 'warn', 'debug'] : ['error', 'warn'],
  });


  // ── Global prefix + URI versioning (/api/v1/) ──────────────────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ── Gzip compression (saves 60-80% on JSON responses > 1 KB) ────────────────
  app.use(
    compression({
      level: 6,
      threshold: 1024,
      filter: (req: Request, res: Response) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      },
    }),
  );

  // ── Compact header expansion (X-Role/X-Plt/X-Ver/X-Csrf → full values) ─────
  const roleMiddleware = new RoleHeaderMiddleware();
  app.use((req: Request, res: Response, next: NextFunction) =>
    roleMiddleware.use(req, res, next),
  );

  // ── Increase payload size limits to allow base64 image uploads ──────────────
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Essential for Throttler to see correct IP (especially on localhost/proxies)
  app.getHttpAdapter().getInstance().set('trust proxy', 'loopback');

  // Security headers middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:', 'http:'],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false, // Allow embedding if needed
      hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    maxAge: 31536000000, // 1 year in milliseconds
    setHeaders: (res: any) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
  });

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/api/v1/uploads/',
    maxAge: 31536000000, // 1 year in milliseconds
    setHeaders: (res: any) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
  });


  // Enable Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      transform: true, // Transform payloads to DTO instances
      forbidNonWhitelisted: false, // whitelist:true already strips unknown fields safely
    }),
  );

  // Additional security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // XSS Protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions Policy
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=()',
    );
    next();
  });

  app.use(cookieParser());

  // Custom Redis session store to avoid MemoryStore leaks and warnings
  class RedisSessionStore extends session.Store {
    constructor(private readonly redisService: RedisService) {
      super();
    }

    get = (sid: string, callback: (err: any, session?: any) => void) => {
      this.redisService.fetch(`sess:${sid}`)
        .then((data) => {
          if (!data) return callback(null, null);
          callback(null, typeof data === 'string' ? JSON.parse(data) : data);
        })
        .catch((err) => callback(err));
    };

    set = (sid: string, sessionData: any, callback: (err?: any) => void) => {
      const ttl = sessionData.cookie?.maxAge
        ? Math.ceil(sessionData.cookie.maxAge / 1000)
        : 600; // default 10 mins
      this.redisService.put(`sess:${sid}`, sessionData, ttl)
        .then(() => callback(null))
        .catch((err) => callback(err));
    };

    destroy = (sid: string, callback: (err?: any) => void) => {
      this.redisService.forget(`sess:${sid}`)
        .then(() => callback(null))
        .catch((err) => callback(err));
    };

    touch = (sid: string, sessionData: any, callback: (err?: any) => void) => {
      const ttl = sessionData.cookie?.maxAge
        ? Math.ceil(sessionData.cookie.maxAge / 1000)
        : 600;
      this.redisService.fetch(`sess:${sid}`)
        .then((data) => {
          if (data) {
            return this.redisService.put(`sess:${sid}`, data, ttl);
          }
        })
        .then(() => callback(null))
        .catch((err) => callback(err));
    };
  }

  const sessionSecret = env.SESSION_SECRET || env.JWT_SECRET;
  if (!sessionSecret) {
    throw new Error(
      'CRITICAL: SESSION_SECRET or JWT_SECRET environment variable is not set',
    );
  }

  const redisService = app.get(RedisService);
  app.use(
    session({
      store: new RedisSessionStore(redisService),
      name: '__x_sid', // Renamed from default 'connect.sid' for security
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: false, // Don't extend session life on every request
      cookie: {
        httpOnly: true, // Prevents JavaScript from reading the cookie
        secure: env.NODE_ENV === 'production', // Only send over HTTPS in production
        sameSite: 'lax', // Protects against most CSRF attacks
        maxAge: 10 * 60 * 1000, // 10 minutes (limited time for login handshake)
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Passport serialize/deserialize — needed for OAuth state flow
  passport.serializeUser((user: any, done: any) => done(null, user));
  passport.deserializeUser((user: any, done: any) => done(null, user));

  app.enableCors({
    origin: (origin, callback) => {
      // Allow mobile apps (no origin), localhost, and local network
      if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.startsWith('http://192.168.')) {
        return callback(null, true);
      }
      // In production, add domain whitelist here
      return callback(null, true);
    },
    methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    // Compact header names (X-Role, X-Plt, X-Ver, X-Csrf) + standard headers
    // RoleHeaderMiddleware internally expands these to full canonical names
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Role',   // compact: C=CUSTOMER, D=DELIVERY_BOY, A=ADMIN
      'X-Plt',    // compact: ac=android_customer, ic=ios_customer, ad/id=delivery
      'X-Ver',    // compact: semver build string e.g. 1.0.3+10
      'X-Csrf',   // compact: CSRF uuid for mutations
      // Legacy verbose headers (kept for admin panel / web clients during migration)
      'x-role',
      'x-csrf-token',
    ].join(', '),
    credentials: true,
    maxAge: 86400, // 24-hour preflight cache
  });

  const port = env.Backend_Port || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on http://0.0.0.0:${port}`);
}
bootstrap();
