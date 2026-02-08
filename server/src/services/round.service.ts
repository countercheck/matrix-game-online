import { db } from '../config/database.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../middleware/errorHandler.js';
import { requireMember, logGameEvent } from './game.service.js';
import type { RoundSummaryInput, UpdateRoundSummaryInput } from '../utils/validators.js';
import { notifyNewRound } from './notification.service.js';

export async function getRound(roundId: string, userId: string) {
  const round = await db.round.findUnique({
    where: { id: roundId },
    include: {
      game: {
        include: {
          players: {
            where: { isActive: true },
            include: {
              user: { select: { id: true, displayName: true } },
            },
          },
        },
      },
      actions: {
        include: {
          initiator: {
            include: {
              user: { select: { displayName: true } },
            },
          },
          tokenDraw: true,
          narration: true,
        },
        orderBy: { sequenceNumber: 'asc' },
      },
      summary: true,
    },
  });

  if (!round) {
    throw new NotFoundError('Round not found');
  }

  await requireMember(round.gameId, userId);

  // Calculate which players have/haven't proposed
  const playerIdsWhoProposed = round.actions.map((a) => a.initiator.userId);
  const playersWhoProposed = round.game.players.filter((p) =>
    playerIdsWhoProposed.includes(p.userId)
  );
  const playersWhoHaventProposed = round.game.players.filter(
    (p) => !playerIdsWhoProposed.includes(p.userId)
  );

  return {
    ...round,
    progress: {
      actionsCompleted: round.actionsCompleted,
      totalRequired: round.totalActionsRequired,
      remaining: round.totalActionsRequired - round.actionsCompleted,
      isComplete: round.actionsCompleted >= round.totalActionsRequired,
      percentage: Math.round(
        (round.actionsCompleted / round.totalActionsRequired) * 100
      ),
    },
    playersWhoProposed: playersWhoProposed.map((p) => ({
      id: p.id,
      userId: p.userId,
      playerName: p.playerName,
      displayName: p.user.displayName,
    })),
    playersWhoHaventProposed: playersWhoHaventProposed.map((p) => ({
      id: p.id,
      userId: p.userId,
      playerName: p.playerName,
      displayName: p.user.displayName,
    })),
  };
}

export async function submitRoundSummary(
  roundId: string,
  userId: string,
  data: RoundSummaryInput
) {
  const round = await db.round.findUnique({
    where: { id: roundId },
    include: {
      game: {
        include: {
          players: { where: { isActive: true } },
        },
      },
      actions: {
        include: { tokenDraw: true },
      },
      summary: true,
    },
  });

  if (!round) {
    throw new NotFoundError('Round not found');
  }

  await requireMember(round.gameId, userId);

  // Verify round is complete
  if (round.actionsCompleted < round.totalActionsRequired) {
    throw new BadRequestError(
      `Round is not complete. ${round.totalActionsRequired - round.actionsCompleted} actions remaining.`
    );
  }

  // Verify game is in ROUND_SUMMARY phase
  if (round.game.currentPhase !== 'ROUND_SUMMARY') {
    throw new BadRequestError('Game is not in round summary phase');
  }

  // Check if summary already exists
  if (round.summary) {
    throw new BadRequestError('Round summary already submitted');
  }

  // Calculate round statistics
  const actionResults = round.actions
    .filter((a) => a.tokenDraw)
    .map((a) => ({
      resultValue: a.tokenDraw!.resultValue,
      resultType: a.tokenDraw!.resultType,
    }));

  const netResult = actionResults.reduce((sum, r) => sum + r.resultValue, 0);
  const triumphs = actionResults.filter((r) => r.resultType === 'TRIUMPH').length;
  const disasters = actionResults.filter((r) => r.resultType === 'DISASTER').length;

  // Create summary
  const summary = await db.roundSummary.create({
    data: {
      roundId,
      authorId: (await db.gamePlayer.findFirst({
        where: { gameId: round.gameId, userId, isActive: true },
      }))!.id,
      content: data.content,
      outcomes: {
        totalTriumphs: data.outcomes?.totalTriumphs ?? triumphs,
        totalDisasters: data.outcomes?.totalDisasters ?? disasters,
        netMomentum: data.outcomes?.netMomentum ?? netResult,
        keyEvents: data.outcomes?.keyEvents ?? [],
        // Computed stats
        actionsCompleted: round.actionsCompleted,
        actionResults: actionResults,
      },
    },
  });

  // Mark round as complete
  await db.round.update({
    where: { id: roundId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });

  await logGameEvent(round.gameId, userId, 'ROUND_SUMMARY_SUBMITTED', {
    roundId,
    roundNumber: round.roundNumber,
    netResult,
  });

  // Create next round
  const nextRound = await createNextRound(round.gameId, round.roundNumber + 1);

  await logGameEvent(round.gameId, null, 'ROUND_STARTED', {
    roundNumber: nextRound.roundNumber,
  });

  // Notify players about new round
  notifyNewRound(round.gameId, round.game.name, nextRound.roundNumber).catch(
    () => {}
  );

  return {
    summary,
    nextRound,
  };
}

export async function getRoundSummary(roundId: string, userId: string) {
  const round = await db.round.findUnique({
    where: { id: roundId },
  });

  if (!round) {
    throw new NotFoundError('Round not found');
  }

  await requireMember(round.gameId, userId);

  const summary = await db.roundSummary.findUnique({
    where: { roundId },
    include: {
      author: {
        include: {
          user: { select: { displayName: true } },
        },
      },
    },
  });

  if (!summary) {
    throw new NotFoundError('Round summary not found');
  }

  return summary;
}

/**
 * Host can edit an existing round summary's content
 */
export async function updateRoundSummary(
  roundId: string,
  userId: string,
  data: UpdateRoundSummaryInput
) {
  const round = await db.round.findUnique({
    where: { id: roundId },
    include: { summary: true },
  });

  if (!round) {
    throw new NotFoundError('Round not found');
  }

  if (!round.summary) {
    throw new NotFoundError('Round summary not found');
  }

  const hostPlayer = await db.gamePlayer.findFirst({
    where: { gameId: round.gameId, userId, isActive: true, isHost: true },
  });

  if (!hostPlayer) {
    throw new ForbiddenError('Only the game host can perform this action');
  }

  const updatedSummary = await db.roundSummary.update({
    where: { roundId },
    data: { content: data.content },
  });

  await logGameEvent(round.gameId, userId, 'ROUND_SUMMARY_EDITED', {
    roundId,
  });

  return updatedSummary;
}

async function createNextRound(gameId: string, roundNumber: number) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      players: { where: { isActive: true } },
    },
  });

  if (!game || game.deletedAt) {
    throw new NotFoundError('Game not found');
  }

  // Create new round
  const newRound = await db.round.create({
    data: {
      gameId,
      roundNumber,
      status: 'IN_PROGRESS',
      totalActionsRequired: game.players.length,
    },
  });

  // Update game to point to new round and reset phase
  await db.game.update({
    where: { id: gameId },
    data: {
      currentRoundId: newRound.id,
      currentPhase: 'PROPOSAL',
      currentActionId: null,
    },
  });

  return newRound;
}
