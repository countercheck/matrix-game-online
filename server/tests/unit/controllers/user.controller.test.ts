import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../../src/services/user.service.js', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  getUserGames: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));

import * as userController from '../../../src/controllers/user.controller.js';
import * as userService from '../../../src/services/user.service.js';

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { id: 'user-1', email: 'test@test.com', displayName: 'Test User' },
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

describe('User Controller', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const mockProfile = { id: 'user-1', email: 'test@test.com', displayName: 'Test' };
      vi.mocked(userService.getProfile).mockResolvedValue(mockProfile as any);

      const req = createMockReq();
      const res = createMockRes();

      await userController.getProfile(req, res, next);

      expect(userService.getProfile).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockProfile });
    });

    it('should forward errors', async () => {
      vi.mocked(userService.getProfile).mockRejectedValue(new Error('Not found'));

      const req = createMockReq();
      const res = createMockRes();

      await userController.getProfile(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateProfile', () => {
    it('should update profile and return result', async () => {
      const mockProfile = { id: 'user-1', displayName: 'Updated Name' };
      vi.mocked(userService.updateProfile).mockResolvedValue(mockProfile as any);

      const req = createMockReq({ body: { displayName: 'Updated Name' } });
      const res = createMockRes();

      await userController.updateProfile(req, res, next);

      expect(userService.updateProfile).toHaveBeenCalledWith('user-1', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockProfile });
    });
  });

  describe('getUserGames', () => {
    it('should return user games', async () => {
      const mockGames = [{ id: 'game-1', name: 'Test Game' }];
      vi.mocked(userService.getUserGames).mockResolvedValue(mockGames as any);

      const req = createMockReq();
      const res = createMockRes();

      await userController.getUserGames(req, res, next);

      expect(userService.getUserGames).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockGames });
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should update notification preferences', async () => {
      const mockPrefs = { emailEnabled: false };
      vi.mocked(userService.updateNotificationPreferences).mockResolvedValue(mockPrefs as any);

      const req = createMockReq({ body: { emailEnabled: false } });
      const res = createMockRes();

      await userController.updateNotificationPreferences(req, res, next);

      expect(userService.updateNotificationPreferences).toHaveBeenCalledWith(
        'user-1',
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockPrefs });
    });
  });
});
