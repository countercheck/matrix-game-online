import { useState } from 'react';
import { useGameChat, type ChatMessage } from '../../hooks/useGameChat';
import { ChannelList } from './ChannelList';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { NewChannelModal } from './NewChannelModal';

interface Persona {
  id: string;
  name: string;
}

interface Player {
  id: string;
  playerName: string;
  personaName?: string | null;
}

interface ChatSettings {
  enablePersonaChat?: boolean;
  enableDirectChat?: boolean;
}

interface ChatPanelProps {
  gameId: string;
  gameStatus: string;
  currentPlayerId?: string;
  personas: Persona[];
  players: Player[];
  chatSettings: ChatSettings;
}

export function ChatPanel({
  gameId,
  gameStatus,
  currentPlayerId,
  personas,
  players,
  chatSettings,
}: ChatPanelProps) {
  const {
    channels,
    channelsLoading,
    messages,
    messagesLoading,
    activeChannelId,
    setActiveChannelId,
    sendMessage,
    createChannel,
    emitTyping,
    loadOlderMessages,
    typingUsers,
    isConnected,
  } = useGameChat(gameId);

  const [showNewChannel, setShowNewChannel] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [showChannelList, setShowChannelList] = useState(true);

  if (gameStatus === 'LOBBY') {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Chat will be available when the game starts
      </div>
    );
  }

  if (channelsLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Loading chat...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-16rem)] max-h-[500px] border rounded-lg overflow-hidden">
      {/* Connection indicator */}
      {!isConnected && (
        <div className="px-3 py-1 text-xs text-center bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
          Reconnecting...
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Channel sidebar - toggle on mobile */}
        {showChannelList && (
          <div className="w-48 border-r flex-shrink-0 overflow-hidden">
            <ChannelList
              channels={channels}
              activeChannelId={activeChannelId}
              onSelectChannel={(id) => {
                setActiveChannelId(id);
                setReplyTarget(null);
                // Collapse channel list after selection (always, since on desktop the toggle button re-opens it)
                setShowChannelList(false);
              }}
              onNewChannel={() => setShowNewChannel(true)}
            />
          </div>
        )}

        {/* Message area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Channel header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
            <button
              onClick={() => setShowChannelList(!showChannelList)}
              className="p-1 hover:bg-muted rounded"
              title={showChannelList ? 'Hide channels' : 'Show channels'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <span className="text-sm font-medium truncate">
              {channels.find((c) => c.id === activeChannelId)?.name || 'Select a channel'}
            </span>
          </div>

          {activeChannelId ? (
            <>
              <MessageList
                messages={messages}
                currentPlayerId={currentPlayerId}
                onReply={setReplyTarget}
                onLoadOlder={loadOlderMessages}
                isLoading={messagesLoading}
              />
              <MessageInput
                onSend={sendMessage}
                onTyping={emitTyping}
                replyTarget={replyTarget}
                onClearReply={() => setReplyTarget(null)}
                disabled={!isConnected}
                typingUsers={typingUsers}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a channel to start chatting
            </div>
          )}
        </div>
      </div>

      <NewChannelModal
        open={showNewChannel}
        onClose={() => setShowNewChannel(false)}
        onCreate={createChannel}
        personas={personas}
        players={players}
        chatSettings={chatSettings}
      />
    </div>
  );
}
