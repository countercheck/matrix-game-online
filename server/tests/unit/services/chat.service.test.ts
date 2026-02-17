import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatChannelScope } from '@prisma/client';

// Mock the database
vi.mock('../../../src/config/database.js', () => ({
  db: {
    chatChannel: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
    },
    chatChannelMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    chatMessage: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    game: {
      findUnique: vi.fn(),
    },
    gamePlayer: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    persona: {
      findMany: vi.fn(),
    },
  },
}));

import { db } from '../../../src/config/database.js';
import * as chatService from '../../../src/services/chat.service.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../../../src/middleware/errorHandler.js';

describe('Chat Service - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getChannelGameId', () => {
    it('should return gameId for a valid channel', async () => {
      const mockChannel = { gameId: 'game-123' };
      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);

      const result = await chatService.getChannelGameId('channel-123');

      expect(result).toEqual({ gameId: 'game-123' });
      expect(db.chatChannel.findUnique).toHaveBeenCalledWith({
        where: { id: 'channel-123' },
        select: { gameId: true },
      });
    });

    it('should return null for non-existent channel', async () => {
      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(null);

      const result = await chatService.getChannelGameId('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('isChannelMember', () => {
    it('should return true if user is a channel member', async () => {
      const mockChannel = { gameId: 'game-123' };
      const mockPlayer = { id: 'player-123' };
      const mockMembership = { channelId: 'channel-123', playerId: 'player-123' };

      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);
      vi.mocked(db.chatChannelMember.findUnique).mockResolvedValue(mockMembership as any);

      const result = await chatService.isChannelMember('user-123', 'channel-123');

      expect(result).toBe(true);
    });

    it('should return false if channel does not exist', async () => {
      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(null);

      const result = await chatService.isChannelMember('user-123', 'channel-123');

      expect(result).toBe(false);
    });

    it('should return false if user is not a game player', async () => {
      const mockChannel = { gameId: 'game-123' };
      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(null);

      const result = await chatService.isChannelMember('user-123', 'channel-123');

      expect(result).toBe(false);
    });

    it('should return false if user is not a channel member', async () => {
      const mockChannel = { gameId: 'game-123' };
      const mockPlayer = { id: 'player-123' };

      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);
      vi.mocked(db.chatChannelMember.findUnique).mockResolvedValue(null);

      const result = await chatService.isChannelMember('user-123', 'channel-123');

      expect(result).toBe(false);
    });
  });

  describe('createGameChannel', () => {
    it('should create game channel and add all active players', async () => {
      const mockChannel = {
        id: 'channel-123',
        gameId: 'game-123',
        scope: 'GAME',
        name: 'Game Chat',
        members: [],
      };
      const mockPlayers = [
        { id: 'player-1' },
        { id: 'player-2' },
        { id: 'player-3' },
      ];

      vi.mocked(db.chatChannel.upsert).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findMany).mockResolvedValue(mockPlayers as any);
      vi.mocked(db.chatChannelMember.createMany).mockResolvedValue({ count: 3 } as any);

      const result = await chatService.createGameChannel('game-123');

      expect(result).toEqual(mockChannel);
      expect(db.chatChannel.upsert).toHaveBeenCalledWith({
        where: {
          gameId_scope_scopeKey: { gameId: 'game-123', scope: 'GAME', scopeKey: '' },
        },
        create: {
          gameId: 'game-123',
          scope: 'GAME',
          name: 'Game Chat',
          scopeKey: '',
          members: { create: [] },
        },
        update: {},
        include: { members: { select: { playerId: true } } },
      });
      expect(db.chatChannelMember.createMany).toHaveBeenCalledWith({
        data: [
          { channelId: 'channel-123', playerId: 'player-1' },
          { channelId: 'channel-123', playerId: 'player-2' },
          { channelId: 'channel-123', playerId: 'player-3' },
        ],
        skipDuplicates: true,
      });
    });

    it('should not add players who are already members', async () => {
      const mockChannel = {
        id: 'channel-123',
        gameId: 'game-123',
        scope: 'GAME',
        name: 'Game Chat',
        members: [{ playerId: 'player-1' }],
      };
      const mockPlayers = [{ id: 'player-1' }, { id: 'player-2' }];

      vi.mocked(db.chatChannel.upsert).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findMany).mockResolvedValue(mockPlayers as any);
      vi.mocked(db.chatChannelMember.createMany).mockResolvedValue({ count: 1 } as any);

      await chatService.createGameChannel('game-123');

      expect(db.chatChannelMember.createMany).toHaveBeenCalledWith({
        data: [{ channelId: 'channel-123', playerId: 'player-2' }],
        skipDuplicates: true,
      });
    });
  });

  describe('addPlayerToGameChannel', () => {
    it('should add player to existing game channel', async () => {
      const mockChannel = { id: 'channel-123', gameId: 'game-123' };
      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);
      vi.mocked(db.chatChannelMember.upsert).mockResolvedValue({} as any);

      await chatService.addPlayerToGameChannel('game-123', 'player-123');

      expect(db.chatChannelMember.upsert).toHaveBeenCalledWith({
        where: {
          channelId_playerId: { channelId: 'channel-123', playerId: 'player-123' },
        },
        create: { channelId: 'channel-123', playerId: 'player-123' },
        update: {},
      });
    });

    it('should do nothing if game channel does not exist', async () => {
      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(null);

      await chatService.addPlayerToGameChannel('game-123', 'player-123');

      expect(db.chatChannelMember.upsert).not.toHaveBeenCalled();
    });
  });

  describe('findOrCreateChannel', () => {
    it('should throw NotFoundError if game does not exist', async () => {
      vi.mocked(db.game.findUnique).mockResolvedValue(null);

      await expect(
        chatService.findOrCreateChannel('game-123', 'user-123', {
          scope: 'DIRECT',
          playerIds: ['player-456'],
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError if game is in LOBBY status', async () => {
      const mockGame = { status: 'LOBBY', settings: {} };
      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);

      await expect(
        chatService.findOrCreateChannel('game-123', 'user-123', {
          scope: 'DIRECT',
          playerIds: ['player-456'],
        })
      ).rejects.toThrow('Chat is not available until the game starts');
    });

    it('should throw ForbiddenError if persona chat is disabled', async () => {
      const mockGame = {
        status: 'ACTIVE',
        settings: { chat: { enablePersonaChat: false } },
      };
      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue({ id: 'player-123' } as any);

      await expect(
        chatService.findOrCreateChannel('game-123', 'user-123', {
          scope: 'PERSONA',
          personaIds: ['persona-456'],
        })
      ).rejects.toThrow('Persona chat is disabled by the host');
    });

    it('should throw ForbiddenError if direct chat is disabled', async () => {
      const mockGame = {
        status: 'ACTIVE',
        settings: { chat: { enableDirectChat: false } },
      };
      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue({ id: 'player-123' } as any);

      await expect(
        chatService.findOrCreateChannel('game-123', 'user-123', {
          scope: 'DIRECT',
          playerIds: ['player-456'],
        })
      ).rejects.toThrow('Direct messages are disabled by the host');
    });

    it('should throw ForbiddenError if user is not a game member', async () => {
      const mockGame = { status: 'ACTIVE', settings: {} };
      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(null);

      await expect(
        chatService.findOrCreateChannel('game-123', 'user-123', {
          scope: 'DIRECT',
          playerIds: ['player-456'],
        })
      ).rejects.toThrow('Not a member of this game');
    });

    it('should create persona channel with valid personas', async () => {
      const mockGame = { status: 'ACTIVE', settings: {} };
      const mockPlayer = { id: 'player-123', isActive: true };
      const mockPersonas = [
        { id: 'persona-1', name: 'Alice', gameId: 'game-123' },
        { id: 'persona-2', name: 'Bob', gameId: 'game-123' },
      ];
      const mockPlayers = [
        { id: 'player-123' },
        { id: 'player-456' },
      ];
      const mockChannel = {
        id: 'channel-123',
        gameId: 'game-123',
        scope: 'PERSONA',
        name: 'Alice & Bob',
        members: [],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);
      vi.mocked(db.persona.findMany).mockResolvedValue(mockPersonas as any);
      vi.mocked(db.gamePlayer.findMany).mockResolvedValue(mockPlayers as any);
      vi.mocked(db.chatChannel.upsert).mockResolvedValue(mockChannel as any);

      const result = await chatService.findOrCreateChannel('game-123', 'user-123', {
        scope: 'PERSONA',
        personaIds: ['persona-1', 'persona-2'],
      });

      expect(result.name).toBe('Alice & Bob');
      expect(result.scope).toBe('PERSONA');
    });

    it('should throw BadRequestError if persona not found in game', async () => {
      const mockGame = { status: 'ACTIVE', settings: {} };
      const mockPlayer = { id: 'player-123', isActive: true };
      const mockPersonas = [{ id: 'persona-1', name: 'Alice', gameId: 'game-123' }];

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);
      vi.mocked(db.persona.findMany).mockResolvedValue(mockPersonas as any);

      await expect(
        chatService.findOrCreateChannel('game-123', 'user-123', {
          scope: 'PERSONA',
          personaIds: ['persona-1', 'persona-2'], // persona-2 doesn't exist
        })
      ).rejects.toThrow('One or more personas not found in this game');
    });

    it('should create direct channel with valid players', async () => {
      const mockGame = { status: 'ACTIVE', settings: {} };
      const mockRequestingPlayer = { id: 'player-123', isActive: true };
      const mockPlayers = [{ id: 'player-456', playerName: 'Bob' }];
      const mockAllPlayers = [
        { playerName: 'Alice' },
        { playerName: 'Bob' },
      ];
      const mockChannel = {
        id: 'channel-123',
        gameId: 'game-123',
        scope: 'DIRECT',
        name: 'Alice, Bob',
        members: [],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockRequestingPlayer as any);
      vi.mocked(db.gamePlayer.findMany)
        .mockResolvedValueOnce(mockPlayers as any)
        .mockResolvedValueOnce(mockAllPlayers as any);
      vi.mocked(db.chatChannel.upsert).mockResolvedValue(mockChannel as any);

      const result = await chatService.findOrCreateChannel('game-123', 'user-123', {
        scope: 'DIRECT',
        playerIds: ['player-456'],
      });

      expect(result.scope).toBe('DIRECT');
      expect(result.name).toBe('Alice, Bob');
    });

    it('should use custom name for direct channel if provided', async () => {
      const mockGame = { status: 'ACTIVE', settings: {} };
      const mockRequestingPlayer = { id: 'player-123', isActive: true };
      const mockPlayers = [{ id: 'player-456', playerName: 'Bob' }];
      const mockChannel = {
        id: 'channel-123',
        gameId: 'game-123',
        scope: 'DIRECT',
        name: 'Custom Chat',
        members: [],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockRequestingPlayer as any);
      vi.mocked(db.gamePlayer.findMany).mockResolvedValue(mockPlayers as any);
      vi.mocked(db.chatChannel.upsert).mockResolvedValue(mockChannel as any);

      const result = await chatService.findOrCreateChannel('game-123', 'user-123', {
        scope: 'DIRECT',
        playerIds: ['player-456'],
        name: 'Custom Chat',
      });

      expect(result.name).toBe('Custom Chat');
    });

    it('should throw BadRequestError if player not found in game', async () => {
      const mockGame = { status: 'ACTIVE', settings: {} };
      const mockRequestingPlayer = { id: 'player-123', isActive: true };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockRequestingPlayer as any);
      vi.mocked(db.gamePlayer.findMany).mockResolvedValue([]);

      await expect(
        chatService.findOrCreateChannel('game-123', 'user-123', {
          scope: 'DIRECT',
          playerIds: ['player-456'],
        })
      ).rejects.toThrow('One or more players not found in this game');
    });
  });

  describe('getMyChannels', () => {
    it('should throw ForbiddenError if user is not a game member', async () => {
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(null);

      await expect(chatService.getMyChannels('game-123', 'user-123')).rejects.toThrow(
        'Not a member of this game'
      );
    });

    it('should return channels with unread counts and last message', async () => {
      const mockPlayer = { id: 'player-123' };
      const mockMemberships = [
        {
          channelId: 'channel-1',
          lastReadAt: new Date('2024-01-01'),
          channel: {
            id: 'channel-1',
            gameId: 'game-123',
            scope: 'GAME',
            name: 'Game Chat',
            createdAt: new Date('2024-01-01'),
            members: [
              {
                player: { id: 'player-123', playerName: 'Alice', persona: null },
              },
            ],
            messages: [
              {
                id: 'msg-1',
                content: 'Hello world',
                createdAt: new Date('2024-01-02'),
                sender: {
                  playerName: 'Bob',
                  persona: null,
                },
              },
            ],
          },
        },
      ];

      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);
      vi.mocked(db.chatChannelMember.findMany).mockResolvedValue(mockMemberships as any);
      vi.mocked(db.chatMessage.groupBy).mockResolvedValue([
        { channelId: 'channel-1', _count: { _all: 5 } },
      ] as any);

      const result = await chatService.getMyChannels('game-123', 'user-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'channel-1',
        scope: 'GAME',
        name: 'Game Chat',
        unreadCount: 5,
        lastMessage: {
          content: 'Hello world',
          senderName: 'Bob',
        },
      });
    });

    it('should calculate unread count for channels never read', async () => {
      const mockPlayer = { id: 'player-123' };
      const mockMemberships = [
        {
          channelId: 'channel-1',
          lastReadAt: null,
          channel: {
            id: 'channel-1',
            gameId: 'game-123',
            scope: 'GAME',
            name: 'Game Chat',
            createdAt: new Date('2024-01-01'),
            members: [],
            messages: [],
          },
        },
      ];

      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);
      vi.mocked(db.chatChannelMember.findMany).mockResolvedValue(mockMemberships as any);
      vi.mocked(db.chatMessage.groupBy)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ channelId: 'channel-1', _count: { _all: 10 } }] as any);

      const result = await chatService.getMyChannels('game-123', 'user-123');

      expect(result[0].unreadCount).toBe(10);
    });

    it('should truncate long message content in last message', async () => {
      const mockPlayer = { id: 'player-123' };
      const longContent = 'a'.repeat(150);
      const mockMemberships = [
        {
          channelId: 'channel-1',
          lastReadAt: null,
          channel: {
            id: 'channel-1',
            gameId: 'game-123',
            scope: 'GAME',
            name: 'Game Chat',
            createdAt: new Date('2024-01-01'),
            members: [],
            messages: [
              {
                id: 'msg-1',
                content: longContent,
                createdAt: new Date('2024-01-02'),
                sender: { playerName: 'Bob', persona: null },
              },
            ],
          },
        },
      ];

      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);
      vi.mocked(db.chatChannelMember.findMany).mockResolvedValue(mockMemberships as any);
      vi.mocked(db.chatMessage.groupBy).mockResolvedValue([]);

      const result = await chatService.getMyChannels('game-123', 'user-123');

      expect(result[0].lastMessage!.content).toHaveLength(103); // 100 chars + '...'
      expect(result[0].lastMessage!.content).toMatch(/\.\.\.$/);
    });
  });

  describe('sendMessage', () => {
    it('should throw NotFoundError if channel does not exist', async () => {
      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(null);

      await expect(
        chatService.sendMessage('user-123', 'channel-123', 'Hello')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError if user is not a game member', async () => {
      const mockChannel = { id: 'channel-123', gameId: 'game-123' };
      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(null);

      await expect(
        chatService.sendMessage('user-123', 'channel-123', 'Hello')
      ).rejects.toThrow('Not a member of this game');
    });

    it('should throw ForbiddenError if player is not active', async () => {
      const mockChannel = { id: 'channel-123', gameId: 'game-123' };
      const mockPlayer = { id: 'player-123', isActive: false };
      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);

      await expect(
        chatService.sendMessage('user-123', 'channel-123', 'Hello')
      ).rejects.toThrow('You have left this game');
    });

    it('should throw ForbiddenError if user is not a channel member', async () => {
      const mockChannel = { id: 'channel-123', gameId: 'game-123' };
      const mockPlayer = { id: 'player-123', isActive: true };
      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);
      vi.mocked(db.chatChannelMember.findUnique).mockResolvedValue(null);

      await expect(
        chatService.sendMessage('user-123', 'channel-123', 'Hello')
      ).rejects.toThrow('Not a member of this channel');
    });

    it('should throw BadRequestError if reply target is in different channel', async () => {
      const mockChannel = { id: 'channel-123', gameId: 'game-123' };
      const mockPlayer = { id: 'player-123', isActive: true };
      const mockMembership = { channelId: 'channel-123', playerId: 'player-123' };
      const mockReplyTarget = { channelId: 'channel-999' };

      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);
      vi.mocked(db.chatChannelMember.findUnique).mockResolvedValue(mockMembership as any);
      vi.mocked(db.chatMessage.findUnique).mockResolvedValue(mockReplyTarget as any);

      await expect(
        chatService.sendMessage('user-123', 'channel-123', 'Hello', 'reply-123')
      ).rejects.toThrow('Reply target not found in this channel');
    });

    it('should create message successfully', async () => {
      const mockChannel = { id: 'channel-123', gameId: 'game-123' };
      const mockPlayer = { id: 'player-123', isActive: true };
      const mockMembership = { channelId: 'channel-123', playerId: 'player-123' };
      const mockMessage = {
        id: 'msg-123',
        channelId: 'channel-123',
        content: 'Hello world',
        createdAt: new Date('2024-01-01'),
        sender: {
          id: 'player-123',
          playerName: 'Alice',
          persona: null,
        },
        replyTo: null,
      };

      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);
      vi.mocked(db.chatChannelMember.findUnique).mockResolvedValue(mockMembership as any);
      vi.mocked(db.chatMessage.create).mockResolvedValue(mockMessage as any);

      const result = await chatService.sendMessage('user-123', 'channel-123', 'Hello world');

      expect(result).toMatchObject({
        id: 'msg-123',
        channelId: 'channel-123',
        content: 'Hello world',
        sender: {
          playerId: 'player-123',
          playerName: 'Alice',
          personaName: null,
        },
        replyTo: null,
      });
    });

    it('should create message with reply', async () => {
      const mockChannel = { id: 'channel-123', gameId: 'game-123' };
      const mockPlayer = { id: 'player-123', isActive: true };
      const mockMembership = { channelId: 'channel-123', playerId: 'player-123' };
      const mockReplyTarget = { channelId: 'channel-123' };
      const mockMessage = {
        id: 'msg-123',
        channelId: 'channel-123',
        content: 'Reply text',
        createdAt: new Date('2024-01-01'),
        sender: {
          id: 'player-123',
          playerName: 'Alice',
          persona: null,
        },
        replyTo: {
          id: 'reply-123',
          content: 'Original message',
          sender: {
            playerName: 'Bob',
            persona: null,
          },
        },
      };

      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);
      vi.mocked(db.chatChannelMember.findUnique).mockResolvedValue(mockMembership as any);
      vi.mocked(db.chatMessage.findUnique).mockResolvedValue(mockReplyTarget as any);
      vi.mocked(db.chatMessage.create).mockResolvedValue(mockMessage as any);

      const result = await chatService.sendMessage(
        'user-123',
        'channel-123',
        'Reply text',
        'reply-123'
      );

      expect(result.replyTo).toMatchObject({
        id: 'reply-123',
        content: 'Original message',
        senderName: 'Bob',
      });
    });
  });

  describe('getMessages', () => {
    it('should throw NotFoundError if channel does not exist', async () => {
      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(null);

      await expect(
        chatService.getMessages('user-123', 'channel-123', 50)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError if user is not a game member', async () => {
      const mockChannel = { id: 'channel-123', gameId: 'game-123' };
      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(null);

      await expect(
        chatService.getMessages('user-123', 'channel-123', 50)
      ).rejects.toThrow('Not a member of this game');
    });

    it('should throw ForbiddenError if user is not a channel member', async () => {
      const mockChannel = { id: 'channel-123', gameId: 'game-123' };
      const mockPlayer = { id: 'player-123' };
      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);
      vi.mocked(db.chatChannelMember.findUnique).mockResolvedValue(null);

      await expect(
        chatService.getMessages('user-123', 'channel-123', 50)
      ).rejects.toThrow('Not a member of this channel');
    });

    it('should return messages for valid request', async () => {
      const mockChannel = { id: 'channel-123', gameId: 'game-123' };
      const mockPlayer = { id: 'player-123' };
      const mockMembership = { channelId: 'channel-123', playerId: 'player-123' };
      const mockMessages = [
        {
          id: 'msg-1',
          channelId: 'channel-123',
          content: 'Hello',
          createdAt: new Date('2024-01-01'),
          sender: { id: 'player-123', playerName: 'Alice', persona: null },
          replyTo: null,
        },
      ];

      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);
      vi.mocked(db.chatChannelMember.findUnique).mockResolvedValue(mockMembership as any);
      vi.mocked(db.chatMessage.findMany).mockResolvedValue(mockMessages as any);

      const result = await chatService.getMessages('user-123', 'channel-123', 50);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'msg-1',
        content: 'Hello',
        sender: {
          playerId: 'player-123',
          playerName: 'Alice',
        },
      });
    });

    it('should use cursor pagination when beforeId is provided', async () => {
      const mockChannel = { id: 'channel-123', gameId: 'game-123' };
      const mockPlayer = { id: 'player-123' };
      const mockMembership = { channelId: 'channel-123', playerId: 'player-123' };
      const mockReferenceMessage = {
        id: 'msg-100',
        channelId: 'channel-123',
        createdAt: new Date('2024-01-01T12:00:00Z'),
      };

      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);
      vi.mocked(db.chatChannelMember.findUnique).mockResolvedValue(mockMembership as any);
      vi.mocked(db.chatMessage.findUnique).mockResolvedValue(mockReferenceMessage as any);
      vi.mocked(db.chatMessage.findMany).mockResolvedValue([]);

      await chatService.getMessages('user-123', 'channel-123', 20, 'msg-100');

      // Should fetch the reference message first
      expect(db.chatMessage.findUnique).toHaveBeenCalledWith({
        where: { id: 'msg-100' },
        select: { id: true, createdAt: true, channelId: true },
      });

      // Should query with OR condition for timestamp-based pagination
      expect(db.chatMessage.findMany).toHaveBeenCalledWith({
        where: {
          channelId: 'channel-123',
          OR: [
            { createdAt: { lt: mockReferenceMessage.createdAt } },
            { createdAt: mockReferenceMessage.createdAt, id: { lt: 'msg-100' } },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
        include: expect.any(Object),
      });
    });
  });

  describe('markChannelRead', () => {
    it('should throw NotFoundError if channel does not exist', async () => {
      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(null);

      await expect(chatService.markChannelRead('user-123', 'channel-123')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw ForbiddenError if user is not a game member', async () => {
      const mockChannel = { gameId: 'game-123' };
      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(null);

      await expect(chatService.markChannelRead('user-123', 'channel-123')).rejects.toThrow(
        'Not a member of this game'
      );
    });

    it('should update lastReadAt timestamp', async () => {
      const mockChannel = { gameId: 'game-123' };
      const mockPlayer = { id: 'player-123' };
      vi.mocked(db.chatChannel.findUnique).mockResolvedValue(mockChannel as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);
      vi.mocked(db.chatChannelMember.update).mockResolvedValue({} as any);

      await chatService.markChannelRead('user-123', 'channel-123');

      expect(db.chatChannelMember.update).toHaveBeenCalledWith({
        where: {
          channelId_playerId: { channelId: 'channel-123', playerId: 'player-123' },
        },
        data: { lastReadAt: expect.any(Date) },
      });
    });
  });
});
