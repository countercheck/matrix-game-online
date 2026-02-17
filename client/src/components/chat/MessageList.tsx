import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../hooks/useGameChat';

interface MessageListProps {
  messages: ChatMessage[];
  currentPlayerId?: string;
  onReply: (message: ChatMessage) => void;
  onLoadOlder: () => Promise<number | undefined>;
  isLoading: boolean;
}

export function MessageList({
  messages,
  currentPlayerId,
  onReply,
  onLoadOlder,
  isLoading,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on mount
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading messages...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No messages yet. Start the conversation!
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto space-y-1 p-3">
      <button
        onClick={onLoadOlder}
        className="w-full py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Load older messages
      </button>

      {messages.map((msg) => {
        const isOwn = msg.sender.playerId === currentPlayerId;
        const displayName = msg.sender.personaName || msg.sender.playerName;

        return (
          <div
            key={msg.id}
            className={`group flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
          >
            {msg.replyTo && (
              <div className="px-3 py-1 mb-0.5 text-xs text-muted-foreground bg-muted/30 rounded border-l-2 border-muted-foreground/30 max-w-[85%]">
                <span className="font-medium">
                  {msg.replyTo.senderPersona || msg.replyTo.senderName}
                </span>
                <span className="ml-1 truncate">{msg.replyTo.content}</span>
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                isOwn
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-foreground'
              }`}
            >
              {!isOwn && (
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-xs font-semibold">{displayName}</span>
                  {msg.sender.personaName && (
                    <span className="text-xs opacity-70">({msg.sender.playerName})</span>
                  )}
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
              <div className="flex items-center justify-between mt-0.5">
                <time className="text-[10px] opacity-60">
                  {formatTime(msg.createdAt)}
                </time>
                <button
                  onClick={() => onReply(msg)}
                  className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10 ${
                    isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}
                  title="Reply"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
