import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';

/**
 * Middleware placeholder for input sanitization.
 *
 * HTML entity encoding was removed because:
 * 1. The frontend uses react-markdown which safely renders content without
 *    interpreting raw HTML (XSS-safe by default).
 * 2. Encoding on input corrupted stored content (e.g., " became &quot;)
 *    which then displayed as literal &quot; in the UI.
 * 3. XSS prevention is better handled at the rendering layer (output encoding)
 *    rather than input encoding, which corrupts legitimate content.
 *
 * The sanitizeInput middleware is kept as a pass-through to avoid breaking
 * the import in index.ts. It can be removed entirely if desired.
 */
export function sanitizeInput(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

/**
 * General rate limiter for all API endpoints.
 * Limits to 100 requests per minute per IP.
 */
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  handler: (req, res, _next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
});

/**
 * Stricter rate limiter for authentication endpoints.
 * Limits to 10 requests per 15 minutes per IP.
 * Helps prevent brute force attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later',
    },
  },
  handler: (req, res, _next, options) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
});

/**
 * Rate limiter for action endpoints (proposals, votes, etc.).
 * Limits to 30 requests per minute per IP.
 */
export const actionRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many action requests, please slow down',
    },
  },
  handler: (req, res, _next, options) => {
    logger.warn(`Action rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
});

/**
 * Rate limiter for file upload endpoints.
 * Limits to 20 uploads per 15 minutes per IP.
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many upload requests, please try again later',
    },
  },
  handler: (req, res, _next, options) => {
    logger.warn(`Upload rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
});

/**
 * Security headers middleware.
 * Adds common security headers to all responses.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS filter in browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy (basic)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
  );

  next();
}

/**
 * Request logging middleware for security auditing.
 */
export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  const logData = {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
  };

  logger.debug(`Request: ${JSON.stringify(logData)}`);
  next();
}

/**
 * CSRF Protection Middleware
 *
 * This application uses JWT tokens sent via Authorization headers (not cookies),
 * which provides inherent CSRF protection since:
 * 1. Cross-origin requests cannot include custom headers without CORS preflight
 * 2. localStorage (where tokens are stored) is origin-bound
 * 3. The Authorization header must be explicitly set by JavaScript
 *
 * For additional defense-in-depth, this middleware verifies that state-changing
 * requests (POST, PUT, DELETE, PATCH) include a custom X-Requested-With header,
 * which cannot be sent cross-origin without CORS approval.
 *
 * Note: The deprecated 'csurf' package is not used. This custom header approach
 * is the recommended pattern for modern SPAs with token-based authentication.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Only check state-changing methods
  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }

  // Skip CSRF check for auth endpoints (login/register don't have tokens yet)
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }

  // Verify the custom header is present
  // This header cannot be sent cross-origin without CORS preflight approval
  const requestedWith = req.get('X-Requested-With');

  if (requestedWith !== 'XMLHttpRequest') {
    logger.warn(`CSRF protection: Missing or invalid X-Requested-With header from ${req.ip}`);
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_VALIDATION_FAILED',
        message: 'Invalid request origin',
      },
    });
    return;
  }

  next();
}
