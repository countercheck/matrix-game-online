/**
 * Environment configuration validation and access.
 *
 * This module validates required environment variables at startup
 * and provides type-safe access to configuration values.
 */

import { logger } from '../utils/logger.js';

interface EnvConfig {
  // Application
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  appUrl: string;
  apiUrl: string;

  // Database
  databaseUrl: string;

  // JWT
  jwtSecret: string;
  jwtExpiry: string;

  // Security
  bcryptRounds: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  authRateLimitMax: number;

  // Email
  emailEnabled: boolean;
  emailHost: string;
  emailPort: number;
  emailUser: string;
  emailPass: string;
  emailFrom: string;

  // Timeout Worker
  enableTimeoutWorker: boolean;
  timeoutCheckIntervalMs: number;
  argumentationTimeoutHours: number;
  votingTimeoutHours: number;


  // Monitoring
  logLevel: string;
  sentryDsn?: string;

  // Redis (optional)
  redisUrl?: string;
}

/**
 * Required environment variables for production.
 * Development/test environments have defaults for most of these.
 */
const REQUIRED_IN_PRODUCTION = [
  'DATABASE_URL',
  'JWT_SECRET',
  'APP_URL',
  'EMAIL_HOST',
  'EMAIL_USER',
  'EMAIL_PASS',
  'EMAIL_FROM',
];

/**
 * Validates that all required environment variables are set.
 * Throws an error with details about missing variables in production.
 * Logs warnings in development.
 */
function validateEnv(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing: string[] = [];

  for (const envVar of REQUIRED_IN_PRODUCTION) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // Check JWT_SECRET is not the default
  if (
    process.env.JWT_SECRET ===
    'your-super-secret-jwt-key-change-this-in-production'
  ) {
    if (isProduction) {
      missing.push('JWT_SECRET (using default value)');
    } else {
      logger.warn(
        'Using default JWT_SECRET - this is insecure for production!'
      );
    }
  }

  // Check JWT_SECRET length in production
  if (isProduction && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    logger.error('JWT_SECRET must be at least 32 characters in production');
    missing.push('JWT_SECRET (too short)');
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables:\n  - ${missing.join('\n  - ')}`;
    if (isProduction) {
      logger.error(message);
      throw new Error(message);
    } else {
      logger.warn(message);
    }
  }
}

/**
 * Get a validated environment configuration object.
 * Call this after validateEnv() to get type-safe access to config.
 */
function getConfig(): EnvConfig {
  const nodeEnv = (process.env.NODE_ENV || 'development') as EnvConfig['nodeEnv'];

  return {
    // Application
    nodeEnv,
    port: parseInt(process.env.PORT || '3000', 10),
    appUrl: process.env.APP_URL || 'http://localhost:5173',
    apiUrl: process.env.API_URL || process.env.APP_URL || 'http://localhost:3000',

    // Database
    databaseUrl: process.env.DATABASE_URL || '',

    // JWT
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    jwtExpiry: process.env.JWT_EXPIRY || '7d',

    // Security
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5', 10),

    // Email
    emailEnabled: process.env.EMAIL_ENABLED !== 'false',
    emailHost: process.env.EMAIL_HOST || '',
    emailPort: parseInt(process.env.EMAIL_PORT || '587', 10),
    emailUser: process.env.EMAIL_USER || '',
    emailPass: process.env.EMAIL_PASS || '',
    emailFrom: process.env.EMAIL_FROM || '',

    // Timeout Worker
    enableTimeoutWorker: process.env.ENABLE_TIMEOUT_WORKER !== 'false',
    timeoutCheckIntervalMs: parseInt(process.env.TIMEOUT_CHECK_INTERVAL_MS || '60000', 10),
    argumentationTimeoutHours: parseInt(process.env.ARGUMENTATION_TIMEOUT_HOURS || '24', 10),
    votingTimeoutHours: parseInt(process.env.VOTING_TIMEOUT_HOURS || '24', 10),

    // Monitoring
    logLevel: process.env.LOG_LEVEL || 'info',
    sentryDsn: process.env.SENTRY_DSN,

    // Redis
    redisUrl: process.env.REDIS_URL,
  };
}

// Validate on module load
validateEnv();

// Export the validated config
export const config = getConfig();

// Also export individual values for convenience
export const {
  nodeEnv,
  port,
  appUrl,
  apiUrl,
  databaseUrl,
  jwtSecret,
  jwtExpiry,
  bcryptRounds,
  emailEnabled,
  emailHost,
  emailPort,
  emailUser,
  emailPass,
  emailFrom,
  enableTimeoutWorker,
} = config;
