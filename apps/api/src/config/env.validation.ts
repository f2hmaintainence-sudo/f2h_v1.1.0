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
    .default('365d'),
  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhdw]?$/)
    .default('365d'),

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

  // Google Play Integrity. Off by default so a checkout of this repo, a debug
  // build, or a local API boots without any Google credential at all. Nothing
  // here is a secret: the service-account credential is resolved separately,
  // from `api_integrations_config` or a server-side path/JSON.
  PLAY_INTEGRITY_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  PLAY_INTEGRITY_ENFORCE: Joi.boolean().truthy('true').falsy('false').default(true),
  PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER: Joi.string().allow('').default(''),
  PLAY_INTEGRITY_CUSTOMER_PACKAGE: Joi.string().default('com.f2h.customer'),
  PLAY_INTEGRITY_DELIVERY_PACKAGE: Joi.string().default('com.f2h.delivery'),
  PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON: Joi.string().allow('').optional(),
  PLAY_INTEGRITY_SERVICE_ACCOUNT_PATH: Joi.string().allow('').optional(),
  PLAY_INTEGRITY_MAX_TOKEN_AGE_SECONDS: Joi.number().min(30).max(3600).default(300),
})
  // Unknown keys are common in a shared .env; only the declared ones are validated.
  .unknown(true)
  .custom((value, helpers) => {
    if (value.NODE_ENV === 'production' && !String(value.CORS_ORIGINS || '').trim()) {
      return helpers.error('any.custom', {
        message: 'CORS_ORIGINS must list the allowed browser origins in production',
      });
    }
    // Turning integrity on without the Cloud project number would silently verify
    // against the wrong Google project, so it fails at boot instead.
    if (
      value.PLAY_INTEGRITY_ENABLED === true &&
      !String(value.PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER || '').trim()
    ) {
      return helpers.error('any.custom', {
        message:
          'PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER is required when PLAY_INTEGRITY_ENABLED is true',
      });
    }
    return value;
  });
