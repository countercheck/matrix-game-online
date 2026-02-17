import type { Server } from 'socket.io';
import { z } from 'zod';
import type { AuthenticatedSocket } from './auth.js';
import * as chatService from '../services/chat.service.js';
import { logger } from '../utils/logger.js';

interface ChannelCacheEntry {
  gameId: string;
  scope: 'GAME' | 'PERSONA' | 'DIRECT';
}

// In-memory cache: channelId -> { gameId, scope } (channels never change games or scope)
const channelCache = new Map<string, ChannelCacheEntry>();

// In-memory cache: channelId -> userId[] for PERSONA/DIRECT channels
// Private channel membership is fixed at creation, so this is safe to cache.
const channelMemberCache = new Map<string, string[]>();

async function getChannelCached(channelId: string): Promise<ChannelCacheEntry | null> {
  const cached = channelCache.get(channelId);
  if (cached) return cached;

  const channel = await chatService.getChannelInfo(channelId);
  if (channel) {
    const entry: ChannelCacheEntry = { gameId: channel.gameId, scope: channel.scope };
    channelCache.set(channelId, entry);
    return entry;
  }
  return null;
}

async function getChannelMembersCached(channelId: string): Promise<string[]> {
  const cached = channelMemberCache.get(channelId);
  if (cached) return cached;

  const userIds = await chatService.getChannelMemberUserIds(channelId);
  channelMemberCache.set(channelId, userIds);
  return userIds;
}

/** Clear all cached entries for a given game (call when game ends). */
export function clearChannelGameCache(gameId: string): void {
  for (const [channelId, entry] of channelCache) {
    if (entry.gameId === gameId) {
      channelCache.delete(channelId);
      channelMemberCache.delete(channelId);
    }
  }
}

/**
 * Emit an event to the appropriate sockets for a channel.
 * - GAME scope: broadcast to the game room (all game members are channel members)
 * - PERSONA/DIRECT scope: emit only to member user rooms
 *
 * @param excludeSocketId - Socket ID to exclude (for typing self-exclusion)
 */
export async function emitToChannel(
  io: Server,
  channelId: string,
  event: string,
  data: unknown,
  excludeSocketId?: string
): Promise<void> {
  const entry = await getChannelCached(channelId);
  if (!entry) return;

  if (entry.scope === 'GAME') {
    // All game members are channel members - use the game room broadcast
    if (excludeSocketId) {
      io.to(`game:${entry.gameId}`).except(excludeSocketId).emit(event, data);
    } else {
      io.to(`game:${entry.gameId}`).emit(event, data);
    }
    return;
  }

  // PERSONA or DIRECT: emit only to member user rooms
  const userIds = await getChannelMembersCached(channelId);
  for (const userId of userIds) {
    if (excludeSocketId) {
      io.to(`user:${userId}`).except(excludeSocketId).emit(event, data);
    } else {
      io.to(`user:${userId}`).emit(event, data);
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

      // Broadcast to channel members only (privacy-aware routing)
      await emitToChannel(io, parsed.channelId, 'new-message', message);

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

      // Broadcast typing to channel members only, excluding sender
      await emitToChannel(
        io,
        parsed.channelId,
        'typing',
        {
          channelId: parsed.channelId,
          userId,
          displayName: socket.data.displayName,
          isTyping: parsed.isTyping,
        },
        socket.id
      );
    } catch (error) {
      logger.error('Socket typing error', {
        error,
        userId,
      });
      // Typing is best-effort, no ack needed
    }
  });
}
