import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { db } from '../../../src/config/database.js';
import { hashPassword } from '../../../src/services/auth.service.js';
import { setupSocketAuth, AuthenticatedSocket } from '../../../src/socket/auth.js';
import { handleChatEvents } from '../../../src/socket/chat.handlers.js';

// Test timing constants
const SOCKET_SETUP_DELAY = 100; // Time to wait for socket connection setup
const SOCKET_BROADCAST_DELAY = 200; // Time to wait for broadcast delivery

describe('Chat Socket Handlers - Integration Tests', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: SocketIOServer;
  let clientSocket: ClientSocket;
  let authToken: string;
  let userId: string;
  let gameId: string;
  let playerId: string;
  let channelId: string;
  let otherUserId: string;
  let otherPlayerId: string;
  let otherClientSocket: ClientSocket;
  let otherAuthToken: string;

  const PORT = 3001;

  beforeAll(async () => {
    // Create HTTP server and Socket.IO server
    httpServer = createServer();
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        credentials: true,
      },
    });

    // Setup socket authentication
    setupSocketAuth(io);

    // Setup connection handlers
    io.on('connection', (socket: AuthenticatedSocket) => {
      // Join user room for private channel routing
      socket.join(`user:${socket.data.userId}`);

      // Game room management
      socket.on('join-game', (gameId: string) => {
        if (typeof gameId === 'string' && gameId.length > 0) {
          socket.join(`game:${gameId}`);
        }
      });

      // Chat event handlers
      handleChatEvents(io, socket);
    });

    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(PORT, resolve);
    });
  });

  afterAll(async () => {
    io.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  beforeEach(async () => {
    // Create test users
    const hashedPassword = await hashPassword('password123');
    const user = await db.user.create({
      data: {
        email: 'socket-test@example.com',
        displayName: 'Socket Tester',
        passwordHash: hashedPassword,
      },
    });
    userId = user.id;

    const otherUser = await db.user.create({
      data: {
        email: 'socket-other@example.com',
        displayName: 'Other Socket Tester',
        passwordHash: hashedPassword,
      },
    });
    otherUserId = otherUser.id;

    // Generate auth tokens
    authToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    otherAuthToken = jwt.sign(
      { userId: otherUser.id, email: otherUser.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test game
    const game = await db.game.create({
      data: {
        name: 'Socket Test Game',
        description: 'Game for socket testing',
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
        playerName: 'Socket Tester',
        joinOrder: 1,
        isHost: true,
      },
    });
    playerId = player.id;

    const otherPlayer = await db.gamePlayer.create({
      data: {
        gameId,
        userId: otherUserId,
        playerName: 'Other Socket Tester',
        joinOrder: 2,
        isHost: false,
      },
    });
    otherPlayerId = otherPlayer.id;

    // Create game channel
    const channel = await db.chatChannel.create({
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
    channelId = channel.id;

    // Connect client sockets
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        clientSocket = ioClient(`http://localhost:${PORT}`, {
          auth: { token: authToken },
          transports: ['websocket'],
        });
        clientSocket.on('connect', () => {
          // Join game room
          clientSocket.emit('join-game', gameId);
          setTimeout(() => resolve(), SOCKET_SETUP_DELAY);
        });
        clientSocket.on('connect_error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        otherClientSocket = ioClient(`http://localhost:${PORT}`, {
          auth: { token: otherAuthToken },
          transports: ['websocket'],
        });
        otherClientSocket.on('connect', () => {
          // Join game room
          otherClientSocket.emit('join-game', gameId);
          setTimeout(() => resolve(), SOCKET_SETUP_DELAY);
        });
        otherClientSocket.on('connect_error', reject);
      }),
    ]);
  });

  afterEach(async () => {
    // Disconnect sockets
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
    if (otherClientSocket?.connected) {
      otherClientSocket.disconnect();
    }

    // Clean up database - order matters due to foreign key constraints
    await db.chatMessage.deleteMany();
    await db.chatChannelMember.deleteMany();
    await db.chatChannel.deleteMany();
    await db.action.deleteMany();
    await db.gamePlayer.deleteMany();
    await db.game.deleteMany();
    await db.user.deleteMany();
  });

  describe('send-message event', () => {
    it('should send message and broadcast to game room', async () => {
      const messageData = {
        channelId,
        content: 'Hello from socket!',
      };

      // Listen for broadcast on other client
      const broadcastPromise = new Promise<any>((resolve) => {
        otherClientSocket.on('new-message', resolve);
      });

      // Send message
      const ackPromise = new Promise<any>((resolve) => {
        clientSocket.emit('send-message', messageData, resolve);
      });

      const [ackResponse, broadcastMessage] = await Promise.all([ackPromise, broadcastPromise]);

      // Verify acknowledgment
      expect(ackResponse.success).toBe(true);
      expect(ackResponse.data).toMatchObject({
        channelId,
        content: 'Hello from socket!',
        sender: {
          playerName: 'Socket Tester',
        },
      });

      // Verify broadcast
      expect(broadcastMessage).toMatchObject({
        channelId,
        content: 'Hello from socket!',
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

      const messageData = {
        channelId,
        content: 'Reply from socket!',
        replyToId: originalMsg.id,
      };

      const ackResponse = await new Promise<any>((resolve) => {
        clientSocket.emit('send-message', messageData, resolve);
      });

      expect(ackResponse.success).toBe(true);
      expect(ackResponse.data.replyTo).toMatchObject({
        id: originalMsg.id,
        content: 'Original message',
      });
    });

    it('should return error for invalid channel', async () => {
      const messageData = {
        channelId: '00000000-0000-0000-0000-000000000000',
        content: 'Message to nowhere',
      };

      const ackResponse = await new Promise<any>((resolve) => {
        clientSocket.emit('send-message', messageData, resolve);
      });

      expect(ackResponse.success).toBe(false);
      expect(ackResponse.error).toBeTruthy();
    });

    it('should return error for non-member trying to send', async () => {
      // Create another channel that user is not a member of
      const otherChannel = await db.chatChannel.create({
        data: {
          gameId,
          scope: 'DIRECT',
          name: 'Private Channel',
          scopeKey: otherPlayerId,
          members: {
            create: [{ playerId: otherPlayerId }],
          },
        },
      });

      const messageData = {
        channelId: otherChannel.id,
        content: 'Unauthorized message',
      };

      const ackResponse = await new Promise<any>((resolve) => {
        clientSocket.emit('send-message', messageData, resolve);
      });

      expect(ackResponse.success).toBe(false);
      expect(ackResponse.error).toContain('Not a member');
    });

    it('should return error for empty content', async () => {
      const messageData = {
        channelId,
        content: '',
      };

      const ackResponse = await new Promise<any>((resolve) => {
        clientSocket.emit('send-message', messageData, resolve);
      });

      expect(ackResponse.success).toBe(false);
    });

    it('should return error for content exceeding max length', async () => {
      const messageData = {
        channelId,
        content: 'a'.repeat(5001),
      };

      const ackResponse = await new Promise<any>((resolve) => {
        clientSocket.emit('send-message', messageData, resolve);
      });

      expect(ackResponse.success).toBe(false);
    });

    it('should return error for invalid channel ID format', async () => {
      const messageData = {
        channelId: 'not-a-uuid',
        content: 'Test message',
      };

      const ackResponse = await new Promise<any>((resolve) => {
        clientSocket.emit('send-message', messageData, resolve);
      });

      expect(ackResponse.success).toBe(false);
    });
  });

  describe('mark-read event', () => {
    it('should mark channel as read', async () => {
      // Create unread messages
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

      const readData = {
        channelId,
      };

      const ackResponse = await new Promise<any>((resolve) => {
        clientSocket.emit('mark-read', readData, resolve);
      });

      expect(ackResponse.success).toBe(true);

      // Verify lastReadAt was updated
      const membership = await db.chatChannelMember.findUnique({
        where: {
          channelId_playerId: { channelId, playerId },
        },
      });
      expect(membership?.lastReadAt).toBeTruthy();
    });

    it('should return success for valid request without error', async () => {
      const readData = {
        channelId,
      };

      const ackResponse = await new Promise<any>((resolve) => {
        clientSocket.emit('mark-read', readData, resolve);
      });

      expect(ackResponse.success).toBe(true);
    });

    it('should handle invalid channel gracefully', async () => {
      const readData = {
        channelId: '00000000-0000-0000-0000-000000000000',
      };

      const ackResponse = await new Promise<any>((resolve) => {
        clientSocket.emit('mark-read', readData, resolve);
      });

      expect(ackResponse.success).toBe(false);
    });
  });

  describe('typing event', () => {
    it('should broadcast typing indicator to game room', async () => {
      const typingData = {
        channelId,
        isTyping: true,
      };

      // Listen for typing event on other client
      const typingPromise = new Promise<any>((resolve) => {
        otherClientSocket.on('typing', resolve);
      });

      // Send typing indicator
      clientSocket.emit('typing', typingData);

      const typingEvent = await typingPromise;

      expect(typingEvent).toMatchObject({
        channelId,
        userId,
        displayName: 'Socket Tester',
        isTyping: true,
      });
    });

    it('should broadcast typing stopped', async () => {
      const typingData = {
        channelId,
        isTyping: false,
      };

      const typingPromise = new Promise<any>((resolve) => {
        otherClientSocket.on('typing', resolve);
      });

      clientSocket.emit('typing', typingData);

      const typingEvent = await typingPromise;

      expect(typingEvent.isTyping).toBe(false);
    });

    it('should not broadcast to self', async () => {
      const typingData = {
        channelId,
        isTyping: true,
      };

      let selfReceived = false;
      clientSocket.on('typing', () => {
        selfReceived = true;
      });

      // Send typing indicator
      clientSocket.emit('typing', typingData);

      // Wait a bit to ensure no self-broadcast
      await new Promise((resolve) => setTimeout(() => resolve(), SOCKET_BROADCAST_DELAY));

      expect(selfReceived).toBe(false);
    });

    it('should deliver private channel typing only to channel members', async () => {
      // Create a DIRECT channel with both players as members
      const privateChannel = await db.chatChannel.create({
        data: {
          gameId,
          scope: 'DIRECT',
          name: 'Private DM',
          scopeKey: `${playerId}:${otherPlayerId}`,
          members: {
            create: [{ playerId }, { playerId: otherPlayerId }],
          },
        },
      });

      const typingData = {
        channelId: privateChannel.id,
        isTyping: true,
      };

      // otherClientSocket IS a member - should receive typing from clientSocket
      const typingPromise = new Promise<any>((resolve) => {
        otherClientSocket.on('typing', resolve);
      });

      // clientSocket (a member) emits typing on the private channel
      clientSocket.emit('typing', typingData);

      const typingEvent = await typingPromise;
      expect(typingEvent).toMatchObject({
        channelId: privateChannel.id,
        userId,
        isTyping: true,
      });
    });

    it('should not broadcast typing from non-member on private channel', async () => {
      // Create a DIRECT channel with ONLY otherPlayer as member
      const privateChannel = await db.chatChannel.create({
        data: {
          gameId,
          scope: 'DIRECT',
          name: 'Private Channel',
          scopeKey: otherPlayerId,
          members: {
            create: [{ playerId: otherPlayerId }],
          },
        },
      });

      const typingData = {
        channelId: privateChannel.id,
        isTyping: true,
      };

      // Neither socket should receive typing from a non-member
      let memberReceived = false;
      otherClientSocket.on('typing', () => {
        memberReceived = true;
      });

      let nonMemberReceived = false;
      clientSocket.on('typing', () => {
        nonMemberReceived = true;
      });

      // clientSocket is NOT a member - typing should be silently dropped
      clientSocket.emit('typing', typingData);

      await new Promise((resolve) => setTimeout(() => resolve(), SOCKET_BROADCAST_DELAY));

      expect(memberReceived).toBe(false);
      expect(nonMemberReceived).toBe(false);
    });

    it('should handle invalid channel ID format', async () => {
      const typingData = {
        channelId: 'not-a-uuid',
        isTyping: true,
      };

      // Should not crash the server
      clientSocket.emit('typing', typingData);

      // Wait to ensure server is still responsive
      await new Promise((resolve) => setTimeout(() => resolve(), SOCKET_BROADCAST_DELAY));

      expect(clientSocket.connected).toBe(true);
    });
  });

  describe('authentication', () => {
    it('should reject connection without token', async () => {
      const unauthClient = ioClient(`http://localhost:${PORT}`, {
        auth: {},
        transports: ['websocket'],
      });

      const errorPromise = new Promise((resolve) => {
        unauthClient.on('connect_error', resolve);
      });

      const error = await errorPromise;
      expect(error).toBeTruthy();

      unauthClient.disconnect();
    });

    it('should reject connection with invalid token', async () => {
      const invalidClient = ioClient(`http://localhost:${PORT}`, {
        auth: { token: 'invalid-token' },
        transports: ['websocket'],
      });

      const errorPromise = new Promise((resolve) => {
        invalidClient.on('connect_error', resolve);
      });

      const error = await errorPromise;
      expect(error).toBeTruthy();

      invalidClient.disconnect();
    });
  });

  describe('message broadcasting across multiple clients', () => {
    it('should broadcast message to all clients in game room', async () => {
      const messageData = {
        channelId,
        content: 'Broadcast test',
      };

      // Listen for broadcast on other client
      const broadcastPromise = new Promise<any>((resolve) => {
        otherClientSocket.on('new-message', resolve);
      });

      // Send message
      clientSocket.emit('send-message', messageData);

      const broadcastMessage = await broadcastPromise;

      expect(broadcastMessage).toMatchObject({
        channelId,
        content: 'Broadcast test',
      });
    });

    it('should not deliver private channel messages to non-member game participants', async () => {
      // Create a DIRECT channel with only otherPlayer as member
      const privateChannel = await db.chatChannel.create({
        data: {
          gameId,
          scope: 'DIRECT',
          name: 'Private DM',
          scopeKey: otherPlayerId,
          members: {
            create: [{ playerId: otherPlayerId }],
          },
        },
      });

      // clientSocket (non-member of this channel) should NOT receive the message
      let nonMemberReceived = false;
      clientSocket.on('new-message', (msg: any) => {
        if (msg.channelId === privateChannel.id) {
          nonMemberReceived = true;
        }
      });

      // otherClientSocket IS a member - send a message via the channel
      const messageData = {
        channelId: privateChannel.id,
        content: 'Private message',
      };

      const ackResponse = await new Promise<any>((resolve) => {
        otherClientSocket.emit('send-message', messageData, resolve);
      });

      expect(ackResponse.success).toBe(true);

      // Wait to ensure non-member doesn't receive the broadcast
      await new Promise((resolve) => setTimeout(() => resolve(), SOCKET_BROADCAST_DELAY));

      expect(nonMemberReceived).toBe(false);
    });

    it('should not broadcast to clients in different game rooms', async () => {
      // Create another game
      const otherGame = await db.game.create({
        data: {
          name: 'Other Game',
          creatorId: userId,
          status: 'ACTIVE',
          currentPhase: 'PROPOSAL',
          settings: {},
        },
      });

      // Create a third user and client for other game
      const hashedPassword = await hashPassword('password123');
      const thirdUser = await db.user.create({
        data: {
          email: 'third-user@example.com',
          displayName: 'Third User',
          passwordHash: hashedPassword,
        },
      });

      const thirdUserToken = jwt.sign(
        { userId: thirdUser.id, email: thirdUser.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const thirdClient = ioClient(`http://localhost:${PORT}`, {
        auth: { token: thirdUserToken },
        transports: ['websocket'],
      });

      await new Promise<void>((resolve) => {
        thirdClient.on('connect', () => {
          thirdClient.emit('join-game', otherGame.id);
          setTimeout(() => resolve(), SOCKET_SETUP_DELAY);
        });
      });

      let thirdClientReceived = false;
      thirdClient.on('new-message', () => {
        thirdClientReceived = true;
      });

      const messageData = {
        channelId,
        content: 'Should not reach other game',
      };

      clientSocket.emit('send-message', messageData);

      // Wait to ensure no cross-game broadcast
      await new Promise((resolve) => setTimeout(() => resolve(), SOCKET_BROADCAST_DELAY));

      expect(thirdClientReceived).toBe(false);

      // Cleanup
      thirdClient.disconnect();
      await db.game.delete({ where: { id: otherGame.id } });
      await db.user.delete({ where: { id: thirdUser.id } });
    });
  });
});
