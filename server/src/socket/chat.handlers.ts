import type { Server } from 'socket.io';
import { z } from 'zod';
import type { AuthenticatedSocket } from './auth.js';
import * as chatService from '../services/chat.service.js';
import { logger } from '../utils/logger.js';

// In-memory cache: channelId -> gameId (channels never change games)
const channelGameCache = new Map<string, string>();

async function getChannelGameIdCached(channelId: string): Promise<string | null> {
  const cached = channelGameCache.get(channelId);
  if (cached) return cached;

  const channel = await chatService.getChannelGameId(channelId);
  if (channel) {
    channelGameCache.set(channelId, channel.gameId);
    return channel.gameId;
  }
  return null;
}

/** Clear all cached entries for a given game (call when game ends). */
export function clearChannelGameCache(gameId: string): void {
  for (const [channelId, cachedGameId] of channelGameCache) {
    if (cachedGameId === gameId) {
      channelGameCache.delete(channelId);
    }
  }
}

// Socket-specific schema (includes channelId since it's part of the socket event)
const socketSendMessageSchema = z.object({
  channelId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  replyToId: z.string().uuid().optional(),
});

const markReadSchema = z.object({
  channelId: z.string().uuid(),
});

const typingSchema = z.object({
  channelId: z.string().uuid(),
  isTyping: z.boolean(),
});

export function handleChatEvents(io: Server, socket: AuthenticatedSocket): void {
  const userId = socket.data.userId;

  socket.on('send-message', async (data: unknown, ack?: (response: unknown) => void) => {
    try {
      const parsed = socketSendMessageSchema.parse(data);
      const message = await chatService.sendMessage(
        userId,
        parsed.channelId,
        parsed.content,
        parsed.replyToId
      );

      // Find the game room for this channel to broadcast (cached)
      const gameId = await getChannelGameIdCached(parsed.channelId);
      if (gameId) {
        io.to(`game:${gameId}`).emit('new-message', message);
      }

      if (ack) ack({ success: true, data: message });
    } catch (error) {
      logger.error('Socket send-message error', { error, userId });
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      if (ack) ack({ success: false, error: errorMessage });
    }
  });

  socket.on('mark-read', async (data: unknown, ack?: (response: unknown) => void) => {
    try {
      const parsed = markReadSchema.parse(data);
      await chatService.markChannelRead(userId, parsed.channelId);
      if (ack) ack({ success: true });
    } catch (error) {
      logger.error('Socket mark-read error', { error, userId });
      if (ack) ack({ success: false });
    }
  });

  socket.on('typing', async (data: unknown) => {
    try {
      const parsed = typingSchema.parse(data);

      // Use cached channel-to-game mapping (no DB query per typing event)
      const gameId = await getChannelGameIdCached(parsed.channelId);
      if (gameId) {
        socket.to(`game:${gameId}`).emit('typing', {
          channelId: parsed.channelId,
          userId,
          displayName: socket.data.displayName,
          isTyping: parsed.isTyping,
        });
      }
    } catch (error) {
      logger.error('Socket typing error', {
        error,
        userId,
      });
      // Typing is best-effort, no ack needed
    }
  });
}
