import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Module exports', () => {
    it('should export initializeEmailService function', async () => {
      const { initializeEmailService } = await import(
        '../../../src/services/email.service.js'
      );
      expect(typeof initializeEmailService).toBe('function');
    });

    it('should export sendEmail function', async () => {
      const { sendEmail } = await import(
        '../../../src/services/email.service.js'
      );
      expect(typeof sendEmail).toBe('function');
    });

    it('should export sendGameInviteEmail function', async () => {
      const { sendGameInviteEmail } = await import(
        '../../../src/services/email.service.js'
      );
      expect(typeof sendGameInviteEmail).toBe('function');
    });

    it('should export sendGameStartedEmail function', async () => {
      const { sendGameStartedEmail } = await import(
        '../../../src/services/email.service.js'
      );
      expect(typeof sendGameStartedEmail).toBe('function');
    });

    it('should export sendActionProposedEmail function', async () => {
      const { sendActionProposedEmail } = await import(
        '../../../src/services/email.service.js'
      );
      expect(typeof sendActionProposedEmail).toBe('function');
    });

    it('should export sendVotingStartedEmail function', async () => {
      const { sendVotingStartedEmail } = await import(
        '../../../src/services/email.service.js'
      );
      expect(typeof sendVotingStartedEmail).toBe('function');
    });

    it('should export sendResolutionReadyEmail function', async () => {
      const { sendResolutionReadyEmail } = await import(
        '../../../src/services/email.service.js'
      );
      expect(typeof sendResolutionReadyEmail).toBe('function');
    });

    it('should export sendNarrationNeededEmail function', async () => {
      const { sendNarrationNeededEmail } = await import(
        '../../../src/services/email.service.js'
      );
      expect(typeof sendNarrationNeededEmail).toBe('function');
    });

    it('should export sendRoundSummaryNeededEmail function', async () => {
      const { sendRoundSummaryNeededEmail } = await import(
        '../../../src/services/email.service.js'
      );
      expect(typeof sendRoundSummaryNeededEmail).toBe('function');
    });

    it('should export sendNewRoundEmail function', async () => {
      const { sendNewRoundEmail } = await import(
        '../../../src/services/email.service.js'
      );
      expect(typeof sendNewRoundEmail).toBe('function');
    });

    it('should export sendTimeoutWarningEmail function', async () => {
      const { sendTimeoutWarningEmail } = await import(
        '../../../src/services/email.service.js'
      );
      expect(typeof sendTimeoutWarningEmail).toBe('function');
    });

    it('should export sendTimeoutOccurredEmail function', async () => {
      const { sendTimeoutOccurredEmail } = await import(
        '../../../src/services/email.service.js'
      );
      expect(typeof sendTimeoutOccurredEmail).toBe('function');
    });
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
  });

  describe('sendEmail without transporter', () => {
    it('should return false when transporter is not initialized', async () => {
      const originalEnv = process.env.EMAIL_ENABLED;
      process.env.EMAIL_ENABLED = 'true';

      const { sendEmail } = await import(
        '../../../src/services/email.service.js'
      );

      // Without calling initializeEmailService, transporter is null
      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test message',
      });

      expect(result).toBe(false);

      process.env.EMAIL_ENABLED = originalEnv;
    });
  });
});
