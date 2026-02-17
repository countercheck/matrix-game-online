import { Request, Response, NextFunction } from 'express';
import * as chatService from '../services/chat.service.js';
import {
  createChannelSchema,
  getMessagesSchema,
  sendMessageSchema,
} from '../utils/chat.validators.js';
import { getIO } from '../socket/index.js';
import { logger } from '../utils/logger.js';

export async function getChannels(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
    const userId = req.user!.id;
    const channels = await chatService.getMyChannels(gameId, userId);
    res.json({ success: true, data: channels });
  } catch (error) {
    next(error);
  }
}

export async function createChannel(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
    const userId = req.user!.id;
    const input = createChannelSchema.parse(req.body);
    const channel = await chatService.findOrCreateChannel(gameId, userId, input);
    res.status(201).json({ success: true, data: channel });
  } catch (error) {
    next(error);
  }
}

export async function getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const channelId = req.params.channelId as string;
    const { limit, before } = getMessagesSchema.parse(req.query);
    const messages = await chatService.getMessages(userId, channelId, limit, before);
    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const channelId = req.params.channelId as string;
    const { content, replyToId } = sendMessageSchema.parse(req.body);
    const message = await chatService.sendMessage(userId, channelId, content, replyToId);

    // Broadcast via Socket.io
    try {
      const io = getIO();
      const channel = await chatService.getChannelGameId(channelId);
      if (channel) {
        io.to(`game:${channel.gameId}`).emit('new-message', message);
      }
    } catch (err) {
      logger.error('Failed to broadcast message via socket', { error: err });
      // Continue even if socket broadcast fails - message is still saved
    }

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
}

export async function markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const channelId = req.params.channelId as string;
    await chatService.markChannelRead(userId, channelId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}
