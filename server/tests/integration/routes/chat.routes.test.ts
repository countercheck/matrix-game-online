import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';
import { db } from '../../../src/config/database.js';
import { hashPassword } from '../../../src/services/auth.service.js';
import jwt from 'jsonwebtoken';

describe('Chat Routes - Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let gameId: string;
  let playerId: string;
  let otherUserId: string;
  let otherPlayerId: string;

  beforeEach(async () => {
    // Create test user
    const hashedPassword = await hashPassword('password123');
    const user = await db.user.create({
      data: {
        email: 'chat-test@example.com',
        displayName: 'Chat Tester',
        passwordHash: hashedPassword,
      },
    });
    userId = user.id;

    // Create second test user
    const otherUser = await db.user.create({
      data: {
        email: 'chat-other@example.com',
        displayName: 'Other Tester',
        passwordHash: hashedPassword,
      },
    });
    otherUserId = otherUser.id;

    // Generate auth token
    authToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create a test game with ACTIVE status
    const game = await db.game.create({
      data: {
        name: 'Chat Test Game',
        description: 'Game for chat testing',
        creatorId: userId,
        status: 'ACTIVE',
        currentPhase: 'PROPOSAL',
        settings: {},
      },
    });
    gameId = game.id;

    // Create game players
    const player = await db.gamePlayer.create({
      data: {
        gameId,
        userId,
        playerName: 'Chat Tester',
        joinOrder: 1,
        isHost: true,
      },
    });
    playerId = player.id;

    const otherPlayer = await db.gamePlayer.create({
      data: {
        gameId,
        userId: otherUserId,
        playerName: 'Other Tester',
        joinOrder: 2,
        isHost: false,
      },
    });
    otherPlayerId = otherPlayer.id;

    // Create game channel
    await db.chatChannel.create({
      data: {
        gameId,
        scope: 'GAME',
        name: 'Game Chat',
        scopeKey: '',
        members: {
          create: [{ playerId }, { playerId: otherPlayerId }],
        },
      },
    });
  });

  afterEach(async () => {
    // Clean up in reverse order of dependencies
    await db.chatMessage.deleteMany();
    await db.chatChannelMember.deleteMany();
    await db.chatChannel.deleteMany();
    await db.gamePlayer.deleteMany();
    await db.game.deleteMany();
    await db.user.deleteMany();
  });

  describe('GET /api/games/:gameId/chat/channels', () => {
    it('should return channels for authenticated game member', async () => {
      const response = await request(app)
        .get(`/api/games/${gameId}/chat/channels`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        scope: 'GAME',
        name: 'Game Chat',
        unreadCount: 0,
      });
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app).get(`/api/games/${gameId}/chat/channels`);

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-member', async () => {
      // Create a third user who is not a game member
      const hashedPassword = await hashPassword('password123');
      const nonMember = await db.user.create({
        data: {
          email: 'non-member@example.com',
          displayName: 'Non Member',
          passwordHash: hashedPassword,
        },
      });

      const nonMemberToken = jwt.sign(
        { userId: nonMember.id, email: nonMember.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get(`/api/games/${gameId}/chat/channels`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(response.status).toBe(403);

      // Cleanup
      await db.user.delete({ where: { id: nonMember.id } });
    });

    it('should include unread count for channels with new messages', async () => {
      const channel = await db.chatChannel.findFirst({
        where: { gameId, scope: 'GAME' },
      });

      // Other player sends a message
      await db.chatMessage.create({
        data: {
          channelId: channel!.id,
          senderPlayerId: otherPlayerId,
          content: 'Test message',
        },
      });

      const response = await request(app)
        .get(`/api/games/${gameId}/chat/channels`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data[0].unreadCount).toBe(1);
    });

    it('should include last message in channel list', async () => {
      const channel = await db.chatChannel.findFirst({
        where: { gameId, scope: 'GAME' },
      });

      await db.chatMessage.create({
        data: {
          channelId: channel!.id,
          senderPlayerId: playerId,
          content: 'Last message content',
        },
      });

      const response = await request(app)
        .get(`/api/games/${gameId}/chat/channels`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data[0].lastMessage).toMatchObject({
        content: 'Last message content',
        senderName: 'Chat Tester',
      });
    });
  });

  describe('POST /api/games/:gameId/chat/channels', () => {
    it('should create direct channel between players', async () => {
      const response = await request(app)
        .post(`/api/games/${gameId}/chat/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'DIRECT',
          playerIds: [otherPlayerId],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        scope: 'DIRECT',
        gameId,
      });
    });

    it('should return existing channel if already created', async () => {
      // Create channel first time
      const response1 = await request(app)
        .post(`/api/games/${gameId}/chat/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'DIRECT',
          playerIds: [otherPlayerId],
        });

      const channelId1 = response1.body.data.id;

      // Try to create same channel again
      const response2 = await request(app)
        .post(`/api/games/${gameId}/chat/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'DIRECT',
          playerIds: [otherPlayerId],
        });

      expect(response2.status).toBe(201);
      expect(response2.body.data.id).toBe(channelId1);
    });

    it('should create persona channel', async () => {
      // Create personas
      const persona1 = await db.persona.create({
        data: {
          gameId,
          name: 'Persona One',
          description: 'test',
        },
      });
      const persona2 = await db.persona.create({
        data: {
          gameId,
          name: 'Persona Two',
          description: 'test',
        },
      });

      // Assign personas to players
      await db.gamePlayer.update({
        where: { id: playerId },
        data: { personaId: persona1.id },
      });
      await db.gamePlayer.update({
        where: { id: otherPlayerId },
        data: { personaId: persona2.id },
      });

      const response = await request(app)
        .post(`/api/games/${gameId}/chat/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'PERSONA',
          personaIds: [persona1.id, persona2.id],
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        scope: 'PERSONA',
        name: 'Persona One & Persona Two',
      });
    });

    it('should return 400 if game is in LOBBY status', async () => {
      // Create a lobby game
      const lobbyGame = await db.game.create({
        data: {
          name: 'Lobby Game',
          creatorId: userId,
          status: 'LOBBY',
          currentPhase: 'WAITING',
          settings: {},
        },
      });

      await db.gamePlayer.create({
        data: {
          gameId: lobbyGame.id,
          userId,
          playerName: 'Chat Tester',
          joinOrder: 1,
          isHost: true,
        },
      });

      const response = await request(app)
        .post(`/api/games/${lobbyGame.id}/chat/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'DIRECT',
          playerIds: [otherPlayerId],
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Chat is not available until the game starts');

      // Cleanup
      await db.gamePlayer.deleteMany({ where: { gameId: lobbyGame.id } });
      await db.game.delete({ where: { id: lobbyGame.id } });
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post(`/api/games/${gameId}/chat/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'DIRECT',
          // Missing playerIds
        });

      expect(response.status).toBe(400);
    });

    it('should return 403 if persona chat is disabled', async () => {
      // Update game settings to disable persona chat
      await db.game.update({
        where: { id: gameId },
        data: {
          settings: {
            chat: { enablePersonaChat: false },
          },
        },
      });

      const persona = await db.persona.create({
        data: {
          gameId,
          name: 'Test Persona',
          description: 'test',
        },
      });

      const response = await request(app)
        .post(`/api/games/${gameId}/chat/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'PERSONA',
          personaIds: [persona.id],
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('Persona chat is disabled');
    });

    it('should return 403 if direct chat is disabled', async () => {
      // Update game settings to disable direct chat
      await db.game.update({
        where: { id: gameId },
        data: {
          settings: {
            chat: { enableDirectChat: false },
          },
        },
      });

      const response = await request(app)
        .post(`/api/games/${gameId}/chat/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'DIRECT',
          playerIds: [otherPlayerId],
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('Direct messages are disabled');
    });
  });

  describe('GET /api/games/:gameId/chat/channels/:channelId/messages', () => {
    let channelId: string;

    beforeEach(async () => {
      const channel = await db.chatChannel.findFirst({
        where: { gameId, scope: 'GAME' },
      });
      channelId = channel!.id;

      // Create some messages
      await db.chatMessage.createMany({
        data: [
          {
            channelId,
            senderPlayerId: playerId,
            content: 'Message 1',
          },
          {
            channelId,
            senderPlayerId: otherPlayerId,
            content: 'Message 2',
          },
          {
            channelId,
            senderPlayerId: playerId,
            content: 'Message 3',
          },
        ],
      });
    });

    it('should return messages for channel member', async () => {
      const response = await request(app)
        .get(`/api/games/${gameId}/chat/channels/${channelId}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
    });

    it('should support pagination with limit', async () => {
      const response = await request(app)
        .get(`/api/games/${gameId}/chat/channels/${channelId}/messages?limit=2`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });

    it('should support cursor pagination with before parameter', async () => {
      // Get all messages first
      const allMessages = await request(app)
        .get(`/api/games/${gameId}/chat/channels/${channelId}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      const firstMessageId = allMessages.body.data[0].id;

      // Get messages before first one
      const response = await request(app)
        .get(`/api/games/${gameId}/chat/channels/${channelId}/messages?before=${firstMessageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((m: any) => m.id !== firstMessageId)).toBe(true);
    });

    it('should return 403 for non-member', async () => {
      // Create a third user who is not a member
      const hashedPassword = await hashPassword('password123');
      const nonMember = await db.user.create({
        data: {
          email: 'non-member2@example.com',
          displayName: 'Non Member 2',
          passwordHash: hashedPassword,
        },
      });

      const nonMemberToken = jwt.sign(
        { userId: nonMember.id, email: nonMember.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get(`/api/games/${gameId}/chat/channels/${channelId}/messages`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(response.status).toBe(403);

      // Cleanup
      await db.user.delete({ where: { id: nonMember.id } });
    });

    it('should return 404 for non-existent channel', async () => {
      const response = await request(app)
        .get(`/api/games/${gameId}/chat/channels/00000000-0000-0000-0000-000000000000/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/games/:gameId/chat/channels/:channelId/messages', () => {
    let channelId: string;

    beforeEach(async () => {
      const channel = await db.chatChannel.findFirst({
        where: { gameId, scope: 'GAME' },
      });
      channelId = channel!.id;
    });

    it('should send message to channel', async () => {
      const response = await request(app)
        .post(`/api/games/${gameId}/chat/channels/${channelId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Hello from test!',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        channelId,
        content: 'Hello from test!',
        sender: {
          playerName: 'Chat Tester',
        },
      });
    });

    it('should send message with reply', async () => {
      // Create original message
      const originalMsg = await db.chatMessage.create({
        data: {
          channelId,
          senderPlayerId: otherPlayerId,
          content: 'Original message',
        },
      });

      const response = await request(app)
        .post(`/api/games/${gameId}/chat/channels/${channelId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Reply to original',
          replyToId: originalMsg.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        content: 'Reply to original',
        replyTo: {
          id: originalMsg.id,
          content: 'Original message',
        },
      });
    });

    it('should return 400 for empty content', async () => {
      const response = await request(app)
        .post(`/api/games/${gameId}/chat/channels/${channelId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for content exceeding max length', async () => {
      const longContent = 'a'.repeat(5001);

      const response = await request(app)
        .post(`/api/games/${gameId}/chat/channels/${channelId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: longContent,
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 if reply target is in different channel', async () => {
      // Create another channel
      const otherChannel = await db.chatChannel.create({
        data: {
          gameId,
          scope: 'DIRECT',
          name: 'Other Channel',
          scopeKey: `${playerId},${otherPlayerId}`,
          members: {
            create: [{ playerId }, { playerId: otherPlayerId }],
          },
        },
      });

      // Create message in other channel
      const otherMsg = await db.chatMessage.create({
        data: {
          channelId: otherChannel.id,
          senderPlayerId: otherPlayerId,
          content: 'Message in other channel',
        },
      });

      const response = await request(app)
        .post(`/api/games/${gameId}/chat/channels/${channelId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Try to reply',
          replyToId: otherMsg.id,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Reply target not found in this channel');
    });

    it('should return 403 for non-member', async () => {
      const hashedPassword = await hashPassword('password123');
      const nonMember = await db.user.create({
        data: {
          email: 'non-member3@example.com',
          displayName: 'Non Member 3',
          passwordHash: hashedPassword,
        },
      });

      const nonMemberToken = jwt.sign(
        { userId: nonMember.id, email: nonMember.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post(`/api/games/${gameId}/chat/channels/${channelId}/messages`)
        .set('Authorization', `Bearer ${nonMemberToken}`)
        .send({
          content: 'Unauthorized message',
        });

      expect(response.status).toBe(403);

      // Cleanup
      await db.user.delete({ where: { id: nonMember.id } });
    });

    it('should return 404 for non-existent channel', async () => {
      const response = await request(app)
        .post(`/api/games/${gameId}/chat/channels/00000000-0000-0000-0000-000000000000/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Message to nowhere',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/games/:gameId/chat/channels/:channelId/read', () => {
    let channelId: string;

    beforeEach(async () => {
      const channel = await db.chatChannel.findFirst({
        where: { gameId, scope: 'GAME' },
      });
      channelId = channel!.id;

      // Create some unread messages
      await db.chatMessage.createMany({
        data: [
          {
            channelId,
            senderPlayerId: otherPlayerId,
            content: 'Unread 1',
          },
          {
            channelId,
            senderPlayerId: otherPlayerId,
            content: 'Unread 2',
          },
        ],
      });
    });

    it('should mark channel as read', async () => {
      const response = await request(app)
        .post(`/api/games/${gameId}/chat/channels/${channelId}/read`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify lastReadAt was updated
      const membership = await db.chatChannelMember.findUnique({
        where: {
          channelId_playerId: { channelId, playerId },
        },
      });
      expect(membership?.lastReadAt).toBeTruthy();
    });

    it('should reduce unread count after marking as read', async () => {
      // Check unread count before
      const beforeResponse = await request(app)
        .get(`/api/games/${gameId}/chat/channels`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(beforeResponse.body.data[0].unreadCount).toBeGreaterThan(0);

      // Mark as read
      await request(app)
        .post(`/api/games/${gameId}/chat/channels/${channelId}/read`)
        .set('Authorization', `Bearer ${authToken}`);

      // Check unread count after
      const afterResponse = await request(app)
        .get(`/api/games/${gameId}/chat/channels`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(afterResponse.body.data[0].unreadCount).toBe(0);
    });

    it('should return 403 for non-member', async () => {
      const hashedPassword = await hashPassword('password123');
      const nonMember = await db.user.create({
        data: {
          email: 'non-member4@example.com',
          displayName: 'Non Member 4',
          passwordHash: hashedPassword,
        },
      });

      const nonMemberToken = jwt.sign(
        { userId: nonMember.id, email: nonMember.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post(`/api/games/${gameId}/chat/channels/${channelId}/read`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(response.status).toBe(403);

      // Cleanup
      await db.user.delete({ where: { id: nonMember.id } });
    });

    it('should return 404 for non-existent channel', async () => {
      const response = await request(app)
        .post(`/api/games/${gameId}/chat/channels/00000000-0000-0000-0000-000000000000/read`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
