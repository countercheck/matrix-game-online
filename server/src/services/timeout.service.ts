import { db } from '../config/database.js';
import { GamePhase } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { transitionPhase, getGameTimeoutSettings, type GameTimeoutSettings } from './game.service.js';
import { notifyTimeoutOccurred } from './notification.service.js';

export interface TimeoutResult {
  actionId?: string;
  gameId: string;
  phase: 'PROPOSAL' | 'ARGUMENTATION' | 'VOTING' | 'NARRATION';
  playersAffected: number;
  newPhase?: string;
  hostNotified?: boolean;
}

/**
 * Process all timed-out actions across all active games.
 * Each game's timeout settings are read from its own settings JSON.
 */
export async function processAllTimeouts(): Promise<{
  results: TimeoutResult[];
  errors: { gameId: string; error: string }[];
}> {
  const output = {
    results: [] as TimeoutResult[],
    errors: [] as { gameId: string; error: string }[],
  };

  // Find all active games in a phase that could timeout
  const activeGames = await db.game.findMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      currentPhase: {
        in: ['PROPOSAL', 'ARGUMENTATION', 'VOTING', 'NARRATION'],
      },
      phaseStartedAt: { not: null },
    },
    select: {
      id: true,
      name: true,
      currentPhase: true,
      phaseStartedAt: true,
      currentActionId: true,
      settings: true,
    },
  });

  for (const game of activeGames) {
    try {
      const settings = getGameTimeoutSettings(
        (game.settings as Record<string, unknown>) || {}
      );
      const result = await processGameTimeout(game, settings);
      if (result) {
        output.results.push(result);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to process timeout for game ${game.id}: ${message}`);
      output.errors.push({ gameId: game.id, error: message });
    }
  }

  if (output.results.length > 0) {
    logger.info(`Processed ${output.results.length} timeouts`);
  }

  return output;
}

/**
 * Process timeout for a single game based on its current phase and settings.
 */
async function processGameTimeout(
  game: {
    id: string;
    name: string;
    currentPhase: GamePhase;
    phaseStartedAt: Date | null;
    currentActionId: string | null;
    settings: unknown;
  },
  timeoutConfig: GameTimeoutSettings
): Promise<TimeoutResult | null> {
  if (!game.phaseStartedAt) return null;

  const now = Date.now();

  switch (game.currentPhase) {
    case 'PROPOSAL': {
      if (timeoutConfig.proposalTimeoutMs === null) return null;
      const elapsed = now - game.phaseStartedAt.getTime();
      if (elapsed < timeoutConfig.proposalTimeoutMs) return null;
      return processProposalTimeout(game.id, game.name);
    }
    case 'ARGUMENTATION': {
      if (timeoutConfig.argumentationTimeoutMs === null) return null;
      if (!game.currentActionId) return null;
      const elapsed = now - game.phaseStartedAt.getTime();
      if (elapsed < timeoutConfig.argumentationTimeoutMs) return null;
      return processArgumentationTimeout(game.currentActionId);
    }
    case 'VOTING': {
      if (timeoutConfig.votingTimeoutMs === null) return null;
      if (!game.currentActionId) return null;
      const elapsed = now - game.phaseStartedAt.getTime();
      if (elapsed < timeoutConfig.votingTimeoutMs) return null;
      return processVotingTimeout(game.currentActionId);
    }
    case 'NARRATION': {
      if (timeoutConfig.narrationTimeoutMs === null) return null;
      const elapsed = now - game.phaseStartedAt.getTime();
      if (elapsed < timeoutConfig.narrationTimeoutMs) return null;
      return processNarrationTimeout(game.id, game.name);
    }
    default:
      return null;
  }
}

/**
 * Process a proposal phase timeout.
 * Does NOT auto-resolve — creates an event and notifies the host to decide.
 */
async function processProposalTimeout(
  gameId: string,
  gameName: string
): Promise<TimeoutResult | null> {
  // Deduplicate: check if we already created a timeout event for this phase instance
  const existing = await db.gameEvent.findFirst({
    where: {
      gameId,
      eventType: 'PROPOSAL_TIMEOUT',
    },
    orderBy: { createdAt: 'desc' },
  });

  // If the most recent PROPOSAL_TIMEOUT event is after phaseStartedAt, skip
  const game = await db.game.findUnique({
    where: { id: gameId },
    select: { phaseStartedAt: true },
  });

  if (existing && game?.phaseStartedAt && existing.createdAt >= game.phaseStartedAt) {
    return null; // Already notified for this phase instance
  }

  await db.gameEvent.create({
    data: {
      gameId,
      eventType: 'PROPOSAL_TIMEOUT',
      eventData: { phase: 'PROPOSAL' },
    },
  });

  // Notify the host
  const host = await db.gamePlayer.findFirst({
    where: { gameId, isHost: true, isActive: true },
  });

  const hostNotified = !!host;

  if (host) {
    notifyTimeoutOccurred(gameId, gameName, 'PROPOSAL', [host.userId]).catch(() => {});
  }

  if (hostNotified) {
    logger.info(`Proposal timeout for game ${gameId} - host notified`);
  } else {
    logger.info(`Proposal timeout for game ${gameId} - no active host to notify`);
  }

  return {
    gameId,
    phase: 'PROPOSAL',
    playersAffected: 0,
    hostNotified,
  };
}

/**
 * Process a timed-out argumentation phase.
 * Creates placeholder arguments for players who haven't argued,
 * then advances the action to voting phase.
 */
async function processArgumentationTimeout(
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
  await transitionPhase(action.gameId, GamePhase.VOTING);

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
async function processVotingTimeout(
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
  await transitionPhase(action.gameId, GamePhase.RESOLUTION);

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
 * Process a narration phase timeout.
 * Does NOT auto-resolve — creates an event and notifies the host to decide.
 */
async function processNarrationTimeout(
  gameId: string,
  gameName: string
): Promise<TimeoutResult | null> {
  // Deduplicate: check if we already created a timeout event for this phase instance
  const existing = await db.gameEvent.findFirst({
    where: {
      gameId,
      eventType: 'NARRATION_TIMEOUT',
    },
    orderBy: { createdAt: 'desc' },
  });

  const game = await db.game.findUnique({
    where: { id: gameId },
    select: { phaseStartedAt: true },
  });

  if (existing && game?.phaseStartedAt && existing.createdAt >= game.phaseStartedAt) {
    return null; // Already notified for this phase instance
  }

  await db.gameEvent.create({
    data: {
      gameId,
      eventType: 'NARRATION_TIMEOUT',
      eventData: { phase: 'NARRATION' },
    },
  });

  // Notify the host
  const host = await db.gamePlayer.findFirst({
    where: { gameId, isHost: true, isActive: true },
  });

  const hostNotified = !!host;

  if (host) {
    notifyTimeoutOccurred(gameId, gameName, 'NARRATION', [host.userId]).catch(() => {});
  }

  if (hostNotified) {
    logger.info(`Narration timeout for game ${gameId} - host notified`);
  } else {
    logger.info(`Narration timeout for game ${gameId} - no active host to notify`);
  }

  return {
    gameId,
    phase: 'NARRATION',
    playersAffected: 0,
    hostNotified,
  };
}
