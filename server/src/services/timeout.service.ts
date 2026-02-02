import { db } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { transitionPhase } from './game.service.js';
import { notifyTimeoutOccurred } from './notification.service.js';

// Timeout durations in milliseconds
const ARGUMENTATION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const VOTING_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface TimeoutConfig {
  argumentationTimeoutMs?: number;
  votingTimeoutMs?: number;
}

export interface TimeoutResult {
  actionId: string;
  gameId: string;
  phase: 'ARGUMENTATION' | 'VOTING';
  playersAffected: number;
  newPhase?: string;
}

/**
 * Gets all actions that have timed out in the argumentation phase.
 * An action times out if argumentationStartedAt + 24hrs < now and status is ARGUING.
 */
export async function getTimedOutArgumentationActions(
  config: TimeoutConfig = {}
): Promise<{ id: string; gameId: string; argumentationStartedAt: Date }[]> {
  const timeoutMs = config.argumentationTimeoutMs ?? ARGUMENTATION_TIMEOUT_MS;
  const cutoffTime = new Date(Date.now() - timeoutMs);

  const actions = await db.action.findMany({
    where: {
      status: 'ARGUING',
      argumentationStartedAt: {
        lt: cutoffTime,
      },
    },
    select: {
      id: true,
      gameId: true,
      argumentationStartedAt: true,
    },
  });

  return actions.filter(
    (a): a is typeof a & { argumentationStartedAt: Date } =>
      a.argumentationStartedAt !== null
  );
}

/**
 * Gets all actions that have timed out in the voting phase.
 * An action times out if votingStartedAt + 24hrs < now and status is VOTING.
 */
export async function getTimedOutVotingActions(
  config: TimeoutConfig = {}
): Promise<{ id: string; gameId: string; votingStartedAt: Date }[]> {
  const timeoutMs = config.votingTimeoutMs ?? VOTING_TIMEOUT_MS;
  const cutoffTime = new Date(Date.now() - timeoutMs);

  const actions = await db.action.findMany({
    where: {
      status: 'VOTING',
      votingStartedAt: {
        lt: cutoffTime,
      },
    },
    select: {
      id: true,
      gameId: true,
      votingStartedAt: true,
    },
  });

  return actions.filter(
    (a): a is typeof a & { votingStartedAt: Date } => a.votingStartedAt !== null
  );
}

/**
 * Process a timed-out argumentation phase.
 * Creates placeholder arguments for players who haven't argued,
 * then advances the action to voting phase.
 */
export async function processArgumentationTimeout(
  actionId: string
): Promise<TimeoutResult> {
  const action = await db.action.findUnique({
    where: { id: actionId },
    include: {
      game: {
        include: {
          players: { where: { isActive: true } },
        },
      },
      arguments: {
        select: { playerId: true },
      },
    },
  });

  if (!action) {
    throw new Error(`Action not found: ${actionId}`);
  }

  if (action.status !== 'ARGUING') {
    throw new Error(`Action ${actionId} is not in argumentation phase`);
  }

  logger.info(`Processing argumentation timeout for action ${actionId}`);

  // Find players who haven't submitted any arguments
  const playerIdsWithArguments = new Set(action.arguments.map((a) => a.playerId));
  const playersWithoutArguments = action.game.players.filter(
    (p) => !playerIdsWithArguments.has(p.id)
  );

  // Create placeholder arguments for players who haven't argued
  if (playersWithoutArguments.length > 0) {
    // Get next sequence number
    const lastArg = await db.argument.findFirst({
      where: { actionId },
      orderBy: { sequence: 'desc' },
    });
    let nextSequence = (lastArg?.sequence || 0) + 1;

    await db.argument.createMany({
      data: playersWithoutArguments.map((player) => ({
        actionId,
        playerId: player.id,
        argumentType: 'FOR', // Default to neutral-ish type
        content: '[No argument submitted - timed out]',
        sequence: nextSequence++,
      })),
    });

    logger.info(
      `Created ${playersWithoutArguments.length} placeholder arguments for action ${actionId}`
    );
  }

  // Update action to voting phase
  await db.action.update({
    where: { id: actionId },
    data: {
      status: 'VOTING',
      votingStartedAt: new Date(),
    },
  });

  // Update game phase
  await transitionPhase(action.gameId, 'VOTING');

  // Log the timeout event
  await db.gameEvent.create({
    data: {
      gameId: action.gameId,
      eventType: 'ARGUMENTATION_TIMEOUT',
      eventData: {
        actionId,
        autoArgumentedPlayerIds: playersWithoutArguments.map((p) => p.id),
      },
    },
  });

  // Notify players about timeout (include who had placeholders created)
  notifyTimeoutOccurred(
    action.gameId,
    action.game.name,
    'ARGUMENTATION',
    playersWithoutArguments.map((p) => p.userId)
  ).catch(() => {});

  return {
    actionId,
    gameId: action.gameId,
    phase: 'ARGUMENTATION',
    playersAffected: playersWithoutArguments.length,
    newPhase: 'VOTING',
  };
}

/**
 * Process a timed-out voting phase.
 * Auto-casts UNCERTAIN votes for players who haven't voted.
 * Then advances to RESOLUTION phase if all votes are now in.
 */
export async function processVotingTimeout(
  actionId: string
): Promise<TimeoutResult> {
  const action = await db.action.findUnique({
    where: { id: actionId },
    include: {
      game: {
        include: {
          players: { where: { isActive: true } },
        },
      },
      votes: true,
    },
  });

  if (!action) {
    throw new Error(`Action not found: ${actionId}`);
  }

  if (action.status !== 'VOTING') {
    throw new Error(`Action ${actionId} is not in voting phase`);
  }

  logger.info(`Processing voting timeout for action ${actionId}`);

  // Find players who haven't voted
  const votedPlayerIds = action.votes.map((v) => v.playerId);
  const playersWhoHaventVoted = action.game.players.filter(
    (p) => !votedPlayerIds.includes(p.id)
  );

  // Create auto-votes for missing players (UNCERTAIN = 1 success, 1 failure)
  if (playersWhoHaventVoted.length > 0) {
    await db.vote.createMany({
      data: playersWhoHaventVoted.map((player) => ({
        actionId,
        playerId: player.id,
        voteType: 'UNCERTAIN',
        successTokens: 1,
        failureTokens: 1,
      })),
    });

    logger.info(
      `Auto-cast ${playersWhoHaventVoted.length} UNCERTAIN votes for action ${actionId}`
    );
  }

  // Update action to resolved
  await db.action.update({
    where: { id: actionId },
    data: { status: 'RESOLVED' },
  });

  // Update game phase
  await transitionPhase(action.gameId, 'RESOLUTION');

  // Log the timeout event
  await db.gameEvent.create({
    data: {
      gameId: action.gameId,
      eventType: 'VOTING_TIMEOUT',
      eventData: {
        actionId,
        autoVotedPlayerIds: playersWhoHaventVoted.map((p) => p.id),
      },
    },
  });

  // Notify players about timeout (include who was auto-voted)
  notifyTimeoutOccurred(
    action.gameId,
    action.game.name,
    'VOTING',
    playersWhoHaventVoted.map((p) => p.userId)
  ).catch(() => {});

  return {
    actionId,
    gameId: action.gameId,
    phase: 'VOTING',
    playersAffected: playersWhoHaventVoted.length,
    newPhase: 'RESOLUTION',
  };
}

/**
 * Process all timed-out actions.
 * This is the main entry point for the timeout worker.
 */
export async function processAllTimeouts(
  config: TimeoutConfig = {}
): Promise<{
  argumentationTimeouts: TimeoutResult[];
  votingTimeouts: TimeoutResult[];
  errors: { actionId: string; error: string }[];
}> {
  const results = {
    argumentationTimeouts: [] as TimeoutResult[],
    votingTimeouts: [] as TimeoutResult[],
    errors: [] as { actionId: string; error: string }[],
  };

  // Process argumentation timeouts
  const argActions = await getTimedOutArgumentationActions(config);
  for (const action of argActions) {
    try {
      const result = await processArgumentationTimeout(action.id);
      results.argumentationTimeouts.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to process argumentation timeout for ${action.id}: ${message}`);
      results.errors.push({ actionId: action.id, error: message });
    }
  }

  // Process voting timeouts
  const voteActions = await getTimedOutVotingActions(config);
  for (const action of voteActions) {
    try {
      const result = await processVotingTimeout(action.id);
      results.votingTimeouts.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to process voting timeout for ${action.id}: ${message}`);
      results.errors.push({ actionId: action.id, error: message });
    }
  }

  if (
    results.argumentationTimeouts.length > 0 ||
    results.votingTimeouts.length > 0
  ) {
    logger.info(
      `Processed ${results.argumentationTimeouts.length} argumentation timeouts and ${results.votingTimeouts.length} voting timeouts`
    );
  }

  return results;
}

/**
 * Get timeout status for a specific action.
 * Useful for displaying countdown timers in the UI.
 */
export async function getActionTimeoutStatus(
  actionId: string,
  config: TimeoutConfig = {}
): Promise<{
  phase: string;
  startedAt: Date | null;
  timeoutAt: Date | null;
  isTimedOut: boolean;
  remainingMs: number | null;
} | null> {
  const action = await db.action.findUnique({
    where: { id: actionId },
    select: {
      status: true,
      argumentationStartedAt: true,
      votingStartedAt: true,
    },
  });

  if (!action) {
    return null;
  }

  const argTimeoutMs = config.argumentationTimeoutMs ?? ARGUMENTATION_TIMEOUT_MS;
  const voteTimeoutMs = config.votingTimeoutMs ?? VOTING_TIMEOUT_MS;
  const now = Date.now();

  if (action.status === 'ARGUING' && action.argumentationStartedAt) {
    const timeoutAt = new Date(
      action.argumentationStartedAt.getTime() + argTimeoutMs
    );
    const remainingMs = timeoutAt.getTime() - now;
    return {
      phase: 'ARGUMENTATION',
      startedAt: action.argumentationStartedAt,
      timeoutAt,
      isTimedOut: remainingMs <= 0,
      remainingMs: Math.max(0, remainingMs),
    };
  }

  if (action.status === 'VOTING' && action.votingStartedAt) {
    const timeoutAt = new Date(action.votingStartedAt.getTime() + voteTimeoutMs);
    const remainingMs = timeoutAt.getTime() - now;
    return {
      phase: 'VOTING',
      startedAt: action.votingStartedAt,
      timeoutAt,
      isTimedOut: remainingMs <= 0,
      remainingMs: Math.max(0, remainingMs),
    };
  }

  // No active timeout for this action's phase
  return {
    phase: action.status,
    startedAt: null,
    timeoutAt: null,
    isTimedOut: false,
    remainingMs: null,
  };
}
