import { db } from '../config/database.js';
import { logger } from '../utils/logger.js';
import {
  sendGameStartedEmail,
  sendActionProposedEmail,
  sendVotingStartedEmail,
  sendResolutionReadyEmail,
  sendNarrationNeededEmail,
  sendRoundSummaryNeededEmail,
  sendNewRoundEmail,
  sendTimeoutWarningEmail,
  sendTimeoutOccurredEmail,
  sendYourTurnEmail,
} from './email.service.js';

export interface NotificationPreferences {
  emailEnabled: boolean;
  gameStarted: boolean;
  actionProposed: boolean;
  votingStarted: boolean;
  resolutionReady: boolean;
  roundSummaryNeeded: boolean;
  newRound: boolean;
  timeoutWarnings: boolean;
  yourTurn: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  gameStarted: true,
  actionProposed: true,
  votingStarted: true,
  resolutionReady: true,
  roundSummaryNeeded: true,
  newRound: true,
  timeoutWarnings: false,
  yourTurn: true,
};

/**
 * Get notification preferences for a user.
 */
export function getNotificationPreferences(
  userPrefs: Record<string, unknown> | null
): NotificationPreferences {
  if (!userPrefs) {
    return DEFAULT_PREFERENCES;
  }
  return {
    emailEnabled: userPrefs.emailEnabled !== undefined ? userPrefs.emailEnabled === true : DEFAULT_PREFERENCES.emailEnabled,
    gameStarted: userPrefs.gameStarted !== undefined ? userPrefs.gameStarted === true : DEFAULT_PREFERENCES.gameStarted,
    actionProposed: userPrefs.actionProposed !== undefined ? userPrefs.actionProposed === true : DEFAULT_PREFERENCES.actionProposed,
    votingStarted: userPrefs.votingStarted !== undefined ? userPrefs.votingStarted === true : DEFAULT_PREFERENCES.votingStarted,
    resolutionReady: userPrefs.resolutionReady !== undefined ? userPrefs.resolutionReady === true : DEFAULT_PREFERENCES.resolutionReady,
    roundSummaryNeeded: userPrefs.roundSummaryNeeded !== undefined ? userPrefs.roundSummaryNeeded === true : DEFAULT_PREFERENCES.roundSummaryNeeded,
    newRound: userPrefs.newRound !== undefined ? userPrefs.newRound === true : DEFAULT_PREFERENCES.newRound,
    timeoutWarnings: userPrefs.timeoutWarnings !== undefined ? userPrefs.timeoutWarnings === true : DEFAULT_PREFERENCES.timeoutWarnings,
    yourTurn: userPrefs.yourTurn !== undefined ? userPrefs.yourTurn === true : DEFAULT_PREFERENCES.yourTurn,
  };
}

/**
 * Check if a user should receive a notification of a given type.
 */
function shouldNotify(
  prefs: NotificationPreferences,
  notificationType: keyof Omit<NotificationPreferences, 'emailEnabled'>
): boolean {
  return prefs.emailEnabled && prefs[notificationType];
}

/**
 * Get all active players in a game with their user info and preferences.
 */
async function getGamePlayersWithPrefs(gameId: string) {
  return db.gamePlayer.findMany({
    where: { gameId, isActive: true },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          notificationPreferences: true,
        },
      },
    },
  });
}

/**
 * Notify all players that a game has started.
 */
export async function notifyGameStarted(
  gameId: string,
  gameName: string
): Promise<void> {
  try {
    const players = await getGamePlayersWithPrefs(gameId);

    for (const player of players) {
      const prefs = getNotificationPreferences(
        player.user.notificationPreferences as Record<string, unknown>
      );
      if (shouldNotify(prefs, 'gameStarted')) {
        await sendGameStartedEmail(player.user.email, gameName, gameId);
      }
    }

    logger.info(`Sent game started notifications for game ${gameId}`);
  } catch (error) {
    logger.error(`Failed to send game started notifications: ${error}`);
  }
}

/**
 * Notify players (except initiator) that an action has been proposed.
 */
export async function notifyActionProposed(
  gameId: string,
  gameName: string,
  initiatorUserId: string,
  initiatorName: string,
  actionDescription: string
): Promise<void> {
  try {
    const players = await getGamePlayersWithPrefs(gameId);

    for (const player of players) {
      // Don't notify the initiator
      if (player.userId === initiatorUserId) continue;

      const prefs = getNotificationPreferences(
        player.user.notificationPreferences as Record<string, unknown>
      );
      if (shouldNotify(prefs, 'actionProposed')) {
        await sendActionProposedEmail(
          player.user.email,
          gameName,
          gameId,
          initiatorName,
          actionDescription
        );
      }
    }

    logger.info(`Sent action proposed notifications for game ${gameId}`);
  } catch (error) {
    logger.error(`Failed to send action proposed notifications: ${error}`);
  }
}

/**
 * Notify all players that voting has started.
 */
export async function notifyVotingStarted(
  gameId: string,
  gameName: string,
  actionDescription: string
): Promise<void> {
  try {
    const players = await getGamePlayersWithPrefs(gameId);

    for (const player of players) {
      const prefs = getNotificationPreferences(
        player.user.notificationPreferences as Record<string, unknown>
      );
      if (shouldNotify(prefs, 'votingStarted')) {
        await sendVotingStartedEmail(
          player.user.email,
          gameName,
          gameId,
          actionDescription
        );
      }
    }

    logger.info(`Sent voting started notifications for game ${gameId}`);
  } catch (error) {
    logger.error(`Failed to send voting started notifications: ${error}`);
  }
}

/**
 * Notify the initiator that tokens are ready to be drawn.
 */
export async function notifyResolutionReady(
  gameId: string,
  gameName: string,
  initiatorUserId: string,
  actionDescription: string
): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: initiatorUserId },
      select: { email: true, notificationPreferences: true },
    });

    if (!user) return;

    const prefs = getNotificationPreferences(
      user.notificationPreferences as Record<string, unknown>
    );
    if (shouldNotify(prefs, 'resolutionReady')) {
      await sendResolutionReadyEmail(
        user.email,
        gameName,
        gameId,
        actionDescription
      );
    }

    logger.info(`Sent resolution ready notification for game ${gameId}`);
  } catch (error) {
    logger.error(`Failed to send resolution ready notification: ${error}`);
  }
}

/**
 * Notify the initiator that narration is needed.
 */
export async function notifyNarrationNeeded(
  gameId: string,
  gameName: string,
  initiatorUserId: string,
  resultType: string,
  resultValue: number
): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: initiatorUserId },
      select: { email: true, notificationPreferences: true },
    });

    if (!user) return;

    const prefs = getNotificationPreferences(
      user.notificationPreferences as Record<string, unknown>
    );
    if (shouldNotify(prefs, 'resolutionReady')) {
      // Using resolutionReady preference for narration too
      await sendNarrationNeededEmail(
        user.email,
        gameName,
        gameId,
        resultType,
        resultValue
      );
    }

    logger.info(`Sent narration needed notification for game ${gameId}`);
  } catch (error) {
    logger.error(`Failed to send narration needed notification: ${error}`);
  }
}

/**
 * Notify players that a round summary is needed.
 */
export async function notifyRoundSummaryNeeded(
  gameId: string,
  gameName: string,
  roundNumber: number,
  actionsCompleted: number
): Promise<void> {
  try {
    const players = await getGamePlayersWithPrefs(gameId);

    for (const player of players) {
      const prefs = getNotificationPreferences(
        player.user.notificationPreferences as Record<string, unknown>
      );
      if (shouldNotify(prefs, 'roundSummaryNeeded')) {
        await sendRoundSummaryNeededEmail(
          player.user.email,
          gameName,
          gameId,
          roundNumber,
          actionsCompleted
        );
      }
    }

    logger.info(`Sent round summary needed notifications for game ${gameId}`);
  } catch (error) {
    logger.error(`Failed to send round summary needed notifications: ${error}`);
  }
}

/**
 * Notify players that a new round has started.
 */
export async function notifyNewRound(
  gameId: string,
  gameName: string,
  roundNumber: number
): Promise<void> {
  try {
    const players = await getGamePlayersWithPrefs(gameId);

    for (const player of players) {
      const prefs = getNotificationPreferences(
        player.user.notificationPreferences as Record<string, unknown>
      );
      if (shouldNotify(prefs, 'newRound')) {
        await sendNewRoundEmail(player.user.email, gameName, gameId, roundNumber);
      }
    }

    logger.info(`Sent new round notifications for game ${gameId}`);
  } catch (error) {
    logger.error(`Failed to send new round notifications: ${error}`);
  }
}

/**
 * Notify players about upcoming timeout.
 */
export async function notifyTimeoutWarning(
  gameId: string,
  gameName: string,
  phase: string,
  hoursRemaining: number,
  playerUserIds: string[]
): Promise<void> {
  try {
    const users = await db.user.findMany({
      where: { id: { in: playerUserIds } },
      select: { id: true, email: true, notificationPreferences: true },
    });

    for (const user of users) {
      const prefs = getNotificationPreferences(
        user.notificationPreferences as Record<string, unknown>
      );
      if (shouldNotify(prefs, 'timeoutWarnings')) {
        await sendTimeoutWarningEmail(
          user.email,
          gameName,
          gameId,
          phase,
          hoursRemaining
        );
      }
    }

    logger.info(`Sent timeout warning notifications for game ${gameId}`);
  } catch (error) {
    logger.error(`Failed to send timeout warning notifications: ${error}`);
  }
}

/**
 * Notify players that a timeout occurred.
 */
export async function notifyTimeoutOccurred(
  gameId: string,
  gameName: string,
  phase: string,
  autoVotedUserIds: string[]
): Promise<void> {
  try {
    const players = await getGamePlayersWithPrefs(gameId);

    for (const player of players) {
      const prefs = getNotificationPreferences(
        player.user.notificationPreferences as Record<string, unknown>
      );
      if (shouldNotify(prefs, 'timeoutWarnings')) {
        const wasAutoVoted = autoVotedUserIds.includes(player.userId);
        await sendTimeoutOccurredEmail(
          player.user.email,
          gameName,
          gameId,
          phase,
          wasAutoVoted
        );
      }
    }

    logger.info(`Sent timeout occurred notifications for game ${gameId}`);
  } catch (error) {
    logger.error(`Failed to send timeout occurred notifications: ${error}`);
  }
}

/**
 * Notify specific players that it's their turn to act.
 * turnAction should describe what they need to do (e.g. "propose an action", "cast your vote").
 */
export async function notifyYourTurn(
  gameId: string,
  gameName: string,
  playerUserIds: string[],
  turnAction: string
): Promise<void> {
  try {
    const users = await db.user.findMany({
      where: { id: { in: playerUserIds } },
      select: { id: true, email: true, notificationPreferences: true },
    });

    for (const user of users) {
      const prefs = getNotificationPreferences(
        user.notificationPreferences as Record<string, unknown>
      );
      if (shouldNotify(prefs, 'yourTurn')) {
        await sendYourTurnEmail(user.email, gameName, gameId, turnAction);
      }
    }

    logger.info(`Sent your-turn notifications for game ${gameId}`);
  } catch (error) {
    logger.error(`Failed to send your-turn notifications: ${error}`);
  }
}
