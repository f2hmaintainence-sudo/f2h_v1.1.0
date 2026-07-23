import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production')
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
  FAST2SMS_API_KEY: Joi.string().allow(''),
  FAST2SMS_ENDPOINT: Joi.string().allow(''),
  FAST2SMS_ROUTE: Joi.string().allow(''),
  ENCRYPTION_SECRET: Joi.string().min(32).required(),
  DATA_ENCRYPTION_KEY: Joi.string().min(32).optional(),
});
