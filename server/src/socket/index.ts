import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { socketAuthMiddleware, type AuthenticatedSocket } from './auth.js';
import { handleChatEvents } from './chat.handlers.js';
import { logger } from '../utils/logger.js';
import { db } from '../config/database.js';

let io: SocketIOServer | null = null;

export function initializeSocket(httpServer: HttpServer, corsOrigin: string): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  });

  const server = io;

  server.use(socketAuthMiddleware);

  server.on('connection', (socket) => {
    const authedSocket = socket as AuthenticatedSocket;
    socket.join(`user:${authedSocket.data.userId}`);
    logger.info('Socket connected', {
      socketId: socket.id,
      userId: authedSocket.data.userId,
    });

    // Game room management - verify membership before joining
    socket.on('join-game', async (gameId: string) => {
      if (typeof gameId !== 'string' || gameId.length === 0) return;

      const player = await db.gamePlayer.findFirst({
        where: { gameId, userId: authedSocket.data.userId, isActive: true },
        select: { id: true },
      });

      if (!player) {
        logger.warn('Socket join-game denied: not a game member', {
          socketId: socket.id,
          userId: authedSocket.data.userId,
          gameId,
        });
        return;
      }

      socket.join(`game:${gameId}`);
      logger.debug('Socket joined game room', { socketId: socket.id, gameId });
    });

    socket.on('leave-game', (gameId: string) => {
      if (typeof gameId === 'string' && gameId.length > 0) {
        socket.leave(`game:${gameId}`);
        logger.debug('Socket left game room', { socketId: socket.id, gameId });
      }
    });

    // Chat event handlers
    handleChatEvents(server, authedSocket);

    socket.on('disconnect', () => {
      logger.debug('Socket disconnected', { socketId: socket.id });
    });
  });

  return server;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocket first.');
  }
  return io;
}
