import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { socketAuthMiddleware, type AuthenticatedSocket } from './auth.js';
import { handleChatEvents } from './chat.handlers.js';
import { logger } from '../utils/logger.js';

let io: SocketIOServer | null = null;

export function initializeSocket(httpServer: HttpServer, corsOrigin: string): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const authedSocket = socket as AuthenticatedSocket;
    logger.info('Socket connected', {
      socketId: socket.id,
      userId: authedSocket.data.userId,
    });

    // Game room management
    socket.on('join-game', (gameId: string) => {
      if (typeof gameId === 'string' && gameId.length > 0) {
        socket.join(`game:${gameId}`);
        logger.debug('Socket joined game room', { socketId: socket.id, gameId });
      }
    });

    socket.on('leave-game', (gameId: string) => {
      if (typeof gameId === 'string' && gameId.length > 0) {
        socket.leave(`game:${gameId}`);
        logger.debug('Socket left game room', { socketId: socket.id, gameId });
      }
    });

    // Chat event handlers
    handleChatEvents(io!, authedSocket);

    socket.on('disconnect', () => {
      logger.debug('Socket disconnected', { socketId: socket.id });
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocket first.');
  }
  return io;
}
