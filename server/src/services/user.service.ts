import { db } from '../config/database.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import type { UpdateProfileInput, NotificationPreferencesInput } from '../utils/validators.js';

export async function getProfile(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      notificationPreferences: true,
      createdAt: true,
      lastLogin: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
}

export async function updateProfile(userId: string, data: UpdateProfileInput) {
  const user = await db.user.update({
    where: { id: userId },
    data: {
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      notificationPreferences: true,
    },
  });

  return user;
}

export async function getUserGames(userId: string) {
  const gamePlayers = await db.gamePlayer.findMany({
    where: {
      userId,
      isActive: true,
    },
    include: {
      game: {
        include: {
          currentRound: true,
          currentAction: true,
          _count: {
            select: { players: { where: { isActive: true } } },
          },
        },
      },
    },
    orderBy: {
      game: {
        updatedAt: 'desc',
      },
    },
  });

  return gamePlayers.map((gp) => ({
    id: gp.game.id,
    name: gp.game.name,
    description: gp.game.description,
    status: gp.game.status,
    currentPhase: gp.game.currentPhase,
    playerCount: gp.game._count.players,
    playerName: gp.playerName,
    isHost: gp.isHost,
    currentRound: gp.game.currentRound?.roundNumber,
    updatedAt: gp.game.updatedAt,
  }));
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: NotificationPreferencesInput
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { notificationPreferences: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const currentPrefs = (user.notificationPreferences as Record<string, unknown>) || {};
  const updatedPrefs = { ...currentPrefs, ...preferences };

  await db.user.update({
    where: { id: userId },
    data: {
      notificationPreferences: updatedPrefs,
    },
  });

  return updatedPrefs;
}
