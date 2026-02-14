import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import {
  requireRole,
  requireModerator,
  requireAdmin,
} from '../../../src/middleware/admin.middleware.js';
import { UnauthorizedError, ForbiddenError } from '../../../src/middleware/errorHandler.js';

describe('Admin Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {};
    mockNext = vi.fn();
  });

  describe('requireRole', () => {
    it('should call next when user has the required role', async () => {
      mockReq.user = {
        id: '1',
        email: 'admin@test.com',
        displayName: 'Admin',
        role: UserRole.ADMIN,
        isBanned: false,
      };

      const middleware = requireRole(UserRole.ADMIN);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next when user has a higher role than required', async () => {
      mockReq.user = {
        id: '1',
        email: 'admin@test.com',
        displayName: 'Admin',
        role: UserRole.ADMIN,
        isBanned: false,
      };

      const middleware = requireRole(UserRole.MODERATOR);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next when user has moderator role and moderator or higher is required', async () => {
      mockReq.user = {
        id: '1',
        email: 'mod@test.com',
        displayName: 'Moderator',
        role: UserRole.MODERATOR,
        isBanned: false,
      };

      const middleware = requireRole(UserRole.MODERATOR);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should throw UnauthorizedError when user is not authenticated', async () => {
      mockReq.user = undefined;

      const middleware = requireRole(UserRole.ADMIN);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should throw ForbiddenError when user has insufficient role', async () => {
      mockReq.user = {
        id: '1',
        email: 'user@test.com',
        displayName: 'User',
        role: UserRole.USER,
        isBanned: false,
      };

      const middleware = requireRole(UserRole.ADMIN);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should throw ForbiddenError when moderator tries to access admin-only', async () => {
      mockReq.user = {
        id: '1',
        email: 'mod@test.com',
        displayName: 'Moderator',
        role: UserRole.MODERATOR,
        isBanned: false,
      };

      const middleware = requireRole(UserRole.ADMIN);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });

  describe('requireModerator', () => {
    it('should allow moderators', async () => {
      mockReq.user = {
        id: '1',
        email: 'mod@test.com',
        displayName: 'Moderator',
        role: UserRole.MODERATOR,
        isBanned: false,
      };

      await requireModerator(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow admins', async () => {
      mockReq.user = {
        id: '1',
        email: 'admin@test.com',
        displayName: 'Admin',
        role: UserRole.ADMIN,
        isBanned: false,
      };

      await requireModerator(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject regular users', async () => {
      mockReq.user = {
        id: '1',
        email: 'user@test.com',
        displayName: 'User',
        role: UserRole.USER,
        isBanned: false,
      };

      await requireModerator(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });

  describe('requireAdmin', () => {
    it('should allow admins', async () => {
      mockReq.user = {
        id: '1',
        email: 'admin@test.com',
        displayName: 'Admin',
        role: UserRole.ADMIN,
        isBanned: false,
      };

      await requireAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject moderators', async () => {
      mockReq.user = {
        id: '1',
        email: 'mod@test.com',
        displayName: 'Moderator',
        role: UserRole.MODERATOR,
        isBanned: false,
      };

      await requireAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should reject regular users', async () => {
      mockReq.user = {
        id: '1',
        email: 'user@test.com',
        displayName: 'User',
        role: UserRole.USER,
        isBanned: false,
      };

      await requireAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });
});
