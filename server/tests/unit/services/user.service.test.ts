import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    gamePlayer: {
      findMany: vi.fn(),
    },
  };
  return { mockDb };
});

vi.mock('../../../src/config/database.js', () => ({
  db: mockDb,
}));

vi.mock('../../../src/middleware/errorHandler.js', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
}));

import {
  getProfile,
  updateProfile,
  getUserGames,
  updateNotificationPreferences,
} from '../../../src/services/user.service.js';

describe('User Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile when user exists', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        notificationPreferences: { email: true, inApp: true },
        createdAt: new Date('2024-01-01'),
        lastLogin: new Date('2024-01-15'),
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser);

      const result = await getProfile('user-123');

      expect(result).toEqual(mockUser);
      expect(mockDb.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          notificationPreferences: true,
          createdAt: true,
          lastLogin: true,
        },
      });
    });

    it('should throw NotFoundError when user does not exist', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      await expect(getProfile('nonexistent')).rejects.toThrow('User not found');
    });

    it('should not include password hash in the select', async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: 'user-123' });

      await getProfile('user-123');

      const selectArg = mockDb.user.findUnique.mock.calls[0][0].select;
      expect(selectArg).not.toHaveProperty('passwordHash');
    });
  });

  describe('updateProfile', () => {
    it('should update display name', async () => {
      const mockUpdated = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'New Name',
        avatarUrl: null,
        notificationPreferences: {},
      };
      mockDb.user.update.mockResolvedValue(mockUpdated);

      const result = await updateProfile('user-123', { displayName: 'New Name' });

      expect(result.displayName).toBe('New Name');
      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { displayName: 'New Name', avatarUrl: undefined },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          notificationPreferences: true,
        },
      });
    });

    it('should update avatar URL', async () => {
      mockDb.user.update.mockResolvedValue({
        id: 'user-123',
        avatarUrl: 'https://example.com/new.jpg',
      });

      const result = await updateProfile('user-123', {
        avatarUrl: 'https://example.com/new.jpg',
      });

      expect(result.avatarUrl).toBe('https://example.com/new.jpg');
    });

    it('should allow setting avatar URL to null', async () => {
      mockDb.user.update.mockResolvedValue({ id: 'user-123', avatarUrl: null });

      const result = await updateProfile('user-123', { avatarUrl: null });

      expect(result.avatarUrl).toBeNull();
    });

    it('should update both fields at once', async () => {
      mockDb.user.update.mockResolvedValue({
        id: 'user-123',
        displayName: 'New Name',
        avatarUrl: 'https://example.com/new.jpg',
      });

      await updateProfile('user-123', {
        displayName: 'New Name',
        avatarUrl: 'https://example.com/new.jpg',
      });

      expect(mockDb.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            displayName: 'New Name',
            avatarUrl: 'https://example.com/new.jpg',
          },
        })
      );
    });
  });

  describe('getUserGames', () => {
    it('should return empty array when user has no games', async () => {
      mockDb.gamePlayer.findMany.mockResolvedValue([]);

      const result = await getUserGames('user-123');

      expect(result).toEqual([]);
    });

    it('should query active memberships ordered by updatedAt desc', async () => {
      mockDb.gamePlayer.findMany.mockResolvedValue([]);

      await getUserGames('user-123');

      expect(mockDb.gamePlayer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', isActive: true },
          orderBy: { game: { updatedAt: 'desc' } },
        })
      );
    });

    it('should map game players to simplified game objects', async () => {
      mockDb.gamePlayer.findMany.mockResolvedValue([
        {
          id: 'gp-1',
          playerName: 'Player One',
          isHost: true,
          game: {
            id: 'game-1',
            name: 'Test Game',
            description: 'A test',
            status: 'ACTIVE',
            currentPhase: 'PROPOSAL',
            currentRound: { roundNumber: 2 },
            currentAction: null,
            updatedAt: new Date('2024-01-15'),
            _count: { players: 3 },
          },
        },
      ]);

      const result = await getUserGames('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'game-1',
        name: 'Test Game',
        description: 'A test',
        status: 'ACTIVE',
        currentPhase: 'PROPOSAL',
        playerCount: 3,
        playerName: 'Player One',
        isHost: true,
        currentRound: 2,
        updatedAt: new Date('2024-01-15'),
      });
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should throw NotFoundError when user does not exist', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      await expect(
        updateNotificationPreferences('nonexistent', { emailEnabled: false })
      ).rejects.toThrow('User not found');
    });

    it('should merge new preferences with existing ones', async () => {
      mockDb.user.findUnique.mockResolvedValue({
        notificationPreferences: { emailEnabled: true, gameStarted: true },
      });
      mockDb.user.update.mockResolvedValue({});

      await updateNotificationPreferences('user-123', { emailEnabled: false });

      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          notificationPreferences: {
            emailEnabled: false,
            gameStarted: true,
          },
        },
      });
    });

    it('should handle null existing preferences', async () => {
      mockDb.user.findUnique.mockResolvedValue({
        notificationPreferences: null,
      });
      mockDb.user.update.mockResolvedValue({});

      const result = await updateNotificationPreferences('user-123', {
        emailEnabled: true,
      });

      expect(result).toEqual({ emailEnabled: true });
    });

    it('should return the merged preferences', async () => {
      mockDb.user.findUnique.mockResolvedValue({
        notificationPreferences: { emailEnabled: true },
      });
      mockDb.user.update.mockResolvedValue({});

      const result = await updateNotificationPreferences('user-123', {
        gameStarted: false,
      });

      expect(result).toEqual({ emailEnabled: true, gameStarted: false });
    });
  });
});
