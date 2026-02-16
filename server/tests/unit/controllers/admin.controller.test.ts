import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../../src/services/admin.service.js', () => ({
  getDashboardStats: vi.fn(),
  listUsers: vi.fn(),
  getUserDetails: vi.fn(),
  updateUserRole: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  listGames: vi.fn(),
  getGameDetails: vi.fn(),
  deleteGame: vi.fn(),
  pauseGame: vi.fn(),
  resumeGame: vi.fn(),
  removePlayerFromGame: vi.fn(),
  listAuditLogs: vi.fn(),
}));

import * as adminController from '../../../src/controllers/admin.controller.js';
import * as adminService from '../../../src/services/admin.service.js';

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { id: 'admin-1', email: 'admin@test.com', displayName: 'Admin' },
    params: {},
    body: {},
    query: {},
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
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

describe('Admin Controller', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  describe('getDashboard', () => {
    it('should return dashboard stats', async () => {
      const mockStats = { totalUsers: 10, totalGames: 5 };
      vi.mocked(adminService.getDashboardStats).mockResolvedValue(mockStats as any);

      const req = createMockReq();
      const res = createMockRes();

      await adminController.getDashboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockStats);
    });

    it('should forward errors', async () => {
      vi.mocked(adminService.getDashboardStats).mockRejectedValue(new Error('DB error'));

      const req = createMockReq();
      const res = createMockRes();

      await adminController.getDashboard(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('listUsers', () => {
    it('should list users with query params', async () => {
      const mockResult = { users: [], total: 0 };
      vi.mocked(adminService.listUsers).mockResolvedValue(mockResult as any);

      const req = createMockReq({ query: { page: '1', limit: '10' } as any });
      const res = createMockRes();

      await adminController.listUsers(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('getUserDetails', () => {
    it('should return user details', async () => {
      const mockUser = { id: 'user-1', email: 'test@test.com' };
      vi.mocked(adminService.getUserDetails).mockResolvedValue(mockUser as any);

      const req = createMockReq({ params: { userId: 'user-1' } as any });
      const res = createMockRes();

      await adminController.getUserDetails(req, res, next);

      expect(adminService.getUserDetails).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      const mockUser = { id: 'user-1', role: 'ADMIN' };
      vi.mocked(adminService.updateUserRole).mockResolvedValue(mockUser as any);

      const req = createMockReq({
        params: { userId: 'user-1' } as any,
        body: { role: 'MODERATOR' },
      });
      const res = createMockRes();

      await adminController.updateUserRole(req, res, next);

      expect(adminService.updateUserRole).toHaveBeenCalledWith(
        'admin-1',
        'user-1',
        expect.any(Object),
        '127.0.0.1'
      );
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });

    it('should extract IP from x-forwarded-for header', async () => {
      vi.mocked(adminService.updateUserRole).mockResolvedValue({} as any);

      const req = createMockReq({
        params: { userId: 'user-1' } as any,
        body: { role: 'MODERATOR' },
        headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' },
      });
      const res = createMockRes();

      await adminController.updateUserRole(req, res, next);

      expect(adminService.updateUserRole).toHaveBeenCalledWith(
        'admin-1',
        'user-1',
        expect.any(Object),
        '10.0.0.1'
      );
    });
  });

  describe('banUser', () => {
    it('should ban user', async () => {
      const mockUser = { id: 'user-1', isBanned: true };
      vi.mocked(adminService.banUser).mockResolvedValue(mockUser as any);

      const req = createMockReq({
        params: { userId: 'user-1' } as any,
        body: { reason: 'Abuse' },
      });
      const res = createMockRes();

      await adminController.banUser(req, res, next);

      expect(adminService.banUser).toHaveBeenCalledWith(
        'admin-1',
        'user-1',
        expect.any(Object),
        '127.0.0.1'
      );
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('unbanUser', () => {
    it('should unban user', async () => {
      const mockUser = { id: 'user-1', isBanned: false };
      vi.mocked(adminService.unbanUser).mockResolvedValue(mockUser as any);

      const req = createMockReq({ params: { userId: 'user-1' } as any });
      const res = createMockRes();

      await adminController.unbanUser(req, res, next);

      expect(adminService.unbanUser).toHaveBeenCalledWith('admin-1', 'user-1', '127.0.0.1');
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('listGames', () => {
    it('should list games', async () => {
      const mockResult = { games: [], total: 0 };
      vi.mocked(adminService.listGames).mockResolvedValue(mockResult as any);

      const req = createMockReq({ query: {} as any });
      const res = createMockRes();

      await adminController.listGames(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('getGameDetails', () => {
    it('should return game details', async () => {
      const mockGame = { id: 'game-1', name: 'Test' };
      vi.mocked(adminService.getGameDetails).mockResolvedValue(mockGame as any);

      const req = createMockReq({ params: { gameId: 'game-1' } as any });
      const res = createMockRes();

      await adminController.getGameDetails(req, res, next);

      expect(adminService.getGameDetails).toHaveBeenCalledWith('game-1');
      expect(res.json).toHaveBeenCalledWith(mockGame);
    });
  });

  describe('deleteGame', () => {
    it('should delete game', async () => {
      const mockResult = { message: 'Deleted' };
      vi.mocked(adminService.deleteGame).mockResolvedValue(mockResult as any);

      const req = createMockReq({ params: { gameId: 'game-1' } as any });
      const res = createMockRes();

      await adminController.deleteGame(req, res, next);

      expect(adminService.deleteGame).toHaveBeenCalledWith('admin-1', 'game-1', '127.0.0.1');
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('pauseGame', () => {
    it('should pause game', async () => {
      const mockGame = { id: 'game-1', status: 'PAUSED' };
      vi.mocked(adminService.pauseGame).mockResolvedValue(mockGame as any);

      const req = createMockReq({ params: { gameId: 'game-1' } as any });
      const res = createMockRes();

      await adminController.pauseGame(req, res, next);

      expect(adminService.pauseGame).toHaveBeenCalledWith('admin-1', 'game-1', '127.0.0.1');
    });
  });

  describe('resumeGame', () => {
    it('should resume game', async () => {
      const mockGame = { id: 'game-1', status: 'ACTIVE' };
      vi.mocked(adminService.resumeGame).mockResolvedValue(mockGame as any);

      const req = createMockReq({ params: { gameId: 'game-1' } as any });
      const res = createMockRes();

      await adminController.resumeGame(req, res, next);

      expect(adminService.resumeGame).toHaveBeenCalledWith('admin-1', 'game-1', '127.0.0.1');
    });
  });

  describe('removePlayer', () => {
    it('should remove player from game', async () => {
      const mockResult = { message: 'Removed' };
      vi.mocked(adminService.removePlayerFromGame).mockResolvedValue(mockResult as any);

      const req = createMockReq({
        params: { gameId: 'game-1', playerId: 'player-1' } as any,
      });
      const res = createMockRes();

      await adminController.removePlayer(req, res, next);

      expect(adminService.removePlayerFromGame).toHaveBeenCalledWith(
        'admin-1',
        'game-1',
        'player-1',
        '127.0.0.1'
      );
    });
  });

  describe('listAuditLogs', () => {
    it('should list audit logs', async () => {
      const mockResult = { logs: [], total: 0 };
      vi.mocked(adminService.listAuditLogs).mockResolvedValue(mockResult as any);

      const req = createMockReq({ query: {} as any });
      const res = createMockRes();

      await adminController.listAuditLogs(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });
});
