import { useState, useRef, useCallback, useEffect } from 'react';
import { ReplyPreview } from './ReplyPreview';
import type { ChatMessage } from '../../hooks/useGameChat';

interface MessageInputProps {
  onSend: (content: string, replyToId?: string) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  replyTarget: ChatMessage | null;
  onClearReply: () => void;
  disabled: boolean;
  typingUsers: Map<string, string>;
}

export function MessageInput({
  onSend,
  onTyping,
  replyTarget,
  onClearReply,
  disabled,
  typingUsers,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const typingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleTypingChange = useCallback(
    (value: string) => {
      setContent(value);
      if (value.length > 0) {
        if (!typingRef.current) {
          typingRef.current = true;
          onTyping(true);
        }
        // Reset typing timeout
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          typingRef.current = false;
          onTyping(false);
        }, 2000);
      } else if (typingRef.current) {
        // Input cleared — stop typing immediately
        typingRef.current = false;
        onTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    },
    [onTyping]
  );

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      await onSend(trimmed, replyTarget?.id);
      setContent('');
      onClearReply();
      typingRef.current = false;
      onTyping(false);
    } catch {
      // Error handling is in the hook
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const typingNames = Array.from(typingUsers.values());

  return (
    <div className="border-t">
      {replyTarget && (
        <ReplyPreview
          senderName={replyTarget.sender.playerName}
          senderPersona={replyTarget.sender.personaName}
          content={replyTarget.content}
          onDismiss={onClearReply}
        />
      )}

      {typingNames.length > 0 && (
        <div className="px-3 py-1 text-xs text-muted-foreground italic">
          {typingNames.length === 1
            ? `${typingNames[0]} is typing...`
            : `${typingNames.join(', ')} are typing...`}
        </div>
      )}

      <div className="flex items-end gap-2 p-2">
        <textarea
          value={content}
          onChange={(e) => handleTypingChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || sending}
          placeholder={disabled ? 'Disconnected...' : 'Type a message...'}
          rows={1}
          className="flex-1 resize-none px-3 py-2 text-sm border rounded-md bg-background disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleSend}
          disabled={disabled || sending || !content.trim()}
          className="shrink-0 p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Send message"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
