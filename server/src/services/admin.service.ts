import { UserRole, GameStatus, Prisma } from '@prisma/client';
import { db } from '../config/database.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import type {
  ListUsersQuery,
  UpdateUserRoleInput,
  BanUserInput,
  ListGamesQuery,
  ListAuditLogsQuery,
} from '../utils/admin.validators.js';

// ============================================================================
// Audit Logging
// ============================================================================

interface AuditLogData {
  adminId: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAdminAction(data: AuditLogData) {
  return db.adminAuditLog.create({
    data: {
      adminId: data.adminId,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      details: data.details ?? {},
      ipAddress: data.ipAddress,
    },
  });
}

// ============================================================================
// Dashboard
// ============================================================================

export async function getDashboardStats() {
  const [
    totalUsers,
    bannedUsers,
    activeGames,
    completedGames,
    recentUsers,
    recentGames,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { isBanned: true } }),
    db.game.count({ where: { status: { in: [GameStatus.LOBBY, GameStatus.ACTIVE] } } }),
    db.game.count({ where: { status: GameStatus.COMPLETED } }),
    db.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        createdAt: true,
      },
    }),
    db.game.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        playerCount: true,
        createdAt: true,
        creator: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    }),
  ]);

  return {
    stats: {
      totalUsers,
      bannedUsers,
      activeGames,
      completedGames,
    },
    recentUsers,
    recentGames,
  };
}

// ============================================================================
// User Management
// ============================================================================

export async function listUsers(query: ListUsersQuery) {
  const { page, limit, search, role, isBanned, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { displayName: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.role = role;
  }

  if (isBanned !== undefined) {
    where.isBanned = isBanned;
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isBanned: true,
        bannedAt: true,
        bannedReason: true,
        createdAt: true,
        lastLogin: true,
        _count: {
          select: {
            gamePlayers: true,
            createdGames: true,
          },
        },
      },
    }),
    db.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getUserDetails(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      isBanned: true,
      bannedAt: true,
      bannedReason: true,
      createdAt: true,
      updatedAt: true,
      lastLogin: true,
      _count: {
        select: {
          gamePlayers: true,
          createdGames: true,
        },
      },
      createdGames: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
        },
      },
      gamePlayers: {
        take: 10,
        orderBy: { joinedAt: 'desc' },
        select: {
          id: true,
          playerName: true,
          isHost: true,
          joinedAt: true,
          game: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
}

export async function updateUserRole(
  adminId: string,
  userId: string,
  data: UpdateUserRoleInput,
  ipAddress?: string
) {
  // Prevent self-demotion
  if (adminId === userId) {
    throw new BadRequestError('Cannot change your own role');
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const previousRole = user.role;

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: { role: data.role },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
    },
  });

  await logAdminAction({
    adminId,
    action: 'UPDATE_ROLE',
    targetType: 'USER',
    targetId: userId,
    details: {
      previousRole,
      newRole: data.role,
      userEmail: user.email,
    },
    ipAddress,
  });

  return updatedUser;
}

export async function banUser(
  adminId: string,
  userId: string,
  data: BanUserInput,
  ipAddress?: string
) {
  // Prevent self-ban
  if (adminId === userId) {
    throw new BadRequestError('Cannot ban yourself');
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isBanned: true, email: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Prevent banning admins (only another admin could do this via different means)
  if (user.role === UserRole.ADMIN) {
    throw new ForbiddenError('Cannot ban admin users');
  }

  if (user.isBanned) {
    throw new BadRequestError('User is already banned');
  }

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: {
      isBanned: true,
      bannedAt: new Date(),
      bannedReason: data.reason,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      isBanned: true,
      bannedAt: true,
      bannedReason: true,
    },
  });

  await logAdminAction({
    adminId,
    action: 'BAN_USER',
    targetType: 'USER',
    targetId: userId,
    details: {
      reason: data.reason,
      userEmail: user.email,
    },
    ipAddress,
  });

  return updatedUser;
}

export async function unbanUser(adminId: string, userId: string, ipAddress?: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, isBanned: true, email: true, bannedReason: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (!user.isBanned) {
    throw new BadRequestError('User is not banned');
  }

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: {
      isBanned: false,
      bannedAt: null,
      bannedReason: null,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      isBanned: true,
    },
  });

  await logAdminAction({
    adminId,
    action: 'UNBAN_USER',
    targetType: 'USER',
    targetId: userId,
    details: {
      previousBanReason: user.bannedReason,
      userEmail: user.email,
    },
    ipAddress,
  });

  return updatedUser;
}

// ============================================================================
// Game Management
// ============================================================================

export async function listGames(query: ListGamesQuery) {
  const { page, limit, status, creatorId, search, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.GameWhereInput = {};

  if (status) {
    where.status = status;
  }

  if (creatorId) {
    where.creatorId = creatorId;
  }

  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const [games, total] = await Promise.all([
    db.game.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        currentPhase: true,
        playerCount: true,
        createdAt: true,
        updatedAt: true,
        startedAt: true,
        completedAt: true,
        creator: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            rounds: true,
            actions: true,
          },
        },
      },
    }),
    db.game.count({ where }),
  ]);

  return {
    games,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getGameDetails(gameId: string) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      creator: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
      players: {
        select: {
          id: true,
          userId: true,
          playerName: true,
          isHost: true,
          isNpc: true,
          isActive: true,
          joinedAt: true,
          user: {
            select: {
              email: true,
              displayName: true,
            },
          },
        },
      },
      _count: {
        select: {
          rounds: true,
          actions: true,
          events: true,
        },
      },
    },
  });

  if (!game) {
    throw new NotFoundError('Game not found');
  }

  return game;
}

export async function deleteGame(adminId: string, gameId: string, ipAddress?: string) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      name: true,
      status: true,
      creatorId: true,
      playerCount: true,
    },
  });

  if (!game) {
    throw new NotFoundError('Game not found');
  }

  // Delete the game (cascades to related records)
  await db.game.delete({
    where: { id: gameId },
  });

  await logAdminAction({
    adminId,
    action: 'DELETE_GAME',
    targetType: 'GAME',
    targetId: gameId,
    details: {
      gameName: game.name,
      gameStatus: game.status,
      creatorId: game.creatorId,
      playerCount: game.playerCount,
    },
    ipAddress,
  });

  return { success: true, message: 'Game deleted successfully' };
}

export async function pauseGame(adminId: string, gameId: string, ipAddress?: string) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    select: { id: true, name: true, status: true },
  });

  if (!game) {
    throw new NotFoundError('Game not found');
  }

  if (game.status !== GameStatus.ACTIVE) {
    throw new BadRequestError('Only active games can be paused');
  }

  const updatedGame = await db.game.update({
    where: { id: gameId },
    data: { status: GameStatus.PAUSED },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  await logAdminAction({
    adminId,
    action: 'PAUSE_GAME',
    targetType: 'GAME',
    targetId: gameId,
    details: {
      gameName: game.name,
      previousStatus: game.status,
    },
    ipAddress,
  });

  return updatedGame;
}

export async function resumeGame(adminId: string, gameId: string, ipAddress?: string) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    select: { id: true, name: true, status: true },
  });

  if (!game) {
    throw new NotFoundError('Game not found');
  }

  if (game.status !== GameStatus.PAUSED) {
    throw new BadRequestError('Only paused games can be resumed');
  }

  const updatedGame = await db.game.update({
    where: { id: gameId },
    data: { status: GameStatus.ACTIVE },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  await logAdminAction({
    adminId,
    action: 'RESUME_GAME',
    targetType: 'GAME',
    targetId: gameId,
    details: {
      gameName: game.name,
    },
    ipAddress,
  });

  return updatedGame;
}

export async function removePlayerFromGame(
  adminId: string,
  gameId: string,
  playerId: string,
  ipAddress?: string
) {
  const player = await db.gamePlayer.findUnique({
    where: { id: playerId },
    include: {
      user: {
        select: { email: true, displayName: true },
      },
      game: {
        select: { id: true, name: true, playerCount: true },
      },
    },
  });

  if (!player) {
    throw new NotFoundError('Player not found');
  }

  if (player.gameId !== gameId) {
    throw new BadRequestError('Player is not in this game');
  }

  if (!player.isActive) {
    throw new BadRequestError('Player is already inactive');
  }

  // Mark player as inactive rather than deleting
  await db.gamePlayer.update({
    where: { id: playerId },
    data: { isActive: false },
  });

  // Update player count
  await db.game.update({
    where: { id: gameId },
    data: { playerCount: { decrement: 1 } },
  });

  await logAdminAction({
    adminId,
    action: 'REMOVE_PLAYER',
    targetType: 'GAME_PLAYER',
    targetId: playerId,
    details: {
      gameId,
      gameName: player.game.name,
      playerName: player.playerName,
      userId: player.userId,
      userEmail: player.user.email,
    },
    ipAddress,
  });

  return { success: true, message: 'Player removed from game' };
}

// ============================================================================
// Audit Logs
// ============================================================================

export async function listAuditLogs(query: ListAuditLogsQuery) {
  const { page, limit, adminId, action, targetType, targetId, startDate, endDate } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.AdminAuditLogWhereInput = {};

  if (adminId) {
    where.adminId = adminId;
  }

  if (action) {
    where.action = action;
  }

  if (targetType) {
    where.targetType = targetType;
  }

  if (targetId) {
    where.targetId = targetId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = startDate;
    }
    if (endDate) {
      where.createdAt.lte = endDate;
    }
  }

  const [logs, total] = await Promise.all([
    db.adminAuditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    }),
    db.adminAuditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
