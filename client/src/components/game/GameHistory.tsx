import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

interface GameHistoryProps {
  gameId: string;
  compact?: boolean;
}

interface HistoryArgument {
  id: string;
  argumentType: 'INITIATOR_FOR' | 'FOR' | 'AGAINST' | 'CLARIFICATION';
  content: string;
  player: {
    playerName: string;
  };
}

interface HistoryAction {
  id: string;
  sequenceNumber: number;
  actionDescription: string;
  desiredOutcome: string;
  argumentationWasSkipped?: boolean;
  votingWasSkipped?: boolean;
  initiator: {
    playerName: string;
    user: { displayName: string };
  };
  arguments?: HistoryArgument[];
  voteTotals?: {
    totalSuccessTokens: number;
    totalFailureTokens: number;
    voteCount: number;
    skippedVotes?: number;
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

export function GameHistory({ gameId, compact = false }: GameHistoryProps) {
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [expandedArguments, setExpandedArguments] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading } = useQuery<{ data: HistoryAction[] }>({
    queryKey: ['game-history', gameId],
    queryFn: () => api.get(`/games/${gameId}/history`).then((res) => res.data),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const actions = data?.data || [];

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-3 bg-muted rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="p-4 border rounded-lg">
        <h3 className="font-semibold mb-2">History</h3>
        <p className="text-sm text-muted-foreground">No completed actions yet.</p>
      </div>
    );
  }

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

  const getResultIcon = (resultType?: string) => {
    switch (resultType) {
      case 'TRIUMPH':
        return '✨';
      case 'SUCCESS_BUT':
        return '✓';
      case 'FAILURE_BUT':
        return '✗';
      case 'DISASTER':
        return '💥';
      default:
        return '?';
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

  const getArgumentTypeColor = (type: string) => {
    switch (type) {
      case 'INITIATOR_FOR':
      case 'FOR':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'AGAINST':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      case 'CLARIFICATION':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getArgumentTypeLabel = (type: string) => {
    switch (type) {
      case 'INITIATOR_FOR':
        return 'Initial';
      case 'FOR':
        return 'For';
      case 'AGAINST':
        return 'Against';
      case 'CLARIFICATION':
        return 'Info';
      default:
        return type;
    }
  };

  // In compact mode, show only the last few actions
  const displayActions = compact && !showAll ? actions.slice(-3).reverse() : [...actions].reverse();

  return (
    <div className={compact ? 'p-4 border rounded-lg' : ''}>
      {compact && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">History ({actions.length})</h3>
          {actions.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-primary hover:underline"
            >
              {showAll ? 'Show less' : 'Show all'}
            </button>
          )}
        </div>
      )}

      <div className={compact ? 'space-y-2' : 'space-y-4'}>
        {displayActions.map((action) => (
          <div
            key={action.id}
            className={`${
              compact
                ? 'p-2 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors'
                : 'p-4 border rounded-lg'
            }`}
            onClick={() =>
              compact && setExpandedAction(expandedAction === action.id ? null : action.id)
            }
          >
            {/* Compact View */}
            {compact && expandedAction !== action.id && (
              <div className="flex items-center gap-2">
                <span className="text-lg" title={getResultLabel(action.tokenDraw?.resultType)}>
                  {getResultIcon(action.tokenDraw?.resultType)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{action.actionDescription}</p>
                  <p className="text-xs text-muted-foreground">
                    {action.initiator.playerName}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium ${getResultColor(action.tokenDraw?.resultType)}`}
                >
                  {action.tokenDraw?.resultValue !== undefined &&
                    (action.tokenDraw.resultValue > 0 ? '+' : '') + action.tokenDraw.resultValue}
                </span>
              </div>
            )}

            {/* Expanded View (compact mode) or Full View */}
            {(!compact || expandedAction === action.id) && (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        #{action.sequenceNumber}
                      </span>
                      <span className="text-sm font-medium">{action.initiator.playerName}</span>
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
                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-medium ${getResultColor(
                        action.tokenDraw?.resultType
                      )}`}
                    >
                      {getResultLabel(action.tokenDraw?.resultType)}
                    </div>
                    {action.tokenDraw && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {action.tokenDraw.drawnSuccess}S / {action.tokenDraw.drawnFailure}F (
                        {action.tokenDraw.resultValue > 0 ? '+' : ''}
                        {action.tokenDraw.resultValue})
                      </div>
                    )}
                  </div>
                </div>

                {action.desiredOutcome && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Desired: </span>
                    {action.desiredOutcome}
                  </div>
                )}

                {/* Token Pool Summary */}
                {action.voteTotals && (
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    <span className="text-muted-foreground">Token Pool:</span>
                    <span className="text-green-600 dark:text-green-400">
                      {action.voteTotals.totalSuccessTokens} Success
                    </span>
                    <span className="text-red-600 dark:text-red-400">
                      {action.voteTotals.totalFailureTokens} Failure
                    </span>
                    <span className="text-muted-foreground">
                      ({action.voteTotals.voteCount} votes{action.voteTotals.skippedVotes ? `, ${action.voteTotals.skippedVotes} auto-filled` : ''})
                    </span>
                  </div>
                )}

                {/* Arguments Section - Collapsible */}
                {action.arguments && action.arguments.length > 0 && (
                  <div className="border-t pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedArguments(
                          expandedArguments === action.id ? null : action.id
                        );
                      }}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                    >
                      <span
                        className={`transition-transform ${
                          expandedArguments === action.id ? 'rotate-90' : ''
                        }`}
                      >
                        ▶
                      </span>
                      <span>Arguments ({action.arguments.length})</span>
                    </button>

                    {expandedArguments === action.id && (
                      <div className="mt-2 space-y-2 pl-4">
                        {action.arguments.map((arg) => (
                          <div key={arg.id} className="text-xs">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getArgumentTypeColor(
                                  arg.argumentType
                                )}`}
                              >
                                {getArgumentTypeLabel(arg.argumentType)}
                              </span>
                              <span className="font-medium">{arg.player.playerName}</span>
                            </div>
                            <p className="text-muted-foreground pl-1">{arg.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {action.narration && (
                  <div className="text-sm bg-muted/50 p-3 rounded-lg italic">
                    "{action.narration.content}"
                  </div>
                )}

                {compact && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedAction(null);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Collapse
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!compact && actions.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No completed actions yet.</p>
      )}
    </div>
  );
}
