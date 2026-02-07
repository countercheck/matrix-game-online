import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
  return { mockLogger };
});

vi.mock('../../../src/utils/logger.js', () => ({
  logger: mockLogger,
}));

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('sendEmail when disabled', () => {
    it('should return false when EMAIL_ENABLED is false', async () => {
      const originalEnv = process.env.EMAIL_ENABLED;
      process.env.EMAIL_ENABLED = 'false';

      const { sendEmail } = await import(
        '../../../src/services/email.service.js'
      );

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test message',
      });

      expect(result).toBe(false);

      process.env.EMAIL_ENABLED = originalEnv;
    });

    it('should log a debug message when email is disabled', async () => {
      const originalEnv = process.env.EMAIL_ENABLED;
      process.env.EMAIL_ENABLED = 'false';

      const { sendEmail } = await import(
        '../../../src/services/email.service.js'
      );

      await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test message',
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Test Subject')
      );

      process.env.EMAIL_ENABLED = originalEnv;
    });
  });

  describe('sendEmail without transporter', () => {
    it('should return false when transporter is not initialized', async () => {
      const originalEnv = process.env.EMAIL_ENABLED;
      process.env.EMAIL_ENABLED = 'true';

      const { sendEmail } = await import(
        '../../../src/services/email.service.js'
      );

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test message',
      });

      expect(result).toBe(false);

      process.env.EMAIL_ENABLED = originalEnv;
    });

    it('should log a warning when transporter is not initialized', async () => {
      const originalEnv = process.env.EMAIL_ENABLED;
      process.env.EMAIL_ENABLED = 'true';

      const { sendEmail } = await import(
        '../../../src/services/email.service.js'
      );

      await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test message',
      });

      expect(mockLogger.warn).toHaveBeenCalledWith('Email transporter not initialized');

      process.env.EMAIL_ENABLED = originalEnv;
    });
  });

  describe('initializeEmailService when disabled', () => {
    it('should log that email is disabled and return without creating transporter', async () => {
      const originalEnv = process.env.EMAIL_ENABLED;
      process.env.EMAIL_ENABLED = 'false';

      const { initializeEmailService, sendEmail } = await import(
        '../../../src/services/email.service.js'
      );

      await initializeEmailService();

      expect(mockLogger.info).toHaveBeenCalledWith('Email service disabled');

      // Sending should still return false
      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
      });
      expect(result).toBe(false);

      process.env.EMAIL_ENABLED = originalEnv;
    });
  });

  describe('email template functions', () => {
    it('should return false from template functions when email is disabled', async () => {
      const originalEnv = process.env.EMAIL_ENABLED;
      process.env.EMAIL_ENABLED = 'false';

      const { sendGameInviteEmail, sendGameStartedEmail } = await import(
        '../../../src/services/email.service.js'
      );

      const inviteResult = await sendGameInviteEmail(
        'test@example.com', 'Test Game', 'Host', 'game-1'
      );
      expect(inviteResult).toBe(false);

      const startResult = await sendGameStartedEmail(
        'test@example.com', 'Test Game', 'game-1'
      );
      expect(startResult).toBe(false);

      process.env.EMAIL_ENABLED = originalEnv;
    });
  });
});
