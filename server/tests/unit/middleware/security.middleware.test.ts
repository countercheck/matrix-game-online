import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  sanitizeString,
  sanitizeInput,
  securityHeaders,
} from '../../../src/middleware/security.middleware.js';

describe('Security Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeString', () => {
    it('should escape HTML angle brackets', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('should escape ampersands', () => {
      expect(sanitizeString('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape quotes', () => {
      expect(sanitizeString('He said "hello"')).toBe('He said &quot;hello&quot;');
      expect(sanitizeString("It's fine")).toBe('It&#x27;s fine');
    });

    it('should handle empty strings', () => {
      expect(sanitizeString('')).toBe('');
    });

    it('should preserve normal text', () => {
      expect(sanitizeString('Hello, world!')).toBe('Hello, world!');
    });

    it('should handle mixed content', () => {
      expect(sanitizeString('Hello <b>world</b> & "friends"')).toBe(
        'Hello &lt;b&gt;world&lt;/b&gt; &amp; &quot;friends&quot;'
      );
    });
  });

  describe('sanitizeInput middleware', () => {
    function createMockReq(
      body?: object,
      query?: object,
      params?: object
    ): Request {
      return {
        body: body || {},
        query: query || {},
        params: params || {},
      } as Request;
    }

    function createMockRes(): Response {
      return {} as Response;
    }

    it('should sanitize body strings', () => {
      const req = createMockReq({
        name: '<script>xss</script>',
        description: 'Normal text',
      });
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      sanitizeInput(req, res, next);

      expect(req.body.name).toBe('&lt;script&gt;xss&lt;/script&gt;');
      expect(req.body.description).toBe('Normal text');
      expect(next).toHaveBeenCalled();
    });

    it('should sanitize nested objects', () => {
      const req = createMockReq({
        user: {
          name: '<b>John</b>',
          bio: 'Hello & welcome',
        },
      });
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      sanitizeInput(req, res, next);

      expect(req.body.user.name).toBe('&lt;b&gt;John&lt;/b&gt;');
      expect(req.body.user.bio).toBe('Hello &amp; welcome');
    });

    it('should sanitize arrays', () => {
      const req = createMockReq({
        tags: ['<script>', 'normal', '<b>bold</b>'],
      });
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      sanitizeInput(req, res, next);

      expect(req.body.tags[0]).toBe('&lt;script&gt;');
      expect(req.body.tags[1]).toBe('normal');
      expect(req.body.tags[2]).toBe('&lt;b&gt;bold&lt;/b&gt;');
    });

    it('should preserve non-string values', () => {
      const req = createMockReq({
        count: 42,
        active: true,
        data: null,
      });
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      sanitizeInput(req, res, next);

      expect(req.body.count).toBe(42);
      expect(req.body.active).toBe(true);
      expect(req.body.data).toBeNull();
    });

    it('should sanitize query parameters', () => {
      const req = createMockReq(
        {},
        { search: '<script>xss</script>' }
      );
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      sanitizeInput(req, res, next);

      expect(req.query.search).toBe('&lt;script&gt;xss&lt;/script&gt;');
    });

    it('should sanitize URL params', () => {
      const req = createMockReq(
        {},
        {},
        { id: '<script>xss</script>' }
      );
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      sanitizeInput(req, res, next);

      expect(req.params.id).toBe('&lt;script&gt;xss&lt;/script&gt;');
    });

    it('should handle empty body/query/params', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      expect(() => sanitizeInput(req, res, next)).not.toThrow();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('securityHeaders middleware', () => {
    it('should set X-Frame-Options header', () => {
      const req = {} as Request;
      const res = {
        setHeader: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    });

    it('should set X-Content-Type-Options header', () => {
      const req = {} as Request;
      const res = {
        setHeader: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'X-Content-Type-Options',
        'nosniff'
      );
    });

    it('should set X-XSS-Protection header', () => {
      const req = {} as Request;
      const res = {
        setHeader: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'X-XSS-Protection',
        '1; mode=block'
      );
    });

    it('should set Referrer-Policy header', () => {
      const req = {} as Request;
      const res = {
        setHeader: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin'
      );
    });

    it('should set Content-Security-Policy header', () => {
      const req = {} as Request;
      const res = {
        setHeader: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'self'")
      );
    });

    it('should call next', () => {
      const req = {} as Request;
      const res = {
        setHeader: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      securityHeaders(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
