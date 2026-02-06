import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { RichTextDisplay } from '../ui/RichTextDisplay';

interface RoundSummaryProps {
  gameId: string;
  roundId: string;
}

interface ActionResult {
  id: string;
  actionDescription: string;
  initiator: {
    playerName: string;
    isNpc?: boolean;
    user: { displayName: string };
  };
  tokenDraw?: {
    resultValue: number;
    resultType: 'TRIUMPH' | 'SUCCESS_BUT' | 'FAILURE_BUT' | 'DISASTER';
    drawnSuccess: number;
    drawnFailure: number;
  };
  narration?: {
    content: string;
  };
}

interface RoundData {
  id: string;
  roundNumber: number;
  actionsCompleted: number;
  totalActionsRequired: number;
  actions: ActionResult[];
}

interface GameData {
  npcMomentum?: number;
  players: Array<{
    id: string;
    playerName: string;
    isNpc?: boolean;
  }>;
}

export function RoundSummary({ gameId, roundId }: RoundSummaryProps) {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  // Fetch round data with all actions
  const { data: roundData, isLoading } = useQuery<{ data: RoundData }>({
    queryKey: ['round', roundId],
    queryFn: () => api.get(`/rounds/${roundId}`).then((res) => res.data),
  });

  // Fetch game data for NPC momentum
  const { data: gameData } = useQuery<{ data: GameData }>({
    queryKey: ['game', gameId],
    queryFn: () => api.get(`/games/${gameId}`).then((res) => res.data),
  });

  const submitMutation = useMutation({
    mutationFn: (summaryContent: string) =>
      api.post(`/rounds/${roundId}/summary`, { content: summaryContent }),
    onSuccess: () => {
      // Invalidate game query to get updated state (new round, new phase)
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['round', roundId] });
    },
    onError: (err: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      setError(err.response?.data?.error?.message || 'Failed to submit summary');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!content.trim()) {
      setError('Please write a summary of the round');
      return;
    }

    if (content.length > 2000) {
      setError('Summary must be 2000 characters or less');
      return;
    }

    submitMutation.mutate(content.trim());
  };

  if (isLoading || !roundData) {
    return (
      <div className="p-6 border rounded-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const round = roundData.data;
  const actions = round.actions || [];
  const game = gameData?.data;

  // Calculate statistics
  const triumphs = actions.filter((a) => a.tokenDraw?.resultType === 'TRIUMPH').length;
  const disasters = actions.filter((a) => a.tokenDraw?.resultType === 'DISASTER').length;
  const netResult = actions.reduce((sum, a) => sum + (a.tokenDraw?.resultValue || 0), 0);

  // NPC-specific stats
  const npcPlayer = game?.players.find((p) => p.isNpc);
  const npcAction = actions.find((a) => a.initiator.isNpc);
  const npcMomentum = game?.npcMomentum || 0;
  const npcRoundResult = npcAction?.tokenDraw?.resultValue || 0;

  const getResultColor = (resultType?: string) => {
    switch (resultType) {
      case 'TRIUMPH':
        return 'text-green-600 dark:text-green-400';
      case 'SUCCESS_BUT':
        return 'text-blue-600 dark:text-blue-400';
      case 'FAILURE_BUT':
        return 'text-orange-600 dark:text-orange-400';
      case 'DISASTER':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const getResultLabel = (resultType?: string) => {
    switch (resultType) {
      case 'TRIUMPH':
        return 'Triumph! (+3)';
      case 'SUCCESS_BUT':
        return 'Success, but... (+1)';
      case 'FAILURE_BUT':
        return 'Failure, but... (-1)';
      case 'DISASTER':
        return 'Disaster! (-3)';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 border rounded-lg bg-gradient-to-r from-primary/5 to-primary/10">
        <h2 className="text-xl font-bold mb-2">Round {round.roundNumber} Complete!</h2>
        <p className="text-muted-foreground">
          All {round.actionsCompleted} actions have been resolved. Time to summarize what happened.
        </p>
      </div>

      {/* Round Statistics */}
      <div className={`grid gap-4 ${npcPlayer ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        <div className="p-4 border rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{triumphs}</div>
          <div className="text-sm text-muted-foreground">Triumphs</div>
        </div>
        <div className="p-4 border rounded-lg text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{disasters}</div>
          <div className="text-sm text-muted-foreground">Disasters</div>
        </div>
        <div className="p-4 border rounded-lg text-center">
          <div
            className={`text-2xl font-bold ${
              netResult > 0
                ? 'text-green-600 dark:text-green-400'
                : netResult < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground'
            }`}
          >
            {netResult > 0 ? '+' : ''}
            {netResult}
          </div>
          <div className="text-sm text-muted-foreground">Net Momentum</div>
        </div>
        {npcPlayer && (
          <div className="p-4 border rounded-lg text-center bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <div
              className={`text-2xl font-bold ${
                npcMomentum > 0
                  ? 'text-red-600 dark:text-red-400'
                  : npcMomentum < 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-muted-foreground'
              }`}
            >
              {npcMomentum > 0 ? '+' : ''}
              {npcMomentum}
            </div>
            <div className="text-sm text-amber-700 dark:text-amber-300">{npcPlayer.playerName}</div>
            {npcRoundResult !== 0 && (
              <div className={`text-xs mt-1 ${npcRoundResult > 0 ? 'text-red-500' : 'text-green-500'}`}>
                ({npcRoundResult > 0 ? '+' : ''}{npcRoundResult} this round)
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions Summary */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-muted/50 border-b">
          <h3 className="font-semibold">Actions This Round</h3>
        </div>
        <div className="divide-y">
          {actions.map((action, index) => (
            <div key={action.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">#{index + 1}</span>
                    <span className="text-sm font-medium">{action.initiator.playerName}</span>
                    {action.initiator.isNpc && (
                      <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                        NPC
                      </span>
                    )}
                  </div>
                  <RichTextDisplay content={action.actionDescription} className="text-sm" />
                  {action.narration && (
                    <div className="text-xs text-muted-foreground mt-2 italic">
                      <RichTextDisplay
                        content={action.narration.content}
                        className="line-clamp-3 [&_p]:my-0"
                      />
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-medium ${getResultColor(action.tokenDraw?.resultType)}`}>
                    {getResultLabel(action.tokenDraw?.resultType)}
                  </div>
                  {action.tokenDraw && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {action.tokenDraw.drawnSuccess}S / {action.tokenDraw.drawnFailure}F
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Form */}
      <form onSubmit={handleSubmit} className="border rounded-lg p-6">
        <h3 className="font-semibold mb-4">Write the Round Summary</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Describe what happened this round, how the world changed, and what consequences emerged
          from the actions taken. This summary will help everyone remember this round's events.
        </p>

        <div className="space-y-4">
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-48 px-4 py-3 border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="As the dust settled from this round's events..."
              maxLength={2000}
            />
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-muted-foreground">
                Summarize the events, consequences, and how the world has changed.
              </span>
              <span
                className={`text-xs ${content.length > 1900 ? 'text-orange-500' : 'text-muted-foreground'}`}
              >
                {content.length}/2000
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitMutation.isPending || !content.trim()}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Submitting...
              </span>
            ) : (
              'Submit Summary & Start Next Round'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
