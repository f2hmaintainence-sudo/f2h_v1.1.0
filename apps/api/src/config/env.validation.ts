import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    // 'test' is what Jest sets; without it the e2e suite cannot boot the app.
    .valid('development', 'test', 'staging', 'production')
    .default('development'),

  APP_PORT: Joi.number().default(3000),

  DB_RUNTIME: Joi.string().valid('auto', 'docker', 'local').default('auto'),
  DB_HOST: Joi.string().allow(''),
  DB_HOST_DOCKER: Joi.string().default('pgbouncer'),
  DB_HOST_LOCAL: Joi.string().default('127.0.0.1'),
  DB_PORT: Joi.number(),
  DB_PORT_DOCKER: Joi.number().default(6432),
  DB_PORT_LOCAL: Joi.number().default(6432),
  DB_DATABASE: Joi.string().required(),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow(''),
  DB_PASSWORD_FILE: Joi.string().allow(''),
  DB_POOL_SIZE: Joi.number().min(1).max(100).default(20),
  DB_APPLICATION_NAME: Joi.string().default('backend-api'),

  JWT_SECRET: Joi.string().min(32).required(),
  // Token lifetimes. Defaults are short on purpose: a leaked access token is only
  // dangerous for as long as it is valid, and the refresh token is what carries the
  // long-lived session.
  JWT_ACCESS_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhdw]?$/)
    .default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhdw]?$/)
    .default('30d'),

  // Comma-separated browser origins allowed to send credentialed requests.
  // Required in production — an empty list there denies every browser origin.
  CORS_ORIGINS: Joi.string().allow('').default(''),

  // Webhook secrets have no default: an unset value must fail the request, not fall
  // back to a literal committed in the source.
  F2H_CI_CD_UPLOAD_SECRET: Joi.string().min(24).allow(''),
  F2H_APP_UPDATE_WEBHOOK_SECRET: Joi.string().min(24).allow(''),
  FAST2SMS_API_KEY: Joi.string().allow(''),
  FAST2SMS_ENDPOINT: Joi.string().allow(''),
  FAST2SMS_ROUTE: Joi.string().allow(''),
  ENCRYPTION_SECRET: Joi.string().min(32).required(),
  DATA_ENCRYPTION_KEY: Joi.string().min(32).optional(),
})
  // Unknown keys are common in a shared .env; only the declared ones are validated.
  .unknown(true)
  .custom((value, helpers) => {
    if (value.NODE_ENV === 'production' && !String(value.CORS_ORIGINS || '').trim()) {
      return helpers.error('any.custom', {
        message: 'CORS_ORIGINS must list the allowed browser origins in production',
      });
    }
    return value;
  });
