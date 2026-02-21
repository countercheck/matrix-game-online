import { db } from '../config/database.js';
import { GamePhase, Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { logGameEvent, transitionPhase } from './game.service.js';
import { notifyResolutionReady } from './notification.service.js';
import { getStrategy } from './resolution/index.js';

/**
 * Arbiter toggles the isStrong flag on an argument during ARBITER_REVIEW.
 */
export async function markArgumentStrong(actionId: string, argumentId: string, userId: string) {
  const action = await db.action.findUnique({
    where: { id: actionId },
    include: { game: { select: { id: true, currentPhase: true } } },
  });

  if (!action) {
    throw new NotFoundError('Action not found');
  }

  if (action.game.currentPhase !== 'ARBITER_REVIEW') {
    throw new BadRequestError('Can only mark arguments during arbiter review phase');
  }

  const player = await db.gamePlayer.findFirst({
    where: { gameId: action.gameId, userId, isActive: true, gameRole: 'ARBITER' },
  });

  if (!player) {
    throw new ForbiddenError('Only the arbiter can mark arguments as strong');
  }

  const argument = await db.argument.findUnique({
    where: { id: argumentId },
  });

  if (!argument || argument.actionId !== actionId) {
    throw new NotFoundError('Argument not found');
  }

  const updated = await db.argument.update({
    where: { id: argumentId },
    data: { isStrong: !argument.isStrong },
    include: {
      player: { include: { user: { select: { displayName: true } } } },
    },
  });

  await logGameEvent(action.gameId, userId, 'ARGUMENT_STRENGTH_TOGGLED', {
    actionId,
    argumentId,
    isStrong: updated.isStrong,
  });

  return updated;
}

/**
 * Arbiter completes the review: rolls 2d6, resolves, transitions to RESOLUTION.
 */
export async function completeArbiterReview(actionId: string, userId: string) {
  const action = await db.action.findUnique({
    where: { id: actionId },
    include: {
      game: {
        select: { id: true, name: true, currentPhase: true, settings: true },
      },
      arguments: { select: { argumentType: true, isStrong: true } },
      initiator: { include: { user: { select: { id: true } } } },
    },
  });

  if (!action) {
    throw new NotFoundError('Action not found');
  }

  if (action.game.currentPhase !== 'ARBITER_REVIEW') {
    throw new BadRequestError('Game is not in arbiter review phase');
  }

  const arbiter = await db.gamePlayer.findFirst({
    where: { gameId: action.gameId, userId, isActive: true, gameRole: 'ARBITER' },
  });

  if (!arbiter) {
    throw new ForbiddenError('Only the arbiter can complete the review');
  }

  const settings = (action.game.settings as Record<string, unknown>) || {};
  const strategyId = (settings.resolutionMethod as string) || 'arbiter';
  const strategy = getStrategy(strategyId);

  if (strategy.type !== 'arbiter') {
    throw new BadRequestError('Current strategy does not support arbiter review');
  }

  // Count strong arguments by side
  const proTypes = ['FOR', 'INITIATOR_FOR'];
  const strongProCount = action.arguments.filter(
    (a) => a.isStrong && proTypes.includes(a.argumentType)
  ).length;
  const strongAntiCount = action.arguments.filter(
    (a) => a.isStrong && a.argumentType === 'AGAINST'
  ).length;

  const resolutionResult = strategy.resolve({ strongProCount, strongAntiCount });

  await db.action.update({
    where: { id: actionId },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolutionMethod: strategyId,
      resolutionData: {
        ...resolutionResult.strategyData,
        resultType: resolutionResult.resultType,
        resultValue: resolutionResult.resultValue,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  await transitionPhase(action.gameId, GamePhase.RESOLUTION);

  await logGameEvent(action.gameId, userId, 'ARBITER_REVIEW_COMPLETED', {
    actionId,
    strategy: strategyId,
    result: resolutionResult.resultType,
    value: resolutionResult.resultValue,
    diceRoll: resolutionResult.strategyData['diceRoll'] as Prisma.InputJsonValue,
    strongProCount,
    strongAntiCount,
  });

  // Notify initiator that resolution is ready
  notifyResolutionReady(
    action.gameId,
    action.game.name,
    action.initiator.userId,
    action.actionDescription
  ).catch((error) => {
    logger.warn('Failed to send resolution ready notification', {
      gameId: action.gameId,
      initiatorId: action.initiator.userId,
      error,
    });
  });

  return {
    resultType: resolutionResult.resultType,
    resultValue: resolutionResult.resultValue,
    ...resolutionResult.strategyData,
  };
}
