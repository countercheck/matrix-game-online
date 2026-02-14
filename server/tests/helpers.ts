import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './setup.js';

export async function createTestUser(
  overrides: Partial<{
    email: string;
    displayName: string;
    password: string;
  }> = {}
) {
  const password = overrides.password || 'TestPassword123';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: overrides.email || `test-${Date.now()}@example.com`,
      displayName: overrides.displayName || 'Test User',
      passwordHash,
    },
  });

  return { user, password };
}

export function generateToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET || 'test-secret-key', {
    expiresIn: '1h',
  });
}

export async function createTestGame(
  creatorId: string,
  overrides: Partial<{
    name: string;
    description: string;
    status: 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  }> = {}
) {
  const creator = await prisma.user.findUnique({ where: { id: creatorId } });

  const game = await prisma.game.create({
    data: {
      name: overrides.name || 'Test Game',
      description: overrides.description,
      creatorId,
      status: overrides.status || 'LOBBY',
      currentPhase: 'WAITING',
      playerCount: 1,
      players: {
        create: {
          userId: creatorId,
          playerName: creator?.displayName || 'Host',
          joinOrder: 1,
          isHost: true,
        },
      },
    },
    include: {
      players: true,
    },
  });

  return game;
}

export async function addPlayerToGame(gameId: string, userId: string, playerName?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });

  const player = await prisma.gamePlayer.create({
    data: {
      gameId,
      userId,
      playerName: playerName || user?.displayName || 'Player',
      joinOrder: (game?.players.length || 0) + 1,
      isHost: false,
    },
  });

  await prisma.game.update({
    where: { id: gameId },
    data: { playerCount: { increment: 1 } },
  });

  return player;
}

export async function startTestGame(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: { where: { isActive: true } } },
  });

  if (!game) throw new Error('Game not found');

  const round = await prisma.round.create({
    data: {
      gameId,
      roundNumber: 1,
      status: 'IN_PROGRESS',
      totalActionsRequired: game.players.length,
    },
  });

  const updatedGame = await prisma.game.update({
    where: { id: gameId },
    data: {
      status: 'ACTIVE',
      currentPhase: 'PROPOSAL',
      currentRoundId: round.id,
      startedAt: new Date(),
    },
    include: {
      players: true,
      currentRound: true,
    },
  });

  return updatedGame;
}
