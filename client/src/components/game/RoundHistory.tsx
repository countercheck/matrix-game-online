import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { RichTextDisplay } from '../ui/RichTextDisplay';
import { EditRoundSummaryModal } from './EditRoundSummaryModal';

interface RoundHistoryProps {
  gameId: string;
  currentRoundNumber?: number;
  isHost?: boolean;
}

interface RoundAction {
  id: string;
  sequenceNumber: number;
  actionDescription: string;
  initiatorId: string;
  argumentationWasSkipped?: boolean;
  votingWasSkipped?: boolean;
  tokenDraw?: {
    resultValue: number;
    resultType: 'TRIUMPH' | 'SUCCESS_BUT' | 'FAILURE_BUT' | 'DISASTER';
    drawnSuccess: number;
    drawnFailure: number;
  };
}

interface RoundSummaryData {
  id: string;
  content: string;
  outcomes: {
    totalTriumphs?: number;
    totalDisasters?: number;
    netMomentum?: number;
    keyEvents?: string[];
  };
  createdAt: string;
}

interface Round {
  id: string;
  roundNumber: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
  actionsCompleted: number;
  totalActionsRequired: number;
  startedAt: string;
  completedAt?: string;
  actions: RoundAction[];
  summary?: RoundSummaryData;
}

export function RoundHistory({ gameId, currentRoundNumber, isHost = false }: RoundHistoryProps) {
  const queryClient = useQueryClient();
  const [expandedRound, setExpandedRound] = useState<string | null>(null);
  const [editingSummary, setEditingSummary] = useState<{ roundId: string; content: string } | null>(
    null
  );

  const editSummaryMutation = useMutation({
    mutationFn: ({ roundId, content }: { roundId: string; content: string }) =>
      api.put(`/rounds/${roundId}/summary`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game-rounds', gameId] });
    },
  });

  const { data, isLoading } = useQuery<{ data: Round[] }>({
    queryKey: ['game-rounds', gameId],
    queryFn: () => api.get(`/games/${gameId}/rounds`).then((res) => res.data),
  });

  const rounds = data?.data || [];
  const completedRounds = rounds.filter((r) => r.status === 'COMPLETED');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Round History</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 border rounded-lg">
              <div className="h-5 bg-muted rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (completedRounds.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Round History</h2>
        <div className="p-8 border rounded-lg text-center">
          <p className="text-muted-foreground">No completed rounds yet.</p>
          {currentRoundNumber && (
            <p className="text-sm text-muted-foreground mt-2">
              Currently in Round {currentRoundNumber}
            </p>
          )}
        </div>
      </div>
    );
  }

  const getResultColor = (resultType?: string) => {
    switch (resultType) {
      case 'TRIUMPH':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'SUCCESS_BUT':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'FAILURE_BUT':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
      case 'DISASTER':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getResultLabel = (resultType?: string) => {
    switch (resultType) {
      case 'TRIUMPH':
        return 'Triumph';
      case 'SUCCESS_BUT':
        return 'Success, but...';
      case 'FAILURE_BUT':
        return 'Failure, but...';
      case 'DISASTER':
        return 'Disaster';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Round History</h2>
        <span className="text-sm text-muted-foreground">
          {completedRounds.length} completed round{completedRounds.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-4">
        {[...completedRounds].reverse().map((round) => {
          const isExpanded = expandedRound === round.id;
          const netResult = round.actions.reduce(
            (sum, a) => sum + (a.tokenDraw?.resultValue || 0),
            0
          );
          const triumphs = round.actions.filter(
            (a) => a.tokenDraw?.resultType === 'TRIUMPH'
          ).length;
          const disasters = round.actions.filter(
            (a) => a.tokenDraw?.resultType === 'DISASTER'
          ).length;

          return (
            <div key={round.id} className="border rounded-lg overflow-hidden">
              {/* Round Header */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold">Round {round.roundNumber}</span>
                    <span className="text-sm text-muted-foreground">
                      {round.actionsCompleted} actions
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Quick Stats */}
                    <div className="flex items-center gap-2 text-sm">
                      {triumphs > 0 && (
                        <span className="text-green-600 dark:text-green-400">✨ {triumphs}</span>
                      )}
                      {disasters > 0 && (
                        <span className="text-red-600 dark:text-red-400">💥 {disasters}</span>
                      )}
                      <span
                        className={`font-medium ${
                          netResult > 0
                            ? 'text-green-600 dark:text-green-400'
                            : netResult < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {netResult > 0 ? '+' : ''}
                        {netResult}
                      </span>
                    </div>
                    {/* Expand Icon */}
                    <button
                      type="button"
                      onClick={() => setExpandedRound(isExpanded ? null : round.id)}
                      aria-label={
                        isExpanded
                          ? `Collapse round ${round.roundNumber}`
                          : `Expand round ${round.roundNumber}`
                      }
                      className="p-1 rounded hover:bg-muted/50 transition-colors"
                    >
                      <svg
                        className={`w-5 h-5 text-muted-foreground transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                {round.summary && !isExpanded && (
                  <div className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    <RichTextDisplay content={round.summary.content} className="[&_p]:my-0" />
                  </div>
                )}
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t">
                  {/* Summary */}
                  {round.summary && (
                    <div className="p-4 bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">Round Summary</h4>
                        {isHost && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSummary({
                                roundId: round.id,
                                content: round.summary!.content,
                              });
                            }}
                            className="text-xs text-primary hover:underline"
                            title="Edit round summary (host)"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      <RichTextDisplay
                        content={round.summary.content}
                        className="text-sm [&_p]:my-1"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Written on {formatDate(round.summary.createdAt)}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="p-4">
                    <h4 className="text-sm font-medium mb-3">Actions</h4>
                    <div className="space-y-3">
                      {round.actions.map((action, index) => (
                        <div
                          key={action.id}
                          className="flex items-start justify-between gap-4 p-3 bg-muted/20 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-muted-foreground">#{index + 1}</span>
                              {action.argumentationWasSkipped && (
                                <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                                  Args skipped
                                </span>
                              )}
                              {action.votingWasSkipped && (
                                <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                                  Votes skipped
                                </span>
                              )}
                            </div>
                            <p className="text-sm">{action.actionDescription}</p>
                          </div>
                          {action.tokenDraw && (
                            <div className="shrink-0 text-right">
                              <span
                                className={`inline-block px-2 py-1 rounded text-xs font-medium ${getResultColor(
                                  action.tokenDraw.resultType
                                )}`}
                              >
                                {getResultLabel(action.tokenDraw.resultType)}
                              </span>
                              <p className="text-xs text-muted-foreground mt-1">
                                {action.tokenDraw.drawnSuccess}S / {action.tokenDraw.drawnFailure}F
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Round Stats */}
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-2 bg-muted/30 rounded-lg">
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">
                          {triumphs}
                        </div>
                        <div className="text-xs text-muted-foreground">Triumphs</div>
                      </div>
                      <div className="p-2 bg-muted/30 rounded-lg">
                        <div className="text-lg font-bold text-red-600 dark:text-red-400">
                          {disasters}
                        </div>
                        <div className="text-xs text-muted-foreground">Disasters</div>
                      </div>
                      <div className="p-2 bg-muted/30 rounded-lg">
                        <div
                          className={`text-lg font-bold ${
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
                        <div className="text-xs text-muted-foreground">Net Result</div>
                      </div>
                    </div>
                  </div>

                  {/* Completed Date */}
                  {round.completedAt && (
                    <div className="px-4 pb-4 text-xs text-muted-foreground text-right">
                      Completed {formatDate(round.completedAt)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Round Summary Modal */}
      {editingSummary && (
        <EditRoundSummaryModal
          isOpen={!!editingSummary}
          onClose={() => setEditingSummary(null)}
          onSave={async ({ content }) => {
            await editSummaryMutation.mutateAsync({ roundId: editingSummary.roundId, content });
          }}
          initialContent={editingSummary.content}
        />
      )}
    </div>
  );
}
