import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../../../src/config/database.js', () => ({
  db: {
    gamePlayer: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock the email service
vi.mock('../../../src/services/email.service.js', () => ({
  sendGameStartedEmail: vi.fn().mockResolvedValue(true),
  sendActionProposedEmail: vi.fn().mockResolvedValue(true),
  sendVotingStartedEmail: vi.fn().mockResolvedValue(true),
  sendResolutionReadyEmail: vi.fn().mockResolvedValue(true),
  sendNarrationNeededEmail: vi.fn().mockResolvedValue(true),
  sendRoundSummaryNeededEmail: vi.fn().mockResolvedValue(true),
  sendNewRoundEmail: vi.fn().mockResolvedValue(true),
  sendTimeoutWarningEmail: vi.fn().mockResolvedValue(true),
  sendTimeoutOccurredEmail: vi.fn().mockResolvedValue(true),
  sendYourTurnEmail: vi.fn().mockResolvedValue(true),
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  getNotificationPreferences,
  notifyGameStarted,
  notifyActionProposed,
  notifyVotingStarted,
  notifyResolutionReady,
  notifyYourTurn,
} from '../../../src/services/notification.service.js';
import { db } from '../../../src/config/database.js';
import * as emailService from '../../../src/services/email.service.js';

describe('Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNotificationPreferences', () => {
    it('should return default preferences when user prefs is null', () => {
      const prefs = getNotificationPreferences(null);

      expect(prefs.emailEnabled).toBe(true);
      expect(prefs.gameStarted).toBe(true);
      expect(prefs.actionProposed).toBe(true);
      expect(prefs.votingStarted).toBe(true);
      expect(prefs.resolutionReady).toBe(true);
      expect(prefs.roundSummaryNeeded).toBe(true);
      expect(prefs.newRound).toBe(true);
      expect(prefs.timeoutWarnings).toBe(false);
      expect(prefs.yourTurn).toBe(true);
    });

    it('should return default preferences when user prefs is empty', () => {
      const prefs = getNotificationPreferences({});

      expect(prefs.emailEnabled).toBe(true);
      expect(prefs.gameStarted).toBe(true);
    });

    it('should respect disabled preferences', () => {
      const prefs = getNotificationPreferences({
        emailEnabled: false,
        gameStarted: false,
        actionProposed: true,
      });

      expect(prefs.emailEnabled).toBe(false);
      expect(prefs.gameStarted).toBe(false);
      expect(prefs.actionProposed).toBe(true);
    });
  });

  describe('notifyGameStarted', () => {
    it('should send emails to all players with enabled notifications', async () => {
      vi.mocked(db.gamePlayer.findMany).mockResolvedValue([
        {
          id: 'player-1',
          userId: 'user-1',
          user: {
            id: 'user-1',
            email: 'user1@example.com',
            displayName: 'User 1',
            notificationPreferences: { emailEnabled: true, gameStarted: true },
          },
        },
        {
          id: 'player-2',
          userId: 'user-2',
          user: {
            id: 'user-2',
            email: 'user2@example.com',
            displayName: 'User 2',
            notificationPreferences: { emailEnabled: true, gameStarted: true },
          },
        },
      ] as any);

      await notifyGameStarted('game-1', 'Test Game');

      expect(emailService.sendGameStartedEmail).toHaveBeenCalledTimes(2);
      expect(emailService.sendGameStartedEmail).toHaveBeenCalledWith(
        'user1@example.com',
        'Test Game',
        'game-1'
      );
      expect(emailService.sendGameStartedEmail).toHaveBeenCalledWith(
        'user2@example.com',
        'Test Game',
        'game-1'
      );
    });

    it('should not send email if emailEnabled is false', async () => {
      vi.mocked(db.gamePlayer.findMany).mockResolvedValue([
        {
          id: 'player-1',
          userId: 'user-1',
          user: {
            id: 'user-1',
            email: 'user1@example.com',
            displayName: 'User 1',
            notificationPreferences: { emailEnabled: false },
          },
        },
      ] as any);

      await notifyGameStarted('game-1', 'Test Game');

      expect(emailService.sendGameStartedEmail).not.toHaveBeenCalled();
    });

    it('should not send email if gameStarted preference is false', async () => {
      vi.mocked(db.gamePlayer.findMany).mockResolvedValue([
        {
          id: 'player-1',
          userId: 'user-1',
          user: {
            id: 'user-1',
            email: 'user1@example.com',
            displayName: 'User 1',
            notificationPreferences: { emailEnabled: true, gameStarted: false },
          },
        },
      ] as any);

      await notifyGameStarted('game-1', 'Test Game');

      expect(emailService.sendGameStartedEmail).not.toHaveBeenCalled();
    });
  });

  describe('notifyActionProposed', () => {
    it('should send emails to all players except initiator', async () => {
      vi.mocked(db.gamePlayer.findMany).mockResolvedValue([
        {
          id: 'player-1',
          userId: 'user-1',
          user: {
            id: 'user-1',
            email: 'initiator@example.com',
            displayName: 'Initiator',
            notificationPreferences: {},
          },
        },
        {
          id: 'player-2',
          userId: 'user-2',
          user: {
            id: 'user-2',
            email: 'player2@example.com',
            displayName: 'Player 2',
            notificationPreferences: {},
          },
        },
        {
          id: 'player-3',
          userId: 'user-3',
          user: {
            id: 'user-3',
            email: 'player3@example.com',
            displayName: 'Player 3',
            notificationPreferences: {},
          },
        },
      ] as any);

      await notifyActionProposed(
        'game-1',
        'Test Game',
        'user-1', // initiator
        'Initiator',
        'Propose an action'
      );

      // Should only send to user-2 and user-3, not user-1 (initiator)
      expect(emailService.sendActionProposedEmail).toHaveBeenCalledTimes(2);
      expect(emailService.sendActionProposedEmail).not.toHaveBeenCalledWith(
        'initiator@example.com',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('notifyVotingStarted', () => {
    it('should send emails to all players', async () => {
      vi.mocked(db.gamePlayer.findMany).mockResolvedValue([
        {
          id: 'player-1',
          userId: 'user-1',
          user: {
            id: 'user-1',
            email: 'user1@example.com',
            displayName: 'User 1',
            notificationPreferences: {},
          },
        },
      ] as any);

      await notifyVotingStarted('game-1', 'Test Game', 'Test action');

      expect(emailService.sendVotingStartedEmail).toHaveBeenCalledTimes(1);
      expect(emailService.sendVotingStartedEmail).toHaveBeenCalledWith(
        'user1@example.com',
        'Test Game',
        'game-1',
        'Test action'
      );
    });
  });

  describe('notifyResolutionReady', () => {
    it('should send email only to the initiator', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'initiator@example.com',
        notificationPreferences: { emailEnabled: true, resolutionReady: true },
      } as any);

      await notifyResolutionReady(
        'game-1',
        'Test Game',
        'user-1',
        'Test action'
      );

      expect(emailService.sendResolutionReadyEmail).toHaveBeenCalledTimes(1);
      expect(emailService.sendResolutionReadyEmail).toHaveBeenCalledWith(
        'initiator@example.com',
        'Test Game',
        'game-1',
        'Test action'
      );
    });

    it('should not send email if user not found', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);

      await notifyResolutionReady(
        'game-1',
        'Test Game',
        'non-existent',
        'Test action'
      );

      expect(emailService.sendResolutionReadyEmail).not.toHaveBeenCalled();
    });
  });

  describe('notifyYourTurn', () => {
    it('should send your-turn emails to specified players', async () => {
      vi.mocked(db.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'user1@example.com',
          notificationPreferences: {},
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          notificationPreferences: {},
        },
      ] as any);

      await notifyYourTurn(
        'game-1',
        'Test Game',
        ['user-1', 'user-2'],
        'propose an action'
      );

      expect(emailService.sendYourTurnEmail).toHaveBeenCalledTimes(2);
      expect(emailService.sendYourTurnEmail).toHaveBeenCalledWith(
        'user1@example.com',
        'Test Game',
        'game-1',
        'propose an action'
      );
      expect(emailService.sendYourTurnEmail).toHaveBeenCalledWith(
        'user2@example.com',
        'Test Game',
        'game-1',
        'propose an action'
      );
    });

    it('should not send email if yourTurn preference is false', async () => {
      vi.mocked(db.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'user1@example.com',
          notificationPreferences: { yourTurn: false },
        },
      ] as any);

      await notifyYourTurn(
        'game-1',
        'Test Game',
        ['user-1'],
        'cast your vote'
      );

      expect(emailService.sendYourTurnEmail).not.toHaveBeenCalled();
    });

    it('should not send email if emailEnabled is false', async () => {
      vi.mocked(db.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'user1@example.com',
          notificationPreferences: { emailEnabled: false },
        },
      ] as any);

      await notifyYourTurn(
        'game-1',
        'Test Game',
        ['user-1'],
        'draw tokens'
      );

      expect(emailService.sendYourTurnEmail).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(db.gamePlayer.findMany).mockRejectedValue(
        new Error('Database error')
      );

      // Should not throw
      await expect(
        notifyGameStarted('game-1', 'Test Game')
      ).resolves.not.toThrow();
    });

    it('should handle email sending errors gracefully', async () => {
      vi.mocked(db.gamePlayer.findMany).mockResolvedValue([
        {
          id: 'player-1',
          userId: 'user-1',
          user: {
            id: 'user-1',
            email: 'user1@example.com',
            displayName: 'User 1',
            notificationPreferences: {},
          },
        },
      ] as any);

      vi.mocked(emailService.sendGameStartedEmail).mockRejectedValue(
        new Error('SMTP error')
      );

      // Should not throw
      await expect(
        notifyGameStarted('game-1', 'Test Game')
      ).resolves.not.toThrow();
    });
  });
});
