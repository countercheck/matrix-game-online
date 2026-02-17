import type { Server } from 'socket.io';
import { z } from 'zod';
import type { AuthenticatedSocket } from './auth.js';
import * as chatService from '../services/chat.service.js';
import { logger } from '../utils/logger.js';

const sendMessageSchema = z.object({
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
      const parsed = sendMessageSchema.parse(data);
      const message = await chatService.sendMessage(
        userId,
        parsed.channelId,
        parsed.content,
        parsed.replyToId
      );

      // Find the game room for this channel to broadcast
      const channel = await chatService.getChannelGameId(parsed.channelId);
      if (channel) {
        io.to(`game:${channel.gameId}`).emit('new-message', message);
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

  socket.on('typing', (data: unknown) => {
    try {
      const parsed = typingSchema.parse(data);
      // Broadcast to game room (find via channel membership)
      chatService.getChannelGameId(parsed.channelId).then((channel) => {
        if (channel) {
          socket.to(`game:${channel.gameId}`).emit('typing', {
            channelId: parsed.channelId,
            userId,
            displayName: socket.data.displayName,
            isTyping: parsed.isTyping,
          });
        }
      });
    } catch {
      // Typing is best-effort, no ack needed
    }
  });
}
