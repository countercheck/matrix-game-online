import { randomBytes } from 'crypto';
import { db } from '../config/database.js';
import { ResultType, GamePhase } from '@prisma/client';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../middleware/errorHandler.js';
import { requireMember, logGameEvent, transitionPhase } from './game.service.js';
import type {
  ActionProposalInput,
  ArgumentInput,
  VoteInput,
  NarrationInput,
  UpdateActionInput,
  UpdateArgumentInput,
  UpdateNarrationInput,
} from '../utils/validators.js';
import {
  notifyActionProposed,
  notifyVotingStarted,
  notifyResolutionReady,
  notifyNarrationNeeded,
  notifyRoundSummaryNeeded,
} from './notification.service.js';

/**
 * Check if NPC should auto-propose and do it if needed.
 * NPC proposes when all human players have proposed this round.
 * Returns the NPC action if created, null otherwise.
 */
export async function checkAndProposeNpcAction(gameId: string) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      currentRound: true,
      players: {
        where: { isActive: true },
        include: { persona: true },
      },
    },
  });

  if (!game || game.deletedAt || !game.currentRound) return null;
  if (game.currentPhase !== 'PROPOSAL') return null;

  // Find NPC player
  const npcPlayer = game.players.find((p) => p.isNpc);
  if (!npcPlayer) return null;

  // Check if NPC already proposed this round
  const npcAction = await db.action.findFirst({
    where: {
      roundId: game.currentRound.id,
      initiatorId: npcPlayer.id,
    },
  });
  if (npcAction) return null;

  // Count how many human players have proposed this round
  const humanPlayers = game.players.filter((p) => !p.isNpc);
  const humanProposals = await db.action.count({
    where: {
      roundId: game.currentRound.id,
      initiatorId: { in: humanPlayers.map((p) => p.id) },
    },
  });

  // If all humans have proposed, NPC auto-proposes
  if (humanProposals < humanPlayers.length) return null;

  // Create NPC action using scripted proposal from persona
  const npcName = npcPlayer.persona?.name || npcPlayer.playerName;
  const actionDescription = npcPlayer.persona?.npcActionDescription || `${npcName} takes action`;
  const desiredOutcome = npcPlayer.persona?.npcDesiredOutcome || `${npcName} achieves their goal`;

  // Get next sequence number
  const lastAction = await db.action.findFirst({
    where: { gameId },
    orderBy: { sequenceNumber: 'desc' },
  });
  const sequenceNumber = (lastAction?.sequenceNumber || 0) + 1;

  const action = await db.action.create({
    data: {
      gameId,
      roundId: game.currentRound.id,
      initiatorId: npcPlayer.id,
      sequenceNumber,
      actionDescription,
      desiredOutcome,
      status: 'ARGUING',
      argumentationStartedAt: new Date(),
      // NPC doesn't provide initial arguments - players will argue about it
    },
    include: {
      initiator: {
        include: {
          user: { select: { displayName: true } },
          persona: true,
        },
      },
    },
  });

  // Update game state to argumentation
  await db.game.update({
    where: { id: gameId },
    data: {
      currentPhase: 'ARGUMENTATION',
      currentActionId: action.id,
      phaseStartedAt: new Date(),
    },
  });

  await logGameEvent(gameId, null, 'NPC_ACTION_PROPOSED', {
    actionId: action.id,
    npcName,
    description: actionDescription,
  });

  return action;
}

export async function proposeAction(gameId: string, userId: string, data: ActionProposalInput) {
  const player = await db.gamePlayer.findFirst({
    where: { gameId, userId, isActive: true },
  });

  if (!player) {
    throw new ForbiddenError('Not a member of this game');
  }

  const game = await db.game.findUnique({
    where: { id: gameId },
    include: { currentRound: true },
  });

  if (!game || game.deletedAt || !game.currentRound) {
    throw new NotFoundError('Game or round not found');
  }

  if (game.currentPhase !== 'PROPOSAL') {
    throw new BadRequestError('Game is not in proposal phase');
  }

  // Check if player already proposed this round
  const existingAction = await db.action.findFirst({
    where: {
      roundId: game.currentRound.id,
      initiatorId: player.id,
    },
  });

  if (existingAction) {
    throw new ConflictError('You have already proposed an action this round');
  }

  // Get next sequence number
  const lastAction = await db.action.findFirst({
    where: { gameId },
    orderBy: { sequenceNumber: 'desc' },
  });
  const sequenceNumber = (lastAction?.sequenceNumber || 0) + 1;

  // Create action with initial arguments
  const action = await db.action.create({
    data: {
      gameId,
      roundId: game.currentRound.id,
      initiatorId: player.id,
      sequenceNumber,
      actionDescription: data.actionDescription,
      desiredOutcome: data.desiredOutcome,
      status: 'ARGUING',
      argumentationStartedAt: new Date(),
      arguments: {
        create: data.initialArguments.map((content, index) => ({
          playerId: player.id,
          argumentType: 'INITIATOR_FOR',
          content,
          sequence: index + 1,
        })),
      },
    },
    include: {
      initiator: {
        include: {
          user: { select: { displayName: true } },
        },
      },
      arguments: true,
    },
  });

  // Update game state
  await db.game.update({
    where: { id: gameId },
    data: {
      currentPhase: 'ARGUMENTATION',
      currentActionId: action.id,
      phaseStartedAt: new Date(),
    },
  });

  await logGameEvent(gameId, userId, 'ACTION_PROPOSED', {
    actionId: action.id,
    description: data.actionDescription,
  });

  // Send notifications (async, don't wait)
  notifyActionProposed(
    gameId,
    game.name,
    userId,
    action.initiator.user.displayName,
    data.actionDescription
  ).catch(() => {});

  return action;
}

export async function getAction(actionId: string, userId: string) {
  const action = await db.action.findUnique({
    where: { id: actionId },
    include: {
      game: true,
      initiator: {
        include: {
          user: { select: { id: true, displayName: true } },
        },
      },
      arguments: {
        include: {
          player: {
            include: {
              user: { select: { displayName: true } },
            },
          },
        },
        orderBy: { sequence: 'asc' },
      },
      votes: true,
      tokenDraw: {
        include: { drawnTokens: true },
      },
      narration: {
        include: {
          author: {
            include: {
              user: { select: { displayName: true } },
            },
          },
        },
      },
    },
  });

  if (!action) {
    throw new NotFoundError('Action not found');
  }

  await requireMember(action.gameId, userId);

  return action;
}

export async function addArgument(actionId: string, userId: string, data: ArgumentInput) {
  const action = await db.action.findUnique({
    where: { id: actionId },
    include: { game: true },
  });

  if (!action) {
    throw new NotFoundError('Action not found');
  }

  if (action.status !== 'ARGUING') {
    throw new BadRequestError('Action is not in argumentation phase');
  }

  const player = await db.gamePlayer.findFirst({
    where: { gameId: action.gameId, userId, isActive: true },
  });

  if (!player) {
    throw new ForbiddenError('Not a member of this game');
  }

  // Check if initiator is trying to add clarification
  const isInitiator = action.initiatorId === player.id;
  if (isInitiator && data.argumentType !== 'CLARIFICATION') {
    throw new BadRequestError('Initiator can only add clarification arguments');
  }
  if (!isInitiator && data.argumentType === 'CLARIFICATION') {
    throw new BadRequestError('Only initiator can add clarification');
  }

  // Check argument limits
  const existingArgs = await db.argument.findMany({
    where: { actionId, playerId: player.id },
  });

  const settings = (action.game.settings as Record<string, unknown>) || {};
  const argumentLimit = (settings.argumentLimit as number) || 3;

  if (existingArgs.length >= argumentLimit) {
    throw new BadRequestError(`Maximum ${argumentLimit} arguments per player`);
  }

  // Get next sequence
  const lastArg = await db.argument.findFirst({
    where: { actionId },
    orderBy: { sequence: 'desc' },
  });

  const argument = await db.argument.create({
    data: {
      actionId,
      playerId: player.id,
      argumentType: data.argumentType,
      content: data.content,
      sequence: (lastArg?.sequence || 0) + 1,
    },
    include: {
      player: {
        include: {
          user: { select: { displayName: true } },
        },
      },
    },
  });

  await logGameEvent(action.gameId, userId, 'ARGUMENT_ADDED', {
    actionId,
    argumentType: data.argumentType,
  });

  return argument;
}

export async function getArguments(actionId: string, userId: string) {
  const action = await db.action.findUnique({
    where: { id: actionId },
  });

  if (!action) {
    throw new NotFoundError('Action not found');
  }

  await requireMember(action.gameId, userId);

  const args = await db.argument.findMany({
    where: { actionId },
    include: {
      player: {
        include: {
          user: { select: { displayName: true } },
        },
      },
    },
    orderBy: { sequence: 'asc' },
  });

  return args;
}

export async function completeArgumentation(actionId: string, userId: string) {
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
    throw new NotFoundError('Action not found');
  }

  if (action.status !== 'ARGUING') {
    throw new BadRequestError('Action is not in argumentation phase');
  }

  const player = await db.gamePlayer.findFirst({
    where: { gameId: action.gameId, userId, isActive: true },
  });

  if (!player) {
    throw new ForbiddenError('Not a member of this game');
  }

  // Record that this player has completed argumentation
  await db.argumentationComplete.upsert({
    where: {
      actionId_playerId: {
        actionId,
        playerId: player.id,
      },
    },
    create: {
      actionId,
      playerId: player.id,
    },
    update: {},
  });

  // NPC doesn't participate in argumentation
  const humanPlayers = action.game.players.filter((p) => !p.isNpc);

  // Check if all human players have completed argumentation
  const completedCount = await db.argumentationComplete.count({
    where: { actionId },
  });

  if (completedCount < humanPlayers.length) {
    // Not all players have marked themselves as done
    return {
      message: 'Marked as done. Waiting for other players to finish.',
      playersRemaining: humanPlayers.length - completedCount,
    };
  }

  // All players have argued and marked as done - transition to voting
  await db.action.update({
    where: { id: actionId },
    data: {
      status: 'VOTING',
      votingStartedAt: new Date(),
    },
  });

  await transitionPhase(action.gameId, GamePhase.VOTING);

  // Send notifications (async, don't wait)
  notifyVotingStarted(action.gameId, action.game.name, action.actionDescription).catch(() => {});

  return { message: 'Moved to voting phase' };
}

export async function submitVote(actionId: string, userId: string, data: VoteInput) {
  const action = await db.action.findUnique({
    where: { id: actionId },
  });

  if (!action) {
    throw new NotFoundError('Action not found');
  }

  if (action.status !== 'VOTING') {
    throw new BadRequestError('Action is not in voting phase');
  }

  const player = await db.gamePlayer.findFirst({
    where: { gameId: action.gameId, userId, isActive: true },
  });

  if (!player) {
    throw new ForbiddenError('Not a member of this game');
  }

  // Check for existing vote
  const existingVote = await db.vote.findUnique({
    where: {
      actionId_playerId: {
        actionId,
        playerId: player.id,
      },
    },
  });

  if (existingVote) {
    throw new ConflictError('You have already voted');
  }

  // Map vote type to tokens
  const tokenMap = {
    LIKELY_SUCCESS: { successTokens: 2, failureTokens: 0 },
    LIKELY_FAILURE: { successTokens: 0, failureTokens: 2 },
    UNCERTAIN: { successTokens: 1, failureTokens: 1 },
  };

  const tokens = tokenMap[data.voteType];

  const vote = await db.vote.create({
    data: {
      actionId,
      playerId: player.id,
      voteType: data.voteType,
      ...tokens,
    },
  });

  await logGameEvent(action.gameId, userId, 'VOTE_CAST', { actionId });

  // Check if all players have voted (excluding NPC - they don't vote)
  const game = await db.game.findUnique({
    where: { id: action.gameId },
    include: {
      players: { where: { isActive: true } },
    },
  });

  const voteCount = await db.vote.count({ where: { actionId } });
  const humanPlayers = game?.players.filter((p) => !p.isNpc) || [];

  if (game && !game.deletedAt && voteCount >= humanPlayers.length) {
    // Get full action details for notification
    const fullAction = await db.action.findUnique({
      where: { id: actionId },
      include: {
        initiator: {
          include: { user: { select: { id: true } } },
        },
      },
    });

    await db.action.update({
      where: { id: actionId },
      data: { status: 'RESOLVED' },
    });
    await transitionPhase(action.gameId, GamePhase.RESOLUTION);

    // Notify initiator that resolution is ready
    if (fullAction) {
      notifyResolutionReady(
        action.gameId,
        game.name,
        fullAction.initiator.userId,
        fullAction.actionDescription
      ).catch(() => {});
    }
  }

  return vote;
}

export async function getVotes(actionId: string, userId: string) {
  const action = await db.action.findUnique({
    where: { id: actionId },
  });

  if (!action) {
    throw new NotFoundError('Action not found');
  }

  await requireMember(action.gameId, userId);

  // Only show votes after voting is complete
  if (action.status === 'VOTING') {
    const voteCount = await db.vote.count({ where: { actionId } });
    return { votesSubmitted: voteCount, votes: [] };
  }

  const votes = await db.vote.findMany({
    where: { actionId },
    include: {
      player: {
        include: {
          user: { select: { displayName: true } },
        },
      },
    },
  });

  return { votes };
}

export async function drawTokens(actionId: string, userId: string) {
  const action = await db.action.findUnique({
    where: { id: actionId },
    include: {
      game: { select: { name: true } },
      initiator: true,
      votes: true,
    },
  });

  if (!action) {
    throw new NotFoundError('Action not found');
  }

  if (action.status !== 'RESOLVED') {
    throw new BadRequestError('Action is not ready for token draw');
  }

  // NPC actions can have tokens drawn by any player
  if (!action.initiator.isNpc && action.initiator.userId !== userId) {
    throw new ForbiddenError('Only the initiator can draw tokens');
  }

  // Check if already drawn
  const existingDraw = await db.tokenDraw.findUnique({
    where: { actionId },
  });

  if (existingDraw) {
    throw new ConflictError('Tokens have already been drawn');
  }

  // Calculate token pool
  // Base: 1 success + 1 failure
  // Plus votes
  const totalSuccess = 1 + action.votes.reduce((sum, v) => sum + v.successTokens, 0);
  const totalFailure = 1 + action.votes.reduce((sum, v) => sum + v.failureTokens, 0);

  // Draw tokens
  const drawResult = performTokenDraw(totalSuccess, totalFailure);

  // Store result
  const tokenDraw = await db.tokenDraw.create({
    data: {
      actionId,
      totalSuccessTokens: totalSuccess,
      totalFailureTokens: totalFailure,
      randomSeed: drawResult.seed,
      drawnSuccess: drawResult.drawnSuccess,
      drawnFailure: drawResult.drawnFailure,
      resultValue: drawResult.resultValue,
      resultType: drawResult.resultType,
      drawnTokens: {
        create: drawResult.tokens.map((type, index) => ({
          drawSequence: index + 1,
          tokenType: type,
        })),
      },
    },
    include: {
      drawnTokens: true,
    },
  });

  await db.action.update({
    where: { id: actionId },
    data: { resolvedAt: new Date() },
  });

  // Update NPC momentum if this is an NPC action
  if (action.initiator.isNpc) {
    await db.game.update({
      where: { id: action.gameId },
      data: {
        npcMomentum: { increment: drawResult.resultValue },
      },
    });
  }

  await transitionPhase(action.gameId, GamePhase.NARRATION);

  await logGameEvent(action.gameId, userId, 'TOKENS_DRAWN', {
    actionId,
    result: drawResult.resultType,
    value: drawResult.resultValue,
    isNpcAction: action.initiator.isNpc,
  });

  // Notify initiator that narration is needed
  notifyNarrationNeeded(
    action.gameId,
    action.game.name,
    userId,
    drawResult.resultType,
    drawResult.resultValue
  ).catch(() => {});

  return tokenDraw;
}

function performTokenDraw(successCount: number, failureCount: number) {
  const seed = randomBytes(32).toString('hex');

  // Create token pool
  const tokens: ('SUCCESS' | 'FAILURE')[] = [
    ...Array(successCount).fill('SUCCESS'),
    ...Array(failureCount).fill('FAILURE'),
  ];

  // Fisher-Yates shuffle with crypto randomness
  for (let i = tokens.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(0, i);
    [tokens[i], tokens[j]] = [tokens[j]!, tokens[i]!];
  }

  // Draw first 3 tokens
  const drawn = tokens.slice(0, 3) as ('SUCCESS' | 'FAILURE')[];
  const drawnSuccess = drawn.filter((t) => t === 'SUCCESS').length;
  const drawnFailure = 3 - drawnSuccess;

  // Calculate result: -3, -1, +1, +3
  const resultValue = drawnSuccess * 2 - 3;

  const resultType = getResultType(drawnSuccess);

  return {
    seed,
    tokens: drawn,
    drawnSuccess,
    drawnFailure,
    resultValue,
    resultType,
  };
}

function getSecureRandomInt(min: number, max: number): number {
  const range = max - min + 1;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8) || 1;
  const maxValid = Math.floor(256 ** bytesNeeded / range) * range - 1;

  let randomInt;
  do {
    const bytes = randomBytes(bytesNeeded);
    randomInt = bytes.readUIntBE(0, bytesNeeded);
  } while (randomInt > maxValid);

  return min + (randomInt % range);
}

function getResultType(successCount: number): ResultType {
  switch (successCount) {
    case 3:
      return ResultType.TRIUMPH;
    case 2:
      return ResultType.SUCCESS_BUT;
    case 1:
      return ResultType.FAILURE_BUT;
    default:
      return ResultType.DISASTER;
  }
}

export async function getDrawResult(actionId: string, userId: string) {
  const action = await db.action.findUnique({
    where: { id: actionId },
  });

  if (!action) {
    throw new NotFoundError('Action not found');
  }

  await requireMember(action.gameId, userId);

  const tokenDraw = await db.tokenDraw.findUnique({
    where: { actionId },
    include: { drawnTokens: true },
  });

  return tokenDraw;
}

export async function submitNarration(actionId: string, userId: string, data: NarrationInput) {
  const action = await db.action.findUnique({
    where: { id: actionId },
    include: {
      game: {
        include: { currentRound: true },
      },
      initiator: true,
      tokenDraw: true,
    },
  });

  if (!action) {
    throw new NotFoundError('Action not found');
  }

  if (!action.tokenDraw) {
    throw new BadRequestError('Tokens must be drawn before narrating');
  }

  const player = await db.gamePlayer.findFirst({
    where: { gameId: action.gameId, userId, isActive: true },
  });

  if (!player) {
    throw new ForbiddenError('Not a member of this game');
  }

  // Check narration permissions based on game settings
  const settings = (action.game.settings as Record<string, unknown>) || {};
  const narrationMode = settings.narrationMode || 'initiator_only';

  // NPC actions can be narrated by any player
  const isNpcAction = action.initiator.isNpc;

  if (!isNpcAction && narrationMode === 'initiator_only' && action.initiator.userId !== userId) {
    throw new ForbiddenError('Only the initiator can narrate this action');
  }

  // Check for existing narration
  const existingNarration = await db.narration.findUnique({
    where: { actionId },
  });

  if (existingNarration) {
    throw new ConflictError('Narration already submitted');
  }

  const narration = await db.narration.create({
    data: {
      actionId,
      authorId: player.id,
      content: data.content,
    },
  });

  // Mark action complete
  await db.action.update({
    where: { id: actionId },
    data: {
      status: 'NARRATED',
      completedAt: new Date(),
    },
  });

  // Increment round actions completed
  if (action.game.currentRound) {
    await db.round.update({
      where: { id: action.game.currentRound.id },
      data: { actionsCompleted: { increment: 1 } },
    });

    // Check if round is complete
    const updatedRound = await db.round.findUnique({
      where: { id: action.game.currentRound.id },
    });

    if (updatedRound && updatedRound.actionsCompleted >= updatedRound.totalActionsRequired) {
      await transitionPhase(action.gameId, GamePhase.ROUND_SUMMARY);

      // Notify players that round summary is needed
      notifyRoundSummaryNeeded(
        action.gameId,
        action.game.name,
        updatedRound.roundNumber,
        updatedRound.actionsCompleted
      ).catch(() => {});
    } else {
      // More actions needed, go back to proposal
      await db.game.update({
        where: { id: action.gameId },
        data: {
          currentPhase: 'PROPOSAL',
          currentActionId: null,
          phaseStartedAt: new Date(),
        },
      });

      // Check if NPC should auto-propose (all humans have proposed)
      await checkAndProposeNpcAction(action.gameId);
    }
  }

  await logGameEvent(action.gameId, userId, 'NARRATION_ADDED', { actionId });

  return narration;
}

export async function getNarration(actionId: string, userId: string) {
  const action = await db.action.findUnique({
    where: { id: actionId },
  });

  if (!action) {
    throw new NotFoundError('Action not found');
  }

  await requireMember(action.gameId, userId);

  const narration = await db.narration.findUnique({
    where: { actionId },
    include: {
      author: {
        include: {
          user: { select: { displayName: true } },
        },
      },
    },
  });

  return narration;
}

/**
 * Helper to verify a user is the host of a game
 */
async function requireHost(gameId: string, userId: string) {
  const player = await db.gamePlayer.findFirst({
    where: { gameId, userId, isActive: true, isHost: true },
  });

  if (!player) {
    throw new ForbiddenError('Only the game host can perform this action');
  }

  return player;
}

/**
 * Skip the argumentation phase - host can force transition to voting
 */
export async function skipArgumentation(actionId: string, userId: string) {
  const action = await db.action.findUnique({
    where: { id: actionId },
    include: {
      game: {
        include: {
          players: { where: { isActive: true } },
        },
      },
    },
  });

  if (!action) {
    throw new NotFoundError('Action not found');
  }

  if (action.status !== 'ARGUING') {
    throw new BadRequestError('Action is not in argumentation phase');
  }

  await requireHost(action.gameId, userId);

  // Transition to voting
  await db.action.update({
    where: { id: actionId },
    data: {
      status: 'VOTING',
      votingStartedAt: new Date(),
      argumentationWasSkipped: true,
    },
  });

  await transitionPhase(action.gameId, GamePhase.VOTING);

  await logGameEvent(action.gameId, userId, 'ARGUMENTATION_SKIPPED', {
    actionId,
    skippedByHost: true,
  });

  // Send notifications
  notifyVotingStarted(action.gameId, action.game.name, action.actionDescription).catch(() => {});

  return { message: 'Argumentation skipped, moved to voting phase' };
}

/**
 * Skip the voting phase - host can force transition to resolution
 * Missing votes are auto-filled as UNCERTAIN with wasSkipped=true
 */
export async function skipVoting(actionId: string, userId: string) {
  const action = await db.action.findUnique({
    where: { id: actionId },
    include: {
      game: {
        include: {
          players: { where: { isActive: true } },
        },
      },
      votes: true,
      initiator: {
        include: { user: { select: { id: true } } },
      },
    },
  });

  if (!action) {
    throw new NotFoundError('Action not found');
  }

  if (action.status !== 'VOTING') {
    throw new BadRequestError('Action is not in voting phase');
  }

  await requireHost(action.gameId, userId);

  // Find players who haven't voted (excluding NPC)
  const humanPlayers = action.game.players.filter((p) => !p.isNpc);
  const votedPlayerIds = new Set(action.votes.map((v) => v.playerId));
  const missingVoters = humanPlayers.filter((p) => !votedPlayerIds.has(p.id));

  // Auto-fill missing votes as UNCERTAIN with wasSkipped=true
  if (missingVoters.length > 0) {
    await db.vote.createMany({
      data: missingVoters.map((player) => ({
        actionId,
        playerId: player.id,
        voteType: 'UNCERTAIN',
        successTokens: 1,
        failureTokens: 1,
        wasSkipped: true,
      })),
    });
  }

  // Update action status
  await db.action.update({
    where: { id: actionId },
    data: {
      status: 'RESOLVED',
      votingWasSkipped: true,
    },
  });

  await transitionPhase(action.gameId, GamePhase.RESOLUTION);

  await logGameEvent(action.gameId, userId, 'VOTING_SKIPPED', {
    actionId,
    skippedByHost: true,
    missingVotersCount: missingVoters.length,
    missingVoterNames: missingVoters.map((p) => p.playerName),
  });

  // Notify initiator that resolution is ready
  notifyResolutionReady(
    action.gameId,
    action.game.name,
    action.initiator.userId,
    action.actionDescription
  ).catch(() => {});

  return {
    message: 'Voting skipped, moved to resolution phase',
    skippedVotes: missingVoters.length,
  };
}

/**
 * Skip waiting for proposals and move to next action or round summary
 * This skips any remaining proposals in the current round
 */
export async function skipToNextAction(gameId: string, userId: string) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      currentRound: true,
      currentAction: true,
      players: { where: { isActive: true } },
    },
  });

  if (!game || game.deletedAt) {
    throw new NotFoundError('Game not found');
  }

  await requireHost(gameId, userId);

  // If we're in proposal phase with no current action, we're waiting for proposals
  if (game.currentPhase === 'PROPOSAL' && !game.currentActionId) {
    // Check if there are any actions this round
    const roundActions = await db.action.count({
      where: { roundId: game.currentRound?.id },
    });

    if (roundActions === 0) {
      throw new BadRequestError(
        'Cannot skip - at least one action must be proposed before moving on'
      );
    }

    // Update round to complete with current actions
    if (game.currentRound) {
      await db.round.update({
        where: { id: game.currentRound.id },
        data: {
          totalActionsRequired: roundActions,
          actionsCompleted: roundActions,
        },
      });

      await transitionPhase(gameId, GamePhase.ROUND_SUMMARY);

      await logGameEvent(gameId, userId, 'PROPOSALS_SKIPPED', {
        roundId: game.currentRound.id,
        skippedByHost: true,
        completedActions: roundActions,
      });

      // Notify players that round summary is needed
      notifyRoundSummaryNeeded(
        gameId,
        game.name,
        game.currentRound.roundNumber,
        roundActions
      ).catch(() => {});

      return {
        message: 'Remaining proposals skipped, moved to round summary',
        completedActions: roundActions,
      };
    }
  }

  throw new BadRequestError('Cannot skip - game is not waiting for proposals');
}

/**
 * Host can edit an action's description and/or desired outcome
 */
export async function updateAction(actionId: string, userId: string, data: UpdateActionInput) {
  const action = await db.action.findUnique({
    where: { id: actionId },
    select: { id: true, gameId: true },
  });

  if (!action) {
    throw new NotFoundError('Action not found');
  }

  await requireHost(action.gameId, userId);

  const updatedAction = await db.action.update({
    where: { id: actionId },
    data: {
      ...(data.actionDescription !== undefined && { actionDescription: data.actionDescription }),
      ...(data.desiredOutcome !== undefined && { desiredOutcome: data.desiredOutcome }),
    },
  });

  await logGameEvent(action.gameId, userId, 'ACTION_EDITED', {
    actionId,
    fieldsUpdated: Object.keys(data).filter((k) => data[k as keyof typeof data] !== undefined),
  });

  return updatedAction;
}

/**
 * Host can edit an argument's content
 */
export async function updateArgument(
  argumentId: string,
  userId: string,
  data: UpdateArgumentInput
) {
  const argument = await db.argument.findUnique({
    where: { id: argumentId },
    include: {
      action: { select: { id: true, gameId: true } },
    },
  });

  if (!argument) {
    throw new NotFoundError('Argument not found');
  }

  await requireHost(argument.action.gameId, userId);

  const updatedArgument = await db.argument.update({
    where: { id: argumentId },
    data: { content: data.content },
  });

  await logGameEvent(argument.action.gameId, userId, 'ARGUMENT_EDITED', {
    argumentId,
    actionId: argument.action.id,
  });

  return updatedArgument;
}

/**
 * Host can edit a narration's content
 */
export async function updateNarration(
  actionId: string,
  userId: string,
  data: UpdateNarrationInput
) {
  const narration = await db.narration.findUnique({
    where: { actionId },
    include: {
      action: { select: { id: true, gameId: true } },
    },
  });

  if (!narration) {
    throw new NotFoundError('Narration not found');
  }

  await requireHost(narration.action.gameId, userId);

  const updatedNarration = await db.narration.update({
    where: { actionId },
    data: { content: data.content },
  });

  await logGameEvent(narration.action.gameId, userId, 'NARRATION_EDITED', {
    actionId,
  });

  return updatedNarration;
}
