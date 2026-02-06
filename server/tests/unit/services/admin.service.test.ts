import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserRole, GameStatus } from '@prisma/client';
import * as adminService from '../../../src/services/admin.service.js';
import { db } from '../../../src/config/database.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../../src/middleware/errorHandler.js';

vi.mock('../../../src/config/database.js', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    game: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    gamePlayer: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('Admin Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      vi.mocked(db.user.count).mockResolvedValueOnce(100).mockResolvedValueOnce(5);
      vi.mocked(db.game.count).mockResolvedValueOnce(20).mockResolvedValueOnce(50);
      vi.mocked(db.user.findMany).mockResolvedValue([
        { id: '1', email: 'user1@test.com', displayName: 'User 1', role: UserRole.USER, createdAt: new Date() },
      ]);
      vi.mocked(db.game.findMany).mockResolvedValue([
        {
          id: 'game1',
          name: 'Test Game',
          status: GameStatus.ACTIVE,
          playerCount: 3,
          createdAt: new Date(),
          creator: { id: '1', displayName: 'User 1' },
        },
      ]);

      const result = await adminService.getDashboardStats();

      expect(result.stats.totalUsers).toBe(100);
      expect(result.stats.bannedUsers).toBe(5);
      expect(result.stats.activeGames).toBe(20);
      expect(result.stats.completedGames).toBe(50);
      expect(result.recentUsers).toHaveLength(1);
      expect(result.recentGames).toHaveLength(1);
    });
  });

  describe('listUsers', () => {
    it('should return paginated users', async () => {
      const mockUsers = [
        {
          id: '1',
          email: 'user1@test.com',
          displayName: 'User 1',
          avatarUrl: null,
          role: UserRole.USER,
          isBanned: false,
          bannedAt: null,
          bannedReason: null,
          createdAt: new Date(),
          lastLogin: null,
          _count: { gamePlayers: 2, createdGames: 1 },
        },
      ];
      vi.mocked(db.user.findMany).mockResolvedValue(mockUsers);
      vi.mocked(db.user.count).mockResolvedValue(1);

      const result = await adminService.listUsers({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });

      expect(result.users).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter users by search term', async () => {
      vi.mocked(db.user.findMany).mockResolvedValue([]);
      vi.mocked(db.user.count).mockResolvedValue(0);

      await adminService.listUsers({
        page: 1,
        limit: 20,
        search: 'test',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(db.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { email: { contains: 'test', mode: 'insensitive' } },
              { displayName: { contains: 'test', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });

    it('should filter users by role', async () => {
      vi.mocked(db.user.findMany).mockResolvedValue([]);
      vi.mocked(db.user.count).mockResolvedValue(0);

      await adminService.listUsers({
        page: 1,
        limit: 20,
        role: UserRole.ADMIN,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(db.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: UserRole.ADMIN,
          }),
        })
      );
    });
  });

  describe('getUserDetails', () => {
    it('should return user details', async () => {
      const mockUser = {
        id: '1',
        email: 'user1@test.com',
        displayName: 'User 1',
        avatarUrl: null,
        role: UserRole.USER,
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
        _count: { gamePlayers: 2, createdGames: 1 },
        createdGames: [],
        gamePlayers: [],
      };
      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);

      const result = await adminService.getUserDetails('1');

      expect(result.id).toBe('1');
      expect(result.email).toBe('user1@test.com');
    });

    it('should throw NotFoundError for non-existent user', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);

      await expect(adminService.getUserDetails('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      const adminId = 'admin1';
      const userId = 'user1';
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: userId,
        email: 'user1@test.com',
        role: UserRole.USER,
      } as any);
      vi.mocked(db.user.update).mockResolvedValue({
        id: userId,
        email: 'user1@test.com',
        displayName: 'User 1',
        role: UserRole.MODERATOR,
      } as any);
      vi.mocked(db.adminAuditLog.create).mockResolvedValue({} as any);

      const result = await adminService.updateUserRole(adminId, userId, { role: UserRole.MODERATOR });

      expect(result.role).toBe(UserRole.MODERATOR);
      expect(db.adminAuditLog.create).toHaveBeenCalled();
    });

    it('should throw BadRequestError when trying to change own role', async () => {
      const adminId = 'admin1';

      await expect(
        adminService.updateUserRole(adminId, adminId, { role: UserRole.USER })
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw NotFoundError for non-existent user', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);

      await expect(
        adminService.updateUserRole('admin1', 'non-existent', { role: UserRole.MODERATOR })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('banUser', () => {
    it('should ban a user', async () => {
      const adminId = 'admin1';
      const userId = 'user1';
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: userId,
        email: 'user1@test.com',
        role: UserRole.USER,
        isBanned: false,
      } as any);
      vi.mocked(db.user.update).mockResolvedValue({
        id: userId,
        email: 'user1@test.com',
        displayName: 'User 1',
        isBanned: true,
        bannedAt: new Date(),
        bannedReason: 'Violation of terms',
      } as any);
      vi.mocked(db.adminAuditLog.create).mockResolvedValue({} as any);

      const result = await adminService.banUser(adminId, userId, { reason: 'Violation of terms' });

      expect(result.isBanned).toBe(true);
      expect(result.bannedReason).toBe('Violation of terms');
      expect(db.adminAuditLog.create).toHaveBeenCalled();
    });

    it('should throw BadRequestError when trying to ban self', async () => {
      const adminId = 'admin1';

      await expect(
        adminService.banUser(adminId, adminId, { reason: 'Test' })
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw ForbiddenError when trying to ban an admin', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user1',
        email: 'user1@test.com',
        role: UserRole.ADMIN,
        isBanned: false,
      } as any);

      await expect(
        adminService.banUser('admin1', 'user1', { reason: 'Test' })
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw BadRequestError when user is already banned', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user1',
        email: 'user1@test.com',
        role: UserRole.USER,
        isBanned: true,
      } as any);

      await expect(
        adminService.banUser('admin1', 'user1', { reason: 'Test' })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('unbanUser', () => {
    it('should unban a user', async () => {
      const adminId = 'admin1';
      const userId = 'user1';
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: userId,
        email: 'user1@test.com',
        isBanned: true,
        bannedReason: 'Previous reason',
      } as any);
      vi.mocked(db.user.update).mockResolvedValue({
        id: userId,
        email: 'user1@test.com',
        displayName: 'User 1',
        isBanned: false,
      } as any);
      vi.mocked(db.adminAuditLog.create).mockResolvedValue({} as any);

      const result = await adminService.unbanUser(adminId, userId);

      expect(result.isBanned).toBe(false);
      expect(db.adminAuditLog.create).toHaveBeenCalled();
    });

    it('should throw BadRequestError when user is not banned', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user1',
        email: 'user1@test.com',
        isBanned: false,
      } as any);

      await expect(adminService.unbanUser('admin1', 'user1')).rejects.toThrow(BadRequestError);
    });
  });

  describe('listGames', () => {
    it('should return paginated games', async () => {
      const mockGames = [
        {
          id: 'game1',
          name: 'Test Game',
          description: null,
          status: GameStatus.ACTIVE,
          currentPhase: 'PROPOSAL',
          playerCount: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
          startedAt: new Date(),
          completedAt: null,
          creator: { id: '1', email: 'user1@test.com', displayName: 'User 1' },
          _count: { rounds: 1, actions: 2 },
        },
      ];
      vi.mocked(db.game.findMany).mockResolvedValue(mockGames);
      vi.mocked(db.game.count).mockResolvedValue(1);

      const result = await adminService.listGames({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });

      expect(result.games).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('deleteGame', () => {
    it('should delete a game', async () => {
      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game1',
        name: 'Test Game',
        status: GameStatus.LOBBY,
        creatorId: 'user1',
        playerCount: 1,
        deletedAt: null,
      } as any);
      vi.mocked(db.game.update).mockResolvedValue({} as any);
      vi.mocked(db.adminAuditLog.create).mockResolvedValue({} as any);

      const result = await adminService.deleteGame('admin1', 'game1');

      expect(result.success).toBe(true);
      expect(db.game.update).toHaveBeenCalledWith({
        where: { id: 'game1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(db.adminAuditLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent game', async () => {
      vi.mocked(db.game.findUnique).mockResolvedValue(null);

      await expect(adminService.deleteGame('admin1', 'non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('pauseGame', () => {
    it('should pause an active game', async () => {
      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game1',
        name: 'Test Game',
        status: GameStatus.ACTIVE,
      } as any);
      vi.mocked(db.game.update).mockResolvedValue({
        id: 'game1',
        name: 'Test Game',
        status: GameStatus.PAUSED,
      } as any);
      vi.mocked(db.adminAuditLog.create).mockResolvedValue({} as any);

      const result = await adminService.pauseGame('admin1', 'game1');

      expect(result.status).toBe(GameStatus.PAUSED);
    });

    it('should throw BadRequestError when game is not active', async () => {
      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game1',
        name: 'Test Game',
        status: GameStatus.LOBBY,
      } as any);

      await expect(adminService.pauseGame('admin1', 'game1')).rejects.toThrow(BadRequestError);
    });
  });

  describe('resumeGame', () => {
    it('should resume a paused game', async () => {
      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game1',
        name: 'Test Game',
        status: GameStatus.PAUSED,
      } as any);
      vi.mocked(db.game.update).mockResolvedValue({
        id: 'game1',
        name: 'Test Game',
        status: GameStatus.ACTIVE,
      } as any);
      vi.mocked(db.adminAuditLog.create).mockResolvedValue({} as any);

      const result = await adminService.resumeGame('admin1', 'game1');

      expect(result.status).toBe(GameStatus.ACTIVE);
    });

    it('should throw BadRequestError when game is not paused', async () => {
      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game1',
        name: 'Test Game',
        status: GameStatus.ACTIVE,
      } as any);

      await expect(adminService.resumeGame('admin1', 'game1')).rejects.toThrow(BadRequestError);
    });
  });

  describe('removePlayerFromGame', () => {
    it('should remove an active player from a game', async () => {
      vi.mocked(db.gamePlayer.findUnique).mockResolvedValue({
        id: 'player1',
        gameId: 'game1',
        userId: 'user1',
        playerName: 'Player 1',
        isActive: true,
        user: { email: 'user1@test.com', displayName: 'User 1' },
        game: { id: 'game1', name: 'Test Game', playerCount: 3 },
      } as any);
      vi.mocked(db.gamePlayer.update).mockResolvedValue({} as any);
      vi.mocked(db.game.update).mockResolvedValue({} as any);
      vi.mocked(db.adminAuditLog.create).mockResolvedValue({} as any);

      const result = await adminService.removePlayerFromGame('admin1', 'game1', 'player1');

      expect(result.success).toBe(true);
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'player1' },
        data: { isActive: false },
      });
    });

    it('should throw BadRequestError when player is not in the specified game', async () => {
      vi.mocked(db.gamePlayer.findUnique).mockResolvedValue({
        id: 'player1',
        gameId: 'game2', // Different game
        isActive: true,
        user: { email: 'user1@test.com', displayName: 'User 1' },
        game: { id: 'game2', name: 'Other Game', playerCount: 3 },
      } as any);

      await expect(
        adminService.removePlayerFromGame('admin1', 'game1', 'player1')
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when player is already inactive', async () => {
      vi.mocked(db.gamePlayer.findUnique).mockResolvedValue({
        id: 'player1',
        gameId: 'game1',
        isActive: false,
        user: { email: 'user1@test.com', displayName: 'User 1' },
        game: { id: 'game1', name: 'Test Game', playerCount: 2 },
      } as any);

      await expect(
        adminService.removePlayerFromGame('admin1', 'game1', 'player1')
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('listAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      const mockLogs = [
        {
          id: 'log1',
          adminId: 'admin1',
          action: 'BAN_USER',
          targetType: 'USER',
          targetId: 'user1',
          details: {},
          ipAddress: '127.0.0.1',
          createdAt: new Date(),
          admin: { id: 'admin1', email: 'admin@test.com', displayName: 'Admin' },
        },
      ];
      vi.mocked(db.adminAuditLog.findMany).mockResolvedValue(mockLogs);
      vi.mocked(db.adminAuditLog.count).mockResolvedValue(1);

      const result = await adminService.listAuditLogs({ page: 1, limit: 50 });

      expect(result.logs).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });
});
