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
  sendPasswordResetEmail: vi.fn(),
}));

import { db } from '../../../src/config/database.js';
import { sendPasswordResetEmail } from '../../../src/services/email.service.js';
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
        resetToken: 'mock-token-hash',
        resetTokenExpiry: new Date(Date.now() + 3600000),
      });
      vi.mocked(sendPasswordResetEmail).mockResolvedValue(true);

      const result = await authService.requestPasswordReset({
        email: 'test@example.com',
      });

      expect(result.message).toContain('password reset link has been sent');
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: {
          id: true,
          email: true,
        },
      });
      expect(db.user.update).toHaveBeenCalled();
      expect(sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should return success message even for non-existent user (prevent enumeration)', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);

      const result = await authService.requestPasswordReset({
        email: 'nonexistent@example.com',
      });

      expect(result.message).toContain('password reset link has been sent');
      expect(db.user.update).not.toHaveBeenCalled();
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should send email with reset link', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(db.user.update).mockResolvedValue(mockUser as any);
      vi.mocked(sendPasswordResetEmail).mockResolvedValue(true);

      await authService.requestPasswordReset({
        email: 'test@example.com',
      });

      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('reset-password?token=')
      );
    });

    it('should set token expiry to 1 hour from now', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(db.user.update).mockResolvedValue(mockUser as any);
      vi.mocked(sendPasswordResetEmail).mockResolvedValue(true);

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
      // The token hash that would be stored in DB
      const tokenHash = crypto.createHash('sha256').update('valid-token').digest('hex');

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
        resetToken: tokenHash,
        resetTokenExpiry: futureDate,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      };

      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
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
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: {
          resetToken: tokenHash,
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
      vi.mocked(db.user.findUnique).mockResolvedValue(null);

      await expect(
        authService.resetPassword({
          token: 'invalid-token',
          newPassword: 'NewPassword123',
        })
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should reject expired token', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null); // Prisma query won't find expired tokens

      await expect(
        authService.resetPassword({
          token: 'expired-token',
          newPassword: 'NewPassword123',
        })
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should clear reset token after successful reset', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      const tokenHash = crypto.createHash('sha256').update('valid-token').digest('hex');

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
        resetToken: tokenHash,
        resetTokenExpiry: futureDate,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      };

      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
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
});
