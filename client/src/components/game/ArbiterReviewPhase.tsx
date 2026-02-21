import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { RichTextDisplay } from '../ui';

interface Argument {
  id: string;
  argumentType: 'FOR' | 'AGAINST' | 'CLARIFICATION' | 'INITIATOR_FOR';
  content: string;
  sequence: number;
  isStrong: boolean;
  player: {
    id: string;
    playerName: string;
    user: { displayName: string };
  };
}

interface Action {
  id: string;
  actionDescription: string;
  desiredOutcome: string;
  initiator: {
    playerName: string;
    userId: string;
  };
}

interface ArbiterReviewPhaseProps {
  gameId: string;
  action: Action;
  isArbiter: boolean;
  arbiterName?: string;
}

export function ArbiterReviewPhase({
  gameId,
  action,
  isArbiter,
  arbiterName,
}: ArbiterReviewPhaseProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ data: Argument[] }>({
    queryKey: ['arguments', action.id],
    queryFn: () => api.get(`/actions/${action.id}/arguments`).then((res) => res.data),
    refetchInterval: 5000,
  });

  const markStrongMutation = useMutation({
    mutationFn: (argumentId: string) =>
      api.post(`/actions/${action.id}/arguments/${argumentId}/mark-strong`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['arguments', action.id] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/actions/${action.id}/arbiter/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });

  const arbiterDisplayName = arbiterName ?? 'the arbiter';
  const args = data?.data ?? [];
  const proArgs = args.filter(
    (a) => a.argumentType === 'FOR' || a.argumentType === 'INITIATOR_FOR'
  );
  const antiArgs = args.filter((a) => a.argumentType === 'AGAINST');

  if (isLoading) {
    return (
      <div className="p-6 border rounded-lg text-center text-muted-foreground">
        Loading arguments...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6 border rounded-lg">
        <h2 className="text-lg font-semibold mb-1">Arbiter Review</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {isArbiter
            ? 'Mark arguments as strong, then complete the review to roll dice and resolve.'
            : `Waiting for ${arbiterDisplayName} to review the arguments.`}
        </p>

        <div className="p-4 bg-muted rounded-md">
          <RichTextDisplay content={action.actionDescription} className="font-medium" />
          <p className="text-xs text-muted-foreground mt-2">
            Proposed by {action.initiator.playerName}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* FOR arguments */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-sm font-medium mb-3 text-green-600 dark:text-green-400">
            FOR ({proArgs.length})
          </h3>
          {proArgs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No supporting arguments.</p>
          ) : (
            <ul className="space-y-2">
              {proArgs.map((arg) => (
                <li
                  key={arg.id}
                  className={`p-3 rounded-md border text-sm transition-colors ${
                    arg.isStrong ? 'bg-green-50 border-green-400 dark:bg-green-950' : 'bg-muted/40'
                  }`}
                >
                  <RichTextDisplay content={arg.content} />
                  <p className="text-xs text-muted-foreground mt-1">{arg.player.playerName}</p>
                  {isArbiter && (
                    <button
                      onClick={() => markStrongMutation.mutate(arg.id)}
                      disabled={markStrongMutation.isPending}
                      aria-pressed={arg.isStrong}
                      aria-label={arg.isStrong ? 'Unmark as strong' : 'Mark as strong'}
                      className={`mt-2 text-xs px-2 py-1 rounded border transition-colors ${
                        arg.isStrong
                          ? 'bg-green-500 text-white border-green-500 hover:bg-green-600'
                          : 'border-muted-foreground text-muted-foreground hover:border-green-500 hover:text-green-600'
                      }`}
                    >
                      {arg.isStrong ? 'Strong' : 'Mark Strong'}
                    </button>
                  )}
                  {!isArbiter && arg.isStrong && (
                    <span className="mt-2 inline-block text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded dark:bg-green-900 dark:text-green-300">
                      Strong
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* AGAINST arguments */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-sm font-medium mb-3 text-red-600 dark:text-red-400">
            AGAINST ({antiArgs.length})
          </h3>
          {antiArgs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No opposing arguments.</p>
          ) : (
            <ul className="space-y-2">
              {antiArgs.map((arg) => (
                <li
                  key={arg.id}
                  className={`p-3 rounded-md border text-sm transition-colors ${
                    arg.isStrong ? 'bg-red-50 border-red-400 dark:bg-red-950' : 'bg-muted/40'
                  }`}
                >
                  <RichTextDisplay content={arg.content} />
                  <p className="text-xs text-muted-foreground mt-1">{arg.player.playerName}</p>
                  {isArbiter && (
                    <button
                      onClick={() => markStrongMutation.mutate(arg.id)}
                      disabled={markStrongMutation.isPending}
                      aria-pressed={arg.isStrong}
                      aria-label={arg.isStrong ? 'Unmark as strong' : 'Mark as strong'}
                      className={`mt-2 text-xs px-2 py-1 rounded border transition-colors ${
                        arg.isStrong
                          ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
                          : 'border-muted-foreground text-muted-foreground hover:border-red-500 hover:text-red-600'
                      }`}
                    >
                      {arg.isStrong ? 'Strong' : 'Mark Strong'}
                    </button>
                  )}
                  {!isArbiter && arg.isStrong && (
                    <span className="mt-2 inline-block text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded dark:bg-red-900 dark:text-red-300">
                      Strong
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isArbiter && markStrongMutation.isError && (
        <p className="text-xs text-destructive text-center">
          Failed to update argument
          {markStrongMutation.error instanceof Error ? `: ${markStrongMutation.error.message}` : ''}
          . Try again.
        </p>
      )}

      {isArbiter && (
        <div className="p-4 border rounded-lg text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Strong FOR: {proArgs.filter((a) => a.isStrong).length} &nbsp;|&nbsp; Strong AGAINST:{' '}
            {antiArgs.filter((a) => a.isStrong).length}
          </p>
          <button
            onClick={() => completeMutation.mutate()}
            disabled={completeMutation.isPending}
            className="py-2 px-6 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 font-medium"
          >
            {completeMutation.isPending ? 'Rolling dice...' : 'Complete Review & Roll Dice'}
          </button>
          {completeMutation.isError && (
            <p className="text-xs text-destructive mt-2">Failed to complete review. Try again.</p>
          )}
        </div>
      )}

      {!isArbiter && (
        <div className="p-4 border rounded-lg text-center text-sm text-muted-foreground">
          Waiting for {arbiterName ?? 'the arbiter'} to complete the review...
        </div>
      )}
    </div>
  );
}
