// Trigger backend build: 2026-07-23-v2
// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : main.ts
// Description : NestJS API entry point — URI-versioned (/api/v1/), compact
//               headers (X-Role, X-Plt, X-Ver, X-Csrf), gzip compression.
//
// ============================================================================

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
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

  // ── Payload size limits ────────────────────────────────────────────────────
  // JSON parsing is synchronous, so a global 50 MB ceiling let a handful of large
  // posts to any route (including /auth/login) block the event loop. Routes that
  // genuinely carry base64 images get their own, larger limit below; everything
  // else is capped at 1 MB.
  const LARGE_BODY_ROUTES = [
    '/api/v1/admin/catalog',
    '/api/v1/admin/profile',
    '/api/v1/zone/delivery',
    '/api/v1/delivery-partner/profile',
    '/api/v1/DeliveryPartner/profile',
  ];
  for (const route of LARGE_BODY_ROUTES) {
    app.use(route, json({ limit: '15mb' }));
    app.use(route, urlencoded({ extended: true, limit: '15mb' }));
  }
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // Essential for Throttler to see correct IP (especially on localhost/proxies)
  app.getHttpAdapter().getInstance().set('trust proxy', 'loopback');

  // Security headers middleware
  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://accounts.google.com', 'https://checkout.razorpay.com'],
          imgSrc: ["'self'", 'data:', 'https:', 'http:', 'https://*.googleusercontent.com'],
          frameSrc: ["'self'", 'https://accounts.google.com', 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
          connectSrc: ["'self'", 'https://accounts.google.com', 'https://*.googleapis.com', 'https://*.razorpay.com'],
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

  // Explicit whitelist from CORS_ORIGINS + domain-based wildcard matching
  const allowedOrigins = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value: string) => value.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // No Origin header = a native mobile app or a server-side call, not a browser
      // cross-site request, so there is nothing for CORS to protect against.
      if (!origin) {
        return callback(null, true);
      }

      // Explicit whitelist
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow all f2hfresh.com subdomains (e.g. customer.f2hfresh.com, partner.f2hfresh.com)
      // and localhost / local development network origins
      try {
        const parsed = new URL(origin);
        const host = parsed.hostname.toLowerCase();
        if (
          host === 'f2hfresh.com' ||
          host.endsWith('.f2hfresh.com') ||
          host === 'localhost' ||
          host === '127.0.0.1' ||
          host.startsWith('192.168.') ||
          host.startsWith('10.') ||
          host.startsWith('172.')
        ) {
          return callback(null, true);
        }
      } catch {}

      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    // Compact header names (X-Role, X-Plt, X-Ver, X-Csrf) + standard headers
    // RoleHeaderMiddleware internally expands these to full canonical names
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Role',   // compact: C=CUSTOMER, D=DELIVERY_PARTNER, A=ADMIN
      'X-Plt',    // compact: ac=android_customer, ic=ios_customer, ad/id=delivery
      'X-Ver',    // compact: semver build string e.g. 1.0.3+10
      'X-Csrf',   // compact: CSRF uuid for mutations
      'x-role',
      'x-app-platform',
      'x-app-version',
      'x-csrf-token',
      'x-requested-with',
      'accept',
      'origin',
    ].join(', '),
    credentials: true,
    maxAge: 86400, // 24-hour preflight cache
  });

  const port = env.PORT || env.Backend_Port || 5001;
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`Server running on http://0.0.0.0:${port}`);
}
bootstrap();
