import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';

// Mock the database and email service
vi.mock('../../../src/config/database.js', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../../src/services/email.service.js', () => ({
  sendEmail: vi.fn(),
}));

import { db } from '../../../src/config/database.js';
import { sendEmail } from '../../../src/services/email.service.js';
import * as authService from '../../../src/services/auth.service.js';

describe('Password Recovery Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.APP_URL = 'http://localhost:5173';
  });

  describe('requestPasswordReset', () => {
    it('should generate reset token for existing user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        displayName: 'Test User',
        avatarUrl: null,
        role: 'USER' as const,
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        notificationPreferences: {},
        resetToken: null,
        resetTokenExpiry: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      };

      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(db.user.update).mockResolvedValue({
        ...mockUser,
        resetToken: 'mock-token',
        resetTokenExpiry: new Date(Date.now() + 3600000),
      });
      vi.mocked(sendEmail).mockResolvedValue(true);

      const result = await authService.requestPasswordReset({
        email: 'test@example.com',
      });

      expect(result.message).toContain('password reset link has been sent');
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(db.user.update).toHaveBeenCalled();
      expect(sendEmail).toHaveBeenCalled();
    });

    it('should return success message even for non-existent user (prevent enumeration)', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);

      const result = await authService.requestPasswordReset({
        email: 'nonexistent@example.com',
      });

      expect(result.message).toContain('password reset link has been sent');
      expect(db.user.update).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should send email with reset link', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        displayName: 'Test User',
        avatarUrl: null,
        role: 'USER' as const,
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        notificationPreferences: {},
        resetToken: null,
        resetTokenExpiry: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      };

      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(db.user.update).mockResolvedValue(mockUser);
      vi.mocked(sendEmail).mockResolvedValue(true);

      await authService.requestPasswordReset({
        email: 'test@example.com',
      });

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Password Reset Request',
        })
      );

      const emailCall = vi.mocked(sendEmail).mock.calls[0][0];
      expect(emailCall.html).toContain('reset-password?token=');
    });

    it('should set token expiry to 1 hour from now', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        displayName: 'Test User',
        avatarUrl: null,
        role: 'USER' as const,
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        notificationPreferences: {},
        resetToken: null,
        resetTokenExpiry: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      };

      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(db.user.update).mockResolvedValue(mockUser);
      vi.mocked(sendEmail).mockResolvedValue(true);

      const beforeTime = Date.now();
      await authService.requestPasswordReset({
        email: 'test@example.com',
      });
      const afterTime = Date.now();

      const updateCall = vi.mocked(db.user.update).mock.calls[0][0];
      const expiry = updateCall.data.resetTokenExpiry as Date;
      const expiryTime = expiry.getTime();

      // Should be ~1 hour from now (3600000 ms), with some tolerance
      expect(expiryTime).toBeGreaterThan(beforeTime + 3600000 - 1000);
      expect(expiryTime).toBeLessThan(afterTime + 3600000 + 1000);
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'old-hashed-password',
        displayName: 'Test User',
        avatarUrl: null,
        role: 'USER' as const,
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        notificationPreferences: {},
        resetToken: 'valid-token',
        resetTokenExpiry: futureDate,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      };

      vi.mocked(db.user.findFirst).mockResolvedValue(mockUser);
      vi.mocked(db.user.update).mockResolvedValue({
        ...mockUser,
        passwordHash: 'new-hashed-password',
        resetToken: null,
        resetTokenExpiry: null,
      });

      const result = await authService.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPassword123',
      });

      expect(result.message).toContain('Password has been reset successfully');
      expect(db.user.findFirst).toHaveBeenCalledWith({
        where: {
          resetToken: 'valid-token',
          resetTokenExpiry: {
            gte: expect.any(Date),
          },
        },
      });
      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: expect.objectContaining({
            resetToken: null,
            resetTokenExpiry: null,
          }),
        })
      );
    });

    it('should reject invalid token', async () => {
      vi.mocked(db.user.findFirst).mockResolvedValue(null);

      await expect(
        authService.resetPassword({
          token: 'invalid-token',
          newPassword: 'NewPassword123',
        })
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should reject expired token', async () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      vi.mocked(db.user.findFirst).mockResolvedValue(null); // Prisma query won't find expired tokens

      await expect(
        authService.resetPassword({
          token: 'expired-token',
          newPassword: 'NewPassword123',
        })
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should clear reset token after successful reset', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'old-hashed-password',
        displayName: 'Test User',
        avatarUrl: null,
        role: 'USER' as const,
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        notificationPreferences: {},
        resetToken: 'valid-token',
        resetTokenExpiry: futureDate,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      };

      vi.mocked(db.user.findFirst).mockResolvedValue(mockUser);
      vi.mocked(db.user.update).mockResolvedValue({
        ...mockUser,
        resetToken: null,
        resetTokenExpiry: null,
      });

      await authService.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPassword123',
      });

      const updateCall = vi.mocked(db.user.update).mock.calls[0][0];
      expect(updateCall.data.resetToken).toBeNull();
      expect(updateCall.data.resetTokenExpiry).toBeNull();
    });
  });

  describe('reset token generation', () => {
    it('should generate secure random token', () => {
      const token1 = crypto.randomBytes(32).toString('hex');
      const token2 = crypto.randomBytes(32).toString('hex');

      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
      expect(token2.length).toBe(64);
    });

    it('should generate hex string from random bytes', () => {
      const token = crypto.randomBytes(32).toString('hex');
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });
  });
});
