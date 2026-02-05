import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from './errorHandler.js';
import { db } from '../config/database.js';

export interface JWTPayload {
  userId: string;
  email: string;
}

export async function authenticateToken(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const payload = jwt.verify(token, secret) as JWTPayload;

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isBanned: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (user.isBanned) {
      throw new ForbiddenError('Your account has been banned');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else {
      next(error);
    }
  }
}

/**
 * Middleware factory to require game membership.
 * Extracts gameId from params and verifies user is an active player.
 */
export function requireGameMember(gameIdParam = 'gameId') {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const gameId = req.params[gameIdParam];
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      if (!gameId) {
        throw new ForbiddenError('Game ID is required');
      }

      const player = await db.gamePlayer.findFirst({
        where: { gameId, userId, isActive: true },
      });

      if (!player) {
        throw new ForbiddenError('Not a member of this game');
      }

      // Attach player info to request for downstream use
      req.gamePlayer = player;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware factory to require game host role.
 * Must be used after requireGameMember.
 */
export function requireGameHost(gameIdParam = 'gameId') {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const gameId = req.params[gameIdParam];
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      if (!gameId) {
        throw new ForbiddenError('Game ID is required');
      }

      const player = await db.gamePlayer.findFirst({
        where: { gameId, userId, isActive: true },
      });

      if (!player) {
        throw new ForbiddenError('Not a member of this game');
      }

      if (!player.isHost) {
        throw new ForbiddenError('Only the host can perform this action');
      }

      req.gamePlayer = player;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware factory to require action initiator role.
 * Verifies user is the initiator of the specified action.
 */
export function requireActionInitiator(actionIdParam = 'actionId') {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const actionId = req.params[actionIdParam];
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      if (!actionId) {
        throw new ForbiddenError('Action ID is required');
      }

      const action = await db.action.findUnique({
        where: { id: actionId },
        include: {
          initiator: true,
        },
      });

      if (!action) {
        throw new ForbiddenError('Action not found');
      }

      if (action.initiator.userId !== userId) {
        throw new ForbiddenError('Only the initiator can perform this action');
      }

      req.action = action;
      next();
    } catch (error) {
      next(error);
    }
  };
}
