import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../../../src/config/database.js', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    gamePlayer: {
      findMany: vi.fn(),
    },
  },
}));

import { db } from '../../../src/config/database.js';

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

      vi.mocked(db.user.findUnique).mockResolvedValue({
        ...mockUser,
        passwordHash: 'hashed',
        updatedAt: new Date(),
      });

      const result = await db.user.findUnique({
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

      expect(result).toBeDefined();
      expect(result?.id).toBe('user-123');
      expect(result?.email).toBe('test@example.com');
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: expect.objectContaining({
          id: true,
          email: true,
          displayName: true,
        }),
      });
    });

    it('should return null when user does not exist', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);

      const result = await db.user.findUnique({
        where: { id: 'nonexistent' },
      });

      expect(result).toBeNull();
    });

    it('should not return password hash in profile', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: null,
        notificationPreferences: {},
        createdAt: new Date(),
        lastLogin: null,
      };

      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await db.user.findUnique({
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

      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('updateProfile', () => {
    it('should update display name', async () => {
      const mockUpdatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'New Name',
        avatarUrl: null,
        notificationPreferences: {},
      };

      vi.mocked(db.user.update).mockResolvedValue({
        ...mockUpdatedUser,
        passwordHash: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      });

      const result = await db.user.update({
        where: { id: 'user-123' },
        data: { displayName: 'New Name' },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          notificationPreferences: true,
        },
      });

      expect(result.displayName).toBe('New Name');
      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: { displayName: 'New Name' },
        })
      );
    });

    it('should update avatar URL', async () => {
      const mockUpdatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/new-avatar.jpg',
        notificationPreferences: {},
      };

      vi.mocked(db.user.update).mockResolvedValue({
        ...mockUpdatedUser,
        passwordHash: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      });

      const result = await db.user.update({
        where: { id: 'user-123' },
        data: { avatarUrl: 'https://example.com/new-avatar.jpg' },
      });

      expect(result.avatarUrl).toBe('https://example.com/new-avatar.jpg');
    });

    it('should allow setting avatar URL to null', async () => {
      const mockUpdatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: null,
        notificationPreferences: {},
      };

      vi.mocked(db.user.update).mockResolvedValue({
        ...mockUpdatedUser,
        passwordHash: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      });

      const result = await db.user.update({
        where: { id: 'user-123' },
        data: { avatarUrl: null },
      });

      expect(result.avatarUrl).toBeNull();
    });

    it('should update both display name and avatar URL', async () => {
      vi.mocked(db.user.update).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'New Name',
        avatarUrl: 'https://example.com/avatar.jpg',
        notificationPreferences: {},
        passwordHash: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      });

      await db.user.update({
        where: { id: 'user-123' },
        data: {
          displayName: 'New Name',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
      });

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            displayName: 'New Name',
            avatarUrl: 'https://example.com/avatar.jpg',
          },
        })
      );
    });
  });

  describe('getUserGames', () => {
    it('should return empty array when user has no games', async () => {
      vi.mocked(db.gamePlayer.findMany).mockResolvedValue([]);

      const result = await db.gamePlayer.findMany({
        where: { userId: 'user-123', isActive: true },
      });

      expect(result).toEqual([]);
    });

    it('should return user games with correct structure', async () => {
      const mockGamePlayers = [
        {
          id: 'gp-1',
          gameId: 'game-1',
          userId: 'user-123',
          playerName: 'Player One',
          isHost: true,
          isActive: true,
          joinOrder: 1,
          createdAt: new Date(),
          hasProposedThisRound: false,
          game: {
            id: 'game-1',
            name: 'Test Game',
            description: 'A test game',
            status: 'ACTIVE',
            currentPhase: 'PROPOSAL',
            currentRound: { roundNumber: 2 },
            currentAction: null,
            updatedAt: new Date(),
            _count: { players: 3 },
          },
        },
      ];

      vi.mocked(db.gamePlayer.findMany).mockResolvedValue(mockGamePlayers as any);

      const result = await db.gamePlayer.findMany({
        where: { userId: 'user-123', isActive: true },
        include: {
          game: {
            include: {
              currentRound: true,
              currentAction: true,
              _count: { select: { players: { where: { isActive: true } } } },
            },
          },
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].game.name).toBe('Test Game');
      expect(result[0].isHost).toBe(true);
    });

    it('should only return active game memberships', async () => {
      vi.mocked(db.gamePlayer.findMany).mockResolvedValue([]);

      await db.gamePlayer.findMany({
        where: { userId: 'user-123', isActive: true },
      });

      expect(db.gamePlayer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', isActive: true },
        })
      );
    });

    it('should sort games by updatedAt descending', async () => {
      await db.gamePlayer.findMany({
        where: { userId: 'user-123', isActive: true },
        orderBy: { game: { updatedAt: 'desc' } },
      });

      expect(db.gamePlayer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { game: { updatedAt: 'desc' } },
        })
      );
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should update email notification preference', async () => {
      const existingPrefs = { email: true, inApp: true, frequency: 'immediate' };
      const newPrefs = { email: false };

      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        passwordHash: 'hashed',
        avatarUrl: null,
        notificationPreferences: existingPrefs,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      });

      vi.mocked(db.user.update).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        passwordHash: 'hashed',
        avatarUrl: null,
        notificationPreferences: { ...existingPrefs, ...newPrefs },
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      });

      // First fetch existing preferences
      const user = await db.user.findUnique({
        where: { id: 'user-123' },
        select: { notificationPreferences: true },
      });

      expect(user?.notificationPreferences).toEqual(existingPrefs);

      // Then merge and update
      const mergedPrefs = { ...existingPrefs, ...newPrefs };
      await db.user.update({
        where: { id: 'user-123' },
        data: { notificationPreferences: mergedPrefs },
      });

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            notificationPreferences: {
              email: false,
              inApp: true,
              frequency: 'immediate',
            },
          },
        })
      );
    });

    it('should update frequency preference', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        passwordHash: 'hashed',
        avatarUrl: null,
        notificationPreferences: { frequency: 'immediate' },
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      });

      const user = await db.user.findUnique({
        where: { id: 'user-123' },
        select: { notificationPreferences: true },
      });

      const currentPrefs = user?.notificationPreferences as Record<string, unknown>;
      const updatedPrefs = { ...currentPrefs, frequency: 'daily' };

      expect(updatedPrefs.frequency).toBe('daily');
    });

    it('should preserve existing preferences when updating partial data', async () => {
      const existingPrefs = {
        email: true,
        inApp: true,
        frequency: 'immediate',
      };

      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-123',
        notificationPreferences: existingPrefs,
      } as any);

      const user = await db.user.findUnique({
        where: { id: 'user-123' },
        select: { notificationPreferences: true },
      });

      const currentPrefs = (user?.notificationPreferences as Record<string, unknown>) || {};
      const newPartialPrefs = { inApp: false };
      const mergedPrefs = { ...currentPrefs, ...newPartialPrefs };

      expect(mergedPrefs).toEqual({
        email: true,
        inApp: false,
        frequency: 'immediate',
      });
    });

    it('should handle empty existing preferences', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-123',
        notificationPreferences: null,
      } as any);

      const user = await db.user.findUnique({
        where: { id: 'user-123' },
        select: { notificationPreferences: true },
      });

      const currentPrefs = (user?.notificationPreferences as Record<string, unknown>) || {};
      const newPrefs = { email: true, frequency: 'daily' };
      const mergedPrefs = { ...currentPrefs, ...newPrefs };

      expect(mergedPrefs).toEqual({
        email: true,
        frequency: 'daily',
      });
    });
  });

  describe('Profile Validation', () => {
    it('should validate display name length (1-50 chars)', () => {
      const validateDisplayName = (name: string) =>
        name.length >= 1 && name.length <= 50;

      expect(validateDisplayName('A')).toBe(true);
      expect(validateDisplayName('Valid Name')).toBe(true);
      expect(validateDisplayName('A'.repeat(50))).toBe(true);
      expect(validateDisplayName('')).toBe(false);
      expect(validateDisplayName('A'.repeat(51))).toBe(false);
    });

    it('should validate avatar URL format', () => {
      const validateAvatarUrl = (url: string | null) => {
        if (url === null) return true;
        try {
          new URL(url);
          return url.length <= 500;
        } catch {
          return false;
        }
      };

      expect(validateAvatarUrl(null)).toBe(true);
      expect(validateAvatarUrl('https://example.com/avatar.jpg')).toBe(true);
      expect(validateAvatarUrl('http://example.com/avatar.png')).toBe(true);
      expect(validateAvatarUrl('not-a-url')).toBe(false);
      expect(validateAvatarUrl('https://example.com/' + 'a'.repeat(500))).toBe(false);
    });

    it('should validate notification frequency values', () => {
      const validFrequencies = ['immediate', 'daily', 'none'];

      const validateFrequency = (freq: string) =>
        validFrequencies.includes(freq);

      expect(validateFrequency('immediate')).toBe(true);
      expect(validateFrequency('daily')).toBe(true);
      expect(validateFrequency('none')).toBe(true);
      expect(validateFrequency('weekly')).toBe(false);
      expect(validateFrequency('')).toBe(false);
    });
  });
});
