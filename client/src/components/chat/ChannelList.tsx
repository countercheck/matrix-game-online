import type { ChatChannel } from '../../hooks/useGameChat';

interface ChannelListProps {
  channels: ChatChannel[];
  activeChannelId: string | null;
  onSelectChannel: (id: string) => void;
  onNewChannel: () => void;
}

const SCOPE_ICONS: Record<string, string> = {
  GAME: '🌐',
  PERSONA: '🎭',
  DIRECT: '💬',
};

const SCOPE_LABELS: Record<string, string> = {
  GAME: 'Game',
  PERSONA: 'Persona',
  DIRECT: 'Direct',
};

export function ChannelList({
  channels,
  activeChannelId,
  onSelectChannel,
  onNewChannel,
}: ChannelListProps) {
  // Group channels by scope
  const grouped = channels.reduce<Record<string, ChatChannel[]>>((acc, ch) => {
    const group = acc[ch.scope] || [];
    return { ...acc, [ch.scope]: [...group, ch] };
  }, {});

  const scopeOrder: Array<'GAME' | 'PERSONA' | 'DIRECT'> = ['GAME', 'PERSONA', 'DIRECT'];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 p-2">
        {scopeOrder.map((scope) => {
          const scopeChannels = grouped[scope];
          if (!scopeChannels || scopeChannels.length === 0) return null;

          return (
            <div key={scope}>
              <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                <span>{SCOPE_ICONS[scope]}</span>
                <span>{SCOPE_LABELS[scope]}</span>
              </div>
              <div className="space-y-0.5">
                {scopeChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => onSelectChannel(channel.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      activeChannelId === channel.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">
                        {channel.name || 'Unnamed'}
                      </span>
                      {channel.unreadCount > 0 && (
                        <span className="shrink-0 ml-2 px-1.5 py-0.5 text-xs font-bold bg-primary text-primary-foreground rounded-full min-w-[1.25rem] text-center">
                          {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                        </span>
                      )}
                    </div>
                    {channel.lastMessage && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        <span className="font-medium">
                          {channel.lastMessage.senderPersona || channel.lastMessage.senderName}:
                        </span>{' '}
                        {channel.lastMessage.content}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-2 border-t">
        <button
          onClick={onNewChannel}
          className="w-full py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
        >
          + New Chat
        </button>
      </div>
    </div>
  );
}
