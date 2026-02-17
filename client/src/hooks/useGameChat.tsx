import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useSocket } from './useSocket';

export interface ChatChannel {
  id: string;
  gameId: string;
  scope: 'GAME' | 'PERSONA' | 'DIRECT';
  name: string | null;
  members: Array<{
    playerId: string;
    playerName: string;
    personaName: string | null;
  }>;
  unreadCount: number;
  lastMessage: {
    id: string;
    content: string;
    senderName: string;
    senderPersona: string | null;
    createdAt: string;
  } | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  content: string;
  sender: {
    playerId: string;
    playerName: string;
    personaName: string | null;
  };
  replyTo: {
    id: string;
    content: string;
    senderName: string;
    senderPersona: string | null;
  } | null;
  createdAt: string;
}

interface TypingEvent {
  channelId: string;
  userId: string;
  displayName: string;
  isTyping: boolean;
}

export function useGameChat(gameId: string) {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Join/leave game room
  useEffect(() => {
    if (!socket || !isConnected || !gameId) return;

    socket.emit('join-game', gameId);
    return () => {
      socket.emit('leave-game', gameId);
    };
  }, [socket, isConnected, gameId]);

  // Fetch channels
  const { data: channels = [], isLoading: channelsLoading } = useQuery<ChatChannel[]>({
    queryKey: ['chat-channels', gameId],
    queryFn: async () => {
      const res = await api.get(`/games/${gameId}/chat/channels`);
      return res.data.data;
    },
    refetchInterval: 30000,
    enabled: !!gameId,
  });

  // Derive active channel: use selected, or fall back to first channel
  const activeChannelId = useMemo(() => {
    if (selectedChannelId && channels.some((c) => c.id === selectedChannelId)) {
      return selectedChannelId;
    }
    return channels.length > 0 ? channels[0].id : null;
  }, [selectedChannelId, channels]);

  // Fetch messages for active channel
  const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ['chat-messages', activeChannelId],
    queryFn: async () => {
      if (!activeChannelId) return [];
      const res = await api.get(`/games/${gameId}/chat/channels/${activeChannelId}/messages`);
      return res.data.data.reverse(); // API returns newest first, we want oldest first
    },
    enabled: !!activeChannelId,
    refetchInterval: 30000,
  });

  // Listen for new messages via socket
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: ChatMessage) => {
      // Append to active channel messages cache (dedupe by ID)
      queryClient.setQueryData<ChatMessage[]>(
        ['chat-messages', message.channelId],
        (old = []) => {
          if (old.some((m) => m.id === message.id)) return old;
          return [...old, message];
        }
      );

      // Invalidate channels to update unread counts and last message
      queryClient.invalidateQueries({ queryKey: ['chat-channels', gameId] });
    };

    const handleTyping = (event: TypingEvent) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (event.isTyping) {
          next.set(event.userId, event.displayName);

          // Clear after 3s if no update
          const existing = typingTimeouts.current.get(event.userId);
          if (existing) clearTimeout(existing);
          typingTimeouts.current.set(
            event.userId,
            setTimeout(() => {
              setTypingUsers((p) => {
                const n = new Map(p);
                n.delete(event.userId);
                return n;
              });
              typingTimeouts.current.delete(event.userId);
            }, 3000)
          );
        } else {
          next.delete(event.userId);
          const existing = typingTimeouts.current.get(event.userId);
          if (existing) clearTimeout(existing);
          typingTimeouts.current.delete(event.userId);
        }
        return next;
      });
    };

    socket.on('new-message', handleNewMessage);
    socket.on('typing', handleTyping);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('typing', handleTyping);
    };
  }, [socket, gameId, queryClient]);

  // Send message
  const sendMessage = useCallback(
    async (content: string, replyToId?: string) => {
      if (!activeChannelId) return;

      // Try socket first, fall back to REST
      if (socket?.connected) {
        return new Promise<void>((resolve, reject) => {
          socket.emit(
            'send-message',
            { channelId: activeChannelId, content, replyToId },
            (response: { success: boolean; error?: string }) => {
              if (response.success) {
                resolve();
              } else {
                reject(new Error(response.error || 'Failed to send'));
              }
            }
          );
        });
      }

      // REST fallback
      await api.post(`/games/${gameId}/chat/channels/${activeChannelId}/messages`, {
        content,
        replyToId,
      });
    },
    [socket, activeChannelId, gameId]
  );

  // Create channel
  const createChannel = useCallback(
    async (input: {
      scope: 'PERSONA' | 'DIRECT';
      personaIds?: string[];
      playerIds?: string[];
      name?: string;
    }) => {
      const res = await api.post(`/games/${gameId}/chat/channels`, input);
      queryClient.invalidateQueries({ queryKey: ['chat-channels', gameId] });
      const channel = res.data.data;
      setSelectedChannelId(channel.id);
      return channel;
    },
    [gameId, queryClient]
  );

  // Mark channel as read
  const markRead = useCallback(
    async (channelId: string) => {
      if (socket?.connected) {
        socket.emit('mark-read', { channelId });
      } else {
        await api.post(`/games/${gameId}/chat/channels/${channelId}/read`);
      }
      queryClient.invalidateQueries({ queryKey: ['chat-channels', gameId] });
    },
    [socket, gameId, queryClient]
  );

  // Emit typing indicator
  const emitTyping = useCallback(
    (isTyping: boolean) => {
      if (socket?.connected && activeChannelId) {
        socket.emit('typing', { channelId: activeChannelId, isTyping });
      }
    },
    [socket, activeChannelId]
  );

  // Load older messages
  const loadOlderMessages = useCallback(async () => {
    if (!activeChannelId || !messages.length) return;
    const oldestId = messages[0]?.id;
    const res = await api.get(
      `/games/${gameId}/chat/channels/${activeChannelId}/messages`,
      { params: { before: oldestId, limit: 50 } }
    );
    const olderMessages: ChatMessage[] = res.data.data.reverse();
    if (olderMessages.length > 0) {
      queryClient.setQueryData<ChatMessage[]>(
        ['chat-messages', activeChannelId],
        (old = []) => [...olderMessages, ...old]
      );
    }
    return olderMessages.length;
  }, [activeChannelId, messages, gameId, queryClient]);

  // Mark as read when switching channels
  useEffect(() => {
    if (activeChannelId) {
      markRead(activeChannelId);
    }
  }, [activeChannelId, markRead]);

  // Total unread across all channels
  const totalUnread = channels.reduce((sum, ch) => sum + ch.unreadCount, 0);

  return {
    channels,
    channelsLoading,
    messages,
    messagesLoading,
    activeChannelId,
    setActiveChannelId: setSelectedChannelId,
    sendMessage,
    createChannel,
    markRead,
    emitTyping,
    loadOlderMessages,
    typingUsers,
    totalUnread,
    isConnected,
  };
}
