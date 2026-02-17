import type { Server as SocketIOServer } from 'socket.io';
import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';
import { logger } from '../utils/logger.js';
import type { JWTPayload } from '../middleware/auth.middleware.js';

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    email: string;
    displayName: string;
  };
}

export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  const token = socket.handshake.auth.token as string | undefined;

  if (!token) {
    next(new Error('Authentication required'));
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    next(new Error('Server configuration error'));
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JWTPayload;

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, displayName: true, isBanned: true },
    });

    if (!user) {
      next(new Error('User not found'));
      return;
    }
    if (user.isBanned) {
      next(new Error('Account banned'));
      return;
    }

    socket.data.userId = user.id;
    socket.data.email = user.email;
    socket.data.displayName = user.displayName;
    next();
  } catch (err) {
    logger.error('Socket auth error', { error: err });
    next(new Error('Authentication failed'));
  }
}

export function setupSocketAuth(io: SocketIOServer): void {
  io.use(socketAuthMiddleware as any);
}
