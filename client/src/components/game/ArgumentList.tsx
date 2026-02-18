import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { RichTextDisplay } from '../ui';
import { formatRelativeTime } from '../../utils/formatTime';
import { decodeHtmlEntities } from '../../utils/decodeEntities';
import { EditArgumentModal } from './EditArgumentModal';

interface Argument {
  id: string;
  argumentType: 'FOR' | 'AGAINST' | 'CLARIFICATION' | 'INITIATOR_FOR';
  content: string;
  sequence: number;
  createdAt: string;
  player: {
    id: string;
    playerName: string;
    user: { displayName: string };
  };
}

interface ArgumentListProps {
  actionId: string;
  gameId?: string;
  isHost?: boolean;
  emptyMessage?: string;
}

export function ArgumentList({
  actionId,
  gameId,
  isHost = false,
  emptyMessage = 'No arguments yet. Be the first to add one!',
}: ArgumentListProps) {
  const queryClient = useQueryClient();
  const [editingArgument, setEditingArgument] = useState<Argument | null>(null);

  const { data, isLoading, error } = useQuery<{ data: Argument[] }>({
    queryKey: ['arguments', actionId],
    queryFn: () => api.get(`/actions/${actionId}/arguments`).then((res) => res.data),
    refetchInterval: 5000,
  });

  const editArgumentMutation = useMutation({
    mutationFn: ({ argumentId, content }: { argumentId: string; content: string }) =>
      api.put(`/actions/${actionId}/arguments/${argumentId}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['arguments', actionId] });
      if (gameId) {
        queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      }
    },
  });

  const args = data?.data || [];

  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground">Loading arguments...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-destructive">Failed to load arguments</div>;
  }

  if (args.length === 0) {
    return <div className="text-center py-4 text-muted-foreground">{emptyMessage}</div>;
  }

  const getArgumentStyles = (type: string) => {
    if (type === 'FOR' || type === 'INITIATOR_FOR') {
      return {
        container: 'bg-arg-for-bg border-arg-for-border text-arg-for-text',
        badge: 'bg-arg-for-badge-bg text-arg-for-badge-text',
        icon: (
          <svg
            className="w-3.5 h-3.5 mr-1"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        ),
        label: 'For',
      };
    }
    if (type === 'AGAINST') {
      return {
        container: 'bg-arg-against-bg border-arg-against-border text-arg-against-text',
        badge: 'bg-arg-against-badge-bg text-arg-against-badge-text',
        icon: (
          <svg
            className="w-3.5 h-3.5 mr-1"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        ),
        label: 'Against',
      };
    }
    return {
      container: 'bg-arg-clarify-bg border-arg-clarify-border text-arg-clarify-text',
      badge: 'bg-arg-clarify-badge-bg text-arg-clarify-badge-text',
      icon: (
        <svg
          className="w-3.5 h-3.5 mr-1"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      ),
      label: 'Clarification',
    };
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Arguments ({args.length})</h3>

      <div className="space-y-4">
        {args.map((arg) => {
          const styles = getArgumentStyles(arg.argumentType);
          return (
            <div key={arg.id} className={`p-3 rounded-md border-l-4 ${styles.container}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {decodeHtmlEntities(arg.player.playerName)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(arg.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isHost && (
                    <button
                      onClick={() => setEditingArgument(arg)}
                      className="text-xs text-primary hover:underline"
                      title="Edit argument (host)"
                    >
                      Edit
                    </button>
                  )}
                  <span
                    className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${styles.badge}`}
                  >
                    {styles.icon}
                    {styles.label}
                  </span>
                </div>
              </div>
              <RichTextDisplay content={arg.content} className="text-sm" />
            </div>
          );
        })}
      </div>

      {/* Edit Argument Modal */}
      {editingArgument && (
        <EditArgumentModal
          isOpen={!!editingArgument}
          onClose={() => setEditingArgument(null)}
          onSave={async ({ content }) => {
            await editArgumentMutation.mutateAsync({ argumentId: editingArgument.id, content });
          }}
          initialContent={editingArgument.content}
          argumentType={
            editingArgument.argumentType === 'INITIATOR_FOR' ||
            editingArgument.argumentType === 'FOR'
              ? 'FOR'
              : editingArgument.argumentType === 'AGAINST'
                ? 'AGAINST'
                : undefined
          }
        />
      )}
    </div>
  );
}
