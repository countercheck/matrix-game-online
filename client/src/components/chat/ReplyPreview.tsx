interface ReplyPreviewProps {
  senderName: string;
  senderPersona?: string | null;
  content: string;
  onDismiss: () => void;
}

export function ReplyPreview({ senderName, senderPersona, content, onDismiss }: ReplyPreviewProps) {
  const displayName = senderPersona || senderName;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-l-2 border-primary rounded-r-md text-sm">
      <div className="flex-1 min-w-0">
        <span className="font-medium text-xs text-primary">{displayName}</span>
        <p className="text-xs text-muted-foreground truncate">{content}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 p-0.5 hover:bg-muted rounded"
        aria-label="Cancel reply"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
