import { db } from '../config/database.js';
import { ChatChannelScope } from '@prisma/client';
import { BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import type { CreateChannelInput } from '../utils/chat.validators.js';

interface ChatSettings {
  enablePersonaChat?: boolean;
  enableDirectChat?: boolean;
}

/**
 * Get chat settings from game settings.
 * Note: Default behavior enables persona and direct chat unless explicitly disabled.
 * This allows games created before the chat feature to have full chat functionality.
 */
function getChatSettings(gameSettings: unknown): ChatSettings {
  const settings = (gameSettings as Record<string, unknown>) || {};
  const chat = (settings.chat as ChatSettings) || {};
  return {
    enablePersonaChat: chat.enablePersonaChat !== false,
    enableDirectChat: chat.enableDirectChat !== false,
  };
}

function validateScopeEnabled(gameSettings: unknown, scope: ChatChannelScope): void {
  const chatSettings = getChatSettings(gameSettings);
  if (scope === 'PERSONA' && !chatSettings.enablePersonaChat) {
    throw new ForbiddenError('Persona chat is disabled by the host');
  }
  if (scope === 'DIRECT' && !chatSettings.enableDirectChat) {
    throw new ForbiddenError('Direct messages are disabled by the host');
  }
}

/**
 * Get the gameId for a given channel. Used by socket handlers.
 */
export async function getChannelGameId(channelId: string) {
  return db.chatChannel.findUnique({
    where: { id: channelId },
    select: { gameId: true },
  });
}

/**
 * Get the gameId and scope for a given channel. Used by socket handlers
 * to determine broadcast routing (game room vs. user rooms).
 */
export async function getChannelInfo(channelId: string) {
  return db.chatChannel.findUnique({
    where: { id: channelId },
    select: { gameId: true, scope: true },
  });
}

/**
 * Get the userIds for all members of a channel.
 * Used to target Socket.io user rooms for PERSONA/DIRECT channels.
 */
export async function getChannelMemberUserIds(channelId: string): Promise<string[]> {
  const members = await db.chatChannelMember.findMany({
    where: { channelId },
    select: {
      player: {
        select: { userId: true },
      },
    },
  });
  return members.map((m) => m.player.userId);
}

/**
 * Check if a user is a member of a channel.
 */
export async function isChannelMember(userId: string, channelId: string): Promise<boolean> {
  const channel = await db.chatChannel.findUnique({
    where: { id: channelId },
    select: { gameId: true },
  });

  if (!channel) return false;

  const player = await db.gamePlayer.findFirst({
    where: { gameId: channel.gameId, userId, isActive: true },
    select: { id: true },
  });

  if (!player) return false;

  const membership = await db.chatChannelMember.findUnique({
    where: {
      channelId_playerId: { channelId, playerId: player.id },
    },
  });

  return !!membership;
}

/**
 * Create the GAME-scoped channel when a game starts.
 * Adds all active players as members.
 */
export async function createGameChannel(gameId: string) {
  // Use upsert with a transaction-like approach to handle race conditions
  const channel = await db.chatChannel.upsert({
    where: {
      gameId_scope_scopeKey: { gameId, scope: 'GAME', scopeKey: '' },
    },
    create: {
      gameId,
      scope: 'GAME',
      name: 'Game Chat',
      scopeKey: '',
      members: {
        create: [],
      },
    },
    update: {},
    include: {
      members: {
        select: { playerId: true },
      },
    },
  });

  // Add all active players to the channel if not already members
  const players = await db.gamePlayer.findMany({
    where: { gameId, isActive: true },
    select: { id: true },
  });

  const existingMemberIds = new Set(channel.members.map((m) => m.playerId));
  const newMemberIds = players.filter((p) => !existingMemberIds.has(p.id)).map((p) => p.id);

  if (newMemberIds.length > 0) {
    await db.chatChannelMember.createMany({
      data: newMemberIds.map((playerId) => ({
        channelId: channel.id,
        playerId,
      })),
      skipDuplicates: true,
    });
  }

  return channel;
}

/**
 * Add a late-joining player to the GAME channel.
 */
export async function addPlayerToGameChannel(gameId: string, playerId: string) {
  const channel = await db.chatChannel.findUnique({
    where: {
      gameId_scope_scopeKey: { gameId, scope: 'GAME', scopeKey: '' },
    },
  });

  if (!channel) return; // Game channel not created yet (game not started)

  await db.chatChannelMember.upsert({
    where: {
      channelId_playerId: { channelId: channel.id, playerId },
    },
    create: { channelId: channel.id, playerId },
    update: {},
  });
}

/**
 * Find or create a PERSONA or DIRECT channel.
 */
export async function findOrCreateChannel(
  gameId: string,
  userId: string,
  input: CreateChannelInput
) {
  // Get game settings to check scope availability
  const game = await db.game.findUnique({
    where: { id: gameId },
    select: { settings: true, status: true },
  });

  if (!game) throw new NotFoundError('Game not found');
  if (game.status === 'LOBBY') {
    throw new BadRequestError('Chat is not available until the game starts');
  }

  validateScopeEnabled(game.settings, input.scope as ChatChannelScope);

  // Find the requesting player
  const requestingPlayer = await db.gamePlayer.findFirst({
    where: { gameId, userId, isActive: true },
  });

  if (!requestingPlayer) {
    throw new ForbiddenError('Not a member of this game');
  }

  if (input.scope === 'PERSONA') {
    return findOrCreatePersonaChannel(gameId, requestingPlayer.id, input.personaIds!);
  }

  return findOrCreateDirectChannel(gameId, requestingPlayer.id, input.playerIds!, input.name);
}

async function findOrCreatePersonaChannel(
  gameId: string,
  requestingPlayerId: string,
  personaIds: string[]
) {
  // Validate personas exist in this game
  const personas = await db.persona.findMany({
    where: { id: { in: personaIds }, gameId },
  });

  if (personas.length !== personaIds.length) {
    throw new BadRequestError('One or more personas not found in this game');
  }

  // Find all players with these personas
  const players = await db.gamePlayer.findMany({
    where: { gameId, personaId: { in: personaIds }, isActive: true },
    select: { id: true },
  });

  // Ensure requesting player is included
  const memberIds = new Set(players.map((p) => p.id));
  memberIds.add(requestingPlayerId);
  const sortedIds = [...memberIds].sort();
  const scopeKey = sortedIds.join(',');

  const channel = await db.chatChannel.upsert({
    where: {
      gameId_scope_scopeKey: { gameId, scope: 'PERSONA', scopeKey },
    },
    create: {
      gameId,
      scope: 'PERSONA',
      name: personas.map((p) => p.name).join(' & '),
      scopeKey,
      members: {
        create: sortedIds.map((playerId) => ({ playerId })),
      },
    },
    update: {},
    include: {
      members: { include: { player: { select: { id: true, playerName: true } } } },
    },
  });

  return channel;
}

async function findOrCreateDirectChannel(
  gameId: string,
  requestingPlayerId: string,
  playerIds: string[],
  name?: string
) {
  // Validate players exist in this game
  const players = await db.gamePlayer.findMany({
    where: { id: { in: playerIds }, gameId },
    select: { id: true, playerName: true },
  });

  if (players.length !== playerIds.length) {
    throw new BadRequestError('One or more players not found in this game');
  }

  // Include the requesting player
  const memberIds = new Set([...playerIds, requestingPlayerId]);
  const sortedIds = [...memberIds].sort();
  const scopeKey = sortedIds.join(',');

  // Get player names for auto-naming
  const allPlayers = await db.gamePlayer.findMany({
    where: { id: { in: sortedIds } },
    select: { playerName: true },
  });

  const channel = await db.chatChannel.upsert({
    where: {
      gameId_scope_scopeKey: { gameId, scope: 'DIRECT', scopeKey },
    },
    create: {
      gameId,
      scope: 'DIRECT',
      name: name || allPlayers.map((p) => p.playerName).join(', '),
      scopeKey,
      members: {
        create: sortedIds.map((playerId) => ({ playerId })),
      },
    },
    update: {},
    include: {
      members: { include: { player: { select: { id: true, playerName: true } } } },
    },
  });

  return channel;
}

/**
 * Get all channels for a user in a game, with unread counts and last message.
 */
export async function getMyChannels(gameId: string, userId: string) {
  const player = await db.gamePlayer.findFirst({
    where: { gameId, userId },
    select: { id: true },
  });

  if (!player) throw new ForbiddenError('Not a member of this game');

  const memberships = await db.chatChannelMember.findMany({
    where: { playerId: player.id },
    include: {
      channel: {
        include: {
          members: {
            include: {
              player: {
                select: {
                  id: true,
                  playerName: true,
                  persona: { select: { name: true } },
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: {
                  playerName: true,
                  persona: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  // Calculate unread counts per channel
  const unreadCountByChannelId: Record<string, number> = {};

  const membershipsWithLastRead = memberships.filter((m) => m.lastReadAt);
  await Promise.all(
    membershipsWithLastRead.map(async (membership) => {
      const count = await db.chatMessage.count({
        where: {
          channelId: membership.channelId,
          createdAt: { gt: membership.lastReadAt! },
          senderPlayerId: { not: player.id }, // Exclude user's own messages
        },
      });
      unreadCountByChannelId[membership.channelId] = count;
    })
  );

  // For channels with no lastReadAt (never read), count all messages except own
  const neverReadChannels = memberships.filter((m) => !m.lastReadAt);
  if (neverReadChannels.length > 0) {
    const neverReadCounts = await db.chatMessage.groupBy({
      by: ['channelId'],
      where: {
        channelId: { in: neverReadChannels.map((m) => m.channelId) },
        senderPlayerId: { not: player.id }, // Exclude user's own messages
      },
      _count: {
        _all: true,
      },
    });

    for (const result of neverReadCounts) {
      unreadCountByChannelId[result.channelId] = result._count._all;
    }
  }

  const channels = memberships.map((membership) => {
    const unreadCount = unreadCountByChannelId[membership.channelId] || 0;

    const lastMessage = membership.channel.messages[0] || null;

    return {
      id: membership.channel.id,
      gameId: membership.channel.gameId,
      scope: membership.channel.scope,
      name: membership.channel.name,
      members: membership.channel.members.map((m) => ({
        playerId: m.player.id,
        playerName: m.player.playerName,
        personaName: m.player.persona?.name || null,
      })),
      unreadCount,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content:
              lastMessage.content.length > 100
                ? lastMessage.content.slice(0, 100) + '...'
                : lastMessage.content,
            senderName: lastMessage.sender?.playerName ?? null,
            senderPersona: lastMessage.sender?.persona?.name || null,
            createdAt: lastMessage.createdAt.toISOString(),
          }
        : null,
      createdAt: membership.channel.createdAt.toISOString(),
    };
  });

  return channels;
}

/**
 * Send a message to a channel.
 * @param assertGameId - When provided (REST context), validates the channel belongs to this game.
 */
export async function sendMessage(
  userId: string,
  channelId: string,
  content: string,
  replyToId?: string,
  assertGameId?: string
) {
  // Find the player for this user in the channel's game
  const channel = await db.chatChannel.findFirst({
    where: { id: channelId, ...(assertGameId ? { gameId: assertGameId } : {}) },
    select: { id: true, gameId: true },
  });

  if (!channel) throw new NotFoundError('Channel not found');

  const player = await db.gamePlayer.findFirst({
    where: { gameId: channel.gameId, userId },
    select: { id: true, isActive: true },
  });

  if (!player) throw new ForbiddenError('Not a member of this game');
  if (!player.isActive) throw new ForbiddenError('You have left this game');

  // Verify channel membership
  const membership = await db.chatChannelMember.findUnique({
    where: {
      channelId_playerId: { channelId, playerId: player.id },
    },
  });

  if (!membership) throw new ForbiddenError('Not a member of this channel');

  // Validate reply target is in the same channel
  if (replyToId) {
    const replyTarget = await db.chatMessage.findUnique({
      where: { id: replyToId },
      select: { channelId: true },
    });
    if (!replyTarget || replyTarget.channelId !== channelId) {
      throw new BadRequestError('Reply target not found in this channel');
    }
  }

  const message = await db.chatMessage.create({
    data: {
      channelId,
      senderPlayerId: player.id,
      content,
      replyToId: replyToId || null,
    },
    include: {
      sender: {
        select: {
          id: true,
          playerName: true,
          persona: { select: { name: true } },
        },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          sender: {
            select: {
              playerName: true,
              persona: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return {
    id: message.id,
    channelId: message.channelId,
    content: message.content,
    sender: {
      playerId: message.sender?.id ?? null,
      playerName: message.sender?.playerName ?? null,
      personaName: message.sender?.persona?.name || null,
    },
    replyTo: message.replyTo
      ? {
          id: message.replyTo.id,
          content:
            message.replyTo.content.length > 100
              ? message.replyTo.content.slice(0, 100) + '...'
              : message.replyTo.content,
          senderName: message.replyTo.sender?.playerName ?? null,
          senderPersona: message.replyTo.sender?.persona?.name || null,
        }
      : null,
    createdAt: message.createdAt.toISOString(),
  };
}

/**
 * Get messages for a channel with cursor pagination.
 * @param assertGameId - When provided (REST context), validates the channel belongs to this game.
 */
export async function getMessages(
  userId: string,
  channelId: string,
  limit: number,
  beforeId?: string,
  assertGameId?: string
) {
  // Verify membership
  const channel = await db.chatChannel.findFirst({
    where: { id: channelId, ...(assertGameId ? { gameId: assertGameId } : {}) },
    select: { id: true, gameId: true },
  });

  if (!channel) throw new NotFoundError('Channel not found');

  const player = await db.gamePlayer.findFirst({
    where: { gameId: channel.gameId, userId },
    select: { id: true },
  });

  if (!player) throw new ForbiddenError('Not a member of this game');

  const membership = await db.chatChannelMember.findUnique({
    where: {
      channelId_playerId: { channelId, playerId: player.id },
    },
  });

  if (!membership) throw new ForbiddenError('Not a member of this channel');

  // Build where condition for cursor pagination
  let whereCondition: {
    channelId: string;
    OR?: Array<{ createdAt: { lt: Date } } | { createdAt: Date; id: { lt: string } }>;
  } = { channelId };

  if (beforeId) {
    // Get the reference message to find its timestamp
    const referenceMessage = await db.chatMessage.findUnique({
      where: { id: beforeId },
      select: { id: true, createdAt: true, channelId: true },
    });

    if (!referenceMessage) {
      throw new BadRequestError('Reference message not found');
    }

    if (referenceMessage.channelId !== channelId) {
      throw new BadRequestError('Reference message is not in this channel');
    }

    // Get messages that are either:
    // 1. Older than the reference message (createdAt < referenceMessage.createdAt)
    // 2. Same timestamp but with a smaller ID (to handle messages created simultaneously)
    whereCondition = {
      channelId,
      OR: [
        { createdAt: { lt: referenceMessage.createdAt } },
        { createdAt: referenceMessage.createdAt, id: { lt: referenceMessage.id } },
      ],
    };
  }

  const messages = await db.chatMessage.findMany({
    where: whereCondition,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
    include: {
      sender: {
        select: {
          id: true,
          playerName: true,
          persona: { select: { name: true } },
        },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          sender: {
            select: {
              playerName: true,
              persona: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return messages.map((msg) => ({
    id: msg.id,
    channelId: msg.channelId,
    content: msg.content,
    sender: {
      playerId: msg.sender?.id ?? null,
      playerName: msg.sender?.playerName ?? null,
      personaName: msg.sender?.persona?.name || null,
    },
    replyTo: msg.replyTo
      ? {
          id: msg.replyTo.id,
          content:
            msg.replyTo.content.length > 100
              ? msg.replyTo.content.slice(0, 100) + '...'
              : msg.replyTo.content,
          senderName: msg.replyTo.sender?.playerName ?? null,
          senderPersona: msg.replyTo.sender?.persona?.name || null,
        }
      : null,
    createdAt: msg.createdAt.toISOString(),
  }));
}

/**
 * Mark a channel as read for a user.
 * @param assertGameId - When provided (REST context), validates the channel belongs to this game.
 */
export async function markChannelRead(userId: string, channelId: string, assertGameId?: string) {
  const channel = await db.chatChannel.findFirst({
    where: { id: channelId, ...(assertGameId ? { gameId: assertGameId } : {}) },
    select: { gameId: true },
  });

  if (!channel) throw new NotFoundError('Channel not found');

  const player = await db.gamePlayer.findFirst({
    where: { gameId: channel.gameId, userId },
    select: { id: true },
  });

  if (!player) throw new ForbiddenError('Not a member of this game');

  const result = await db.chatChannelMember.updateMany({
    where: {
      channelId,
      playerId: player.id,
    },
    data: { lastReadAt: new Date() },
  });

  if (result.count === 0) {
    throw new ForbiddenError('Not a member of this channel');
  }
}
