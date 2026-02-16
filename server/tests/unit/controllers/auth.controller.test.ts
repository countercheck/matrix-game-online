import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../../src/services/auth.service.js', () => ({
  register: vi.fn(),
  login: vi.fn(),
  refreshToken: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

import * as authController from '../../../src/controllers/auth.controller.js';
import * as authService from '../../../src/services/auth.service.js';

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('Auth Controller', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  describe('register', () => {
    it('should register a user and return 201', async () => {
      const mockResult = { user: { id: 'user-1' }, token: 'jwt-token' };
      vi.mocked(authService.register).mockResolvedValue(mockResult as any);

      const req = createMockReq({
        body: { email: 'test@test.com', password: 'Password123', displayName: 'Test' },
      });
      const res = createMockRes();

      await authController.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it('should forward validation errors', async () => {
      const req = createMockReq({ body: {} });
      const res = createMockRes();

      await authController.register(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login and return tokens', async () => {
      const mockResult = { user: { id: 'user-1' }, token: 'jwt-token' };
      vi.mocked(authService.login).mockResolvedValue(mockResult as any);

      const req = createMockReq({
        body: { email: 'test@test.com', password: 'Password123' },
      });
      const res = createMockRes();

      await authController.login(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it('should forward login errors', async () => {
      const error = new Error('Invalid credentials');
      vi.mocked(authService.login).mockRejectedValue(error);

      const req = createMockReq({
        body: { email: 'test@test.com', password: 'wrong' },
      });
      const res = createMockRes();

      await authController.login(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('logout', () => {
    it('should return logout success message', async () => {
      const req = createMockReq();
      const res = createMockRes();

      await authController.logout(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh token and return new tokens', async () => {
      const mockResult = { token: 'new-jwt', refreshToken: 'new-refresh' };
      vi.mocked(authService.refreshToken).mockResolvedValue(mockResult as any);

      const req = createMockReq({ body: { refreshToken: 'old-refresh' } });
      const res = createMockRes();

      await authController.refreshToken(req, res, next);

      expect(authService.refreshToken).toHaveBeenCalledWith('old-refresh');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });
  });

  describe('forgotPassword', () => {
    it('should request password reset', async () => {
      const mockResult = { message: 'Reset email sent' };
      vi.mocked(authService.requestPasswordReset).mockResolvedValue(mockResult as any);

      const req = createMockReq({ body: { email: 'test@test.com' } });
      const res = createMockRes();

      await authController.forgotPassword(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });
  });

  describe('resetPassword', () => {
    it('should reset password', async () => {
      const mockResult = { message: 'Password reset' };
      vi.mocked(authService.resetPassword).mockResolvedValue(mockResult as any);

      const req = createMockReq({
        body: { token: 'reset-token', newPassword: 'NewPassword123' },
      });
      const res = createMockRes();

      await authController.resetPassword(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });
  });
});
