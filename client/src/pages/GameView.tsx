import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { downloadBlob } from '../utils/download';
import {
  ActionProposal,
  ArgumentationPhase,
  VotingPanel,
  TokenDraw,
  NarrationForm,
  RoundSummary,
  GameHistory,
  RoundHistory,
  HostControls,
  PhaseCountdown,
} from '../components/game';
import { Skeleton, SkeletonText } from '../components/ui/Skeleton';
import { RichTextDisplay } from '../components/ui/RichTextDisplay';

interface Persona {
  id: string;
  name: string;
  description?: string | null;
  isNpc?: boolean;
  npcActionDescription?: string | null;
  npcDesiredOutcome?: string | null;
}

interface Game {
  id: string;
  name: string;
  imageUrl?: string;
  status: string;
  currentPhase: string;
  npcMomentum?: number;
  phaseStartedAt?: string | null;
  settings: {
    argumentLimit: number;
    proposalTimeoutHours?: number;
    argumentationTimeoutHours?: number;
    votingTimeoutHours?: number;
    narrationTimeoutHours?: number;
  };
  currentRound?: {
    id: string;
    roundNumber: number;
    actionsCompleted: number;
    totalActionsRequired: number;
  };
  currentAction?: {
    id: string;
    actionDescription: string;
    desiredOutcome: string;
    status: string;
    initiator: {
      id: string;
      playerName: string;
      userId: string;
      isNpc?: boolean;
      user: { displayName: string };
    };
  };
  players: Array<{
    id: string;
    playerName: string;
    isHost: boolean;
    isNpc?: boolean;
    userId: string;
    user: { id: string; displayName: string };
    persona?: Persona | null;
  }>;
  myPlayer?: {
    id: string;
    playerName: string;
    isHost: boolean;
    hasProposedThisRound: boolean;
    remainingArguments: number;
    hasCompletedArgumentation: boolean;
  };
}

export default function GameView() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const [showRoundHistory, setShowRoundHistory] = useState(false);
  const [expandedPersona, setExpandedPersona] = useState<string | null>(null);
  const [isTimeoutExpired, setIsTimeoutExpired] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<{ data: Game }>({
    queryKey: ['game', gameId],
    queryFn: () => api.get(`/games/${gameId}`).then((res) => res.data),
    refetchInterval: 5000, // Poll for updates
  });

  const game = data?.data;

  // Get timeout hours for the current phase (before early returns to avoid hook issues)
  const phaseTimeoutMap: Record<string, number | undefined> = game ? {
    PROPOSAL: game.settings.proposalTimeoutHours,
    ARGUMENTATION: game.settings.argumentationTimeoutHours,
    VOTING: game.settings.votingTimeoutHours,
    NARRATION: game.settings.narrationTimeoutHours,
  } : {};
  const currentTimeoutHours = game ? phaseTimeoutMap[game.currentPhase] : undefined;

  // Check if timeout is expired (for host notification)
  useEffect(() => {
    if (!game || !currentTimeoutHours || currentTimeoutHours === -1 || !game.phaseStartedAt) {
      return;
    }
    const deadline = new Date(game.phaseStartedAt).getTime() + currentTimeoutHours * 3600000;
    const checkTimeout = () => setIsTimeoutExpired(Date.now() >= deadline);
    checkTimeout();
    const interval = setInterval(checkTimeout, 1000);
    return () => clearInterval(interval);
  }, [game, currentTimeoutHours, game?.phaseStartedAt]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="p-6 border rounded-lg space-y-4">
              <Skeleton className="h-6 w-32" />
              <SkeletonText lines={3} />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="text-center py-12 border rounded-lg bg-destructive/5">
        <p className="text-destructive mb-4">Failed to load game</p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Try Again
          </button>
          <Link to="/" className="text-sm text-muted-foreground hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const currentUserId = user?.id || '';
  const myPlayer = game.myPlayer;

  // Render phase-specific content
  const renderPhaseContent = () => {
    switch (game.currentPhase) {
      case 'PROPOSAL':
        return (
          <ActionProposal
            gameId={game.id}
            hasProposedThisRound={myPlayer?.hasProposedThisRound || false}
          />
        );

      case 'ARGUMENTATION':
        if (!game.currentAction) {
          return (
            <div className="p-6 border rounded-lg text-center text-muted-foreground">
              Waiting for action...
            </div>
          );
        }
        return (
          <ArgumentationPhase
            gameId={game.id}
            action={game.currentAction}
            remainingArguments={myPlayer?.remainingArguments ?? game.settings.argumentLimit}
            hasCompletedArgumentation={myPlayer?.hasCompletedArgumentation || false}
            isHost={myPlayer?.isHost}
          />
        );

      case 'VOTING':
        if (!game.currentAction) {
          return (
            <div className="p-6 border rounded-lg text-center text-muted-foreground">
              Waiting for action...
            </div>
          );
        }
        return <VotingPanel gameId={game.id} action={game.currentAction} />;

      case 'RESOLUTION':
        if (!game.currentAction) {
          return (
            <div className="p-6 border rounded-lg text-center text-muted-foreground">
              Waiting for action...
            </div>
          );
        }
        return (
          <TokenDraw
            gameId={game.id}
            action={game.currentAction}
            currentUserId={currentUserId}
          />
        );

      case 'NARRATION':
        if (!game.currentAction) {
          return (
            <div className="p-6 border rounded-lg text-center text-muted-foreground">
              Waiting for action...
            </div>
          );
        }
        return (
          <NarrationForm
            gameId={game.id}
            action={game.currentAction}
            currentUserId={currentUserId}
            isHost={myPlayer?.isHost}
          />
        );

      case 'ROUND_SUMMARY':
        if (!game.currentRound) {
          return (
            <div className="p-6 border rounded-lg text-center text-muted-foreground">
              Waiting for round data...
            </div>
          );
        }
        return <RoundSummary gameId={game.id} roundId={game.currentRound.id} />;

      default:
        return (
          <div className="p-6 border rounded-lg text-center text-muted-foreground">
            Unknown phase: {game.currentPhase}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with optional image */}
      {game.imageUrl ? (
        <div className="relative w-full h-32 sm:h-40 rounded-lg overflow-hidden">
          <img
            src={game.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-between p-4">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="text-white/90 hover:text-white"
                title="Back to Dashboard"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white">{game.name}</h1>
                {game.currentRound && (
                  <p className="text-sm text-white/90">
                    Round {game.currentRound.roundNumber} • {game.currentRound.actionsCompleted}/{game.currentRound.totalActionsRequired} actions
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PhaseCountdown
                phaseStartedAt={game.phaseStartedAt}
                timeoutHours={currentTimeoutHours}
                currentPhase={game.currentPhase}
              />
              <span
                className={`text-xs px-3 py-1 rounded-full font-medium ${
                  game.currentPhase === 'PROPOSAL'
                    ? 'bg-blue-500 text-white'
                    : game.currentPhase === 'ARGUMENTATION'
                    ? 'bg-purple-500 text-white'
                    : game.currentPhase === 'VOTING'
                    ? 'bg-orange-500 text-white'
                    : game.currentPhase === 'RESOLUTION'
                    ? 'bg-green-500 text-white'
                    : game.currentPhase === 'NARRATION'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-500 text-white'
                }`}
              >
                {game.currentPhase}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-muted-foreground hover:text-foreground"
              title="Back to Dashboard"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold">{game.name}</h1>
          </div>
          {game.currentRound && (
            <div className="flex items-center gap-3 mt-1">
              <p className="text-muted-foreground">
                Round {game.currentRound.roundNumber} &bull;{' '}
                {game.currentRound.actionsCompleted}/{game.currentRound.totalActionsRequired} actions
                completed
              </p>
              {game.currentRound.roundNumber > 1 && (
                <button
                  onClick={() => setShowRoundHistory(true)}
                  className="text-xs text-primary hover:underline"
                >
                  View past rounds
                </button>
              )}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <PhaseCountdown
              phaseStartedAt={game.phaseStartedAt}
              timeoutHours={currentTimeoutHours}
              currentPhase={game.currentPhase}
            />
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                game.currentPhase === 'PROPOSAL'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : game.currentPhase === 'ARGUMENTATION'
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                  : game.currentPhase === 'VOTING'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  : game.currentPhase === 'RESOLUTION'
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                  : game.currentPhase === 'NARRATION'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {game.currentPhase.replace('_', ' ')}
            </span>
          </div>
          {myPlayer && (
            <p className="text-xs text-muted-foreground mt-1">
              Playing as {myPlayer.playerName}
            </p>
          )}
        </div>
      </div>
      )}

      {/* Main Game Area */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">{renderPhaseContent()}</div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Phase Guide */}
          <div className="p-4 border rounded-lg bg-muted/30">
            <h3 className="font-semibold mb-2">Phase Guide</h3>
            <PhaseGuide phase={game.currentPhase} />
          </div>

          {/* Host Controls for skipping phases */}
          <HostControls
            gameId={game.id}
            currentPhase={game.currentPhase}
            currentActionId={game.currentAction?.id}
            isHost={myPlayer?.isHost || false}
            timeoutExpired={isTimeoutExpired}
          />

          {/* Players */}
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-3">Players ({game.players.length})</h3>
            <ul className="space-y-2">
              {game.players.map((player) => (
                <li key={player.id} className="text-sm">
                  <div
                    className={`flex items-center justify-between ${
                      player.persona ? 'cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors' : ''
                    }`}
                    onClick={() => {
                      if (player.persona) {
                        setExpandedPersona(expandedPersona === player.id ? null : player.id);
                      }
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className={`flex items-center gap-1 ${player.userId === currentUserId ? 'font-medium' : ''}`}>
                        {player.persona && (
                          <span
                            className={`transition-transform text-xs text-muted-foreground ${
                              expandedPersona === player.id ? 'rotate-90' : ''
                            }`}
                          >
                            ▶
                          </span>
                        )}
                        <span>
                          {player.persona ? player.persona.name : player.playerName}
                          {player.userId === currentUserId && ' (you)'}
                        </span>
                      </div>
                      {player.persona && (
                        <p className="text-xs text-muted-foreground pl-4">
                          {player.playerName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {player.isNpc && (
                        <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                          NPC
                        </span>
                      )}
                      {player.isHost && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          Host
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Expanded Persona Details */}
                  {expandedPersona === player.id && player.persona && (
                    <div className="mt-2 ml-4 p-3 bg-muted/30 rounded-lg text-xs space-y-2">
                      {player.persona.description && (
                        <RichTextDisplay
                          content={player.persona.description}
                          className="text-muted-foreground [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1"
                        />
                      )}
                      {player.persona.isNpc && player.persona.npcActionDescription && (
                        <div>
                          <span className="font-medium text-amber-700 dark:text-amber-300">Action: </span>
                          <RichTextDisplay
                            content={player.persona.npcActionDescription}
                            className="text-muted-foreground [&_p]:inline [&_p]:my-0"
                            inline
                          />
                        </div>
                      )}
                      {player.persona.isNpc && player.persona.npcDesiredOutcome && (
                        <div>
                          <span className="font-medium text-amber-700 dark:text-amber-300">Goal: </span>
                          <RichTextDisplay
                            content={player.persona.npcDesiredOutcome}
                            className="text-muted-foreground [&_p]:inline [&_p]:my-0"
                            inline
                          />
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* NPC Momentum - only show if there's an NPC */}
          {game.players.some((p) => p.isNpc) && (
            <NpcMomentumDisplay momentum={game.npcMomentum || 0} npcName={game.players.find((p) => p.isNpc)?.playerName || 'NPC'} />
          )}

          {/* Current Action Summary (when not in proposal) */}
          {game.currentAction && game.currentPhase !== 'PROPOSAL' && (
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Current Action</h3>
              <p className="text-sm">{game.currentAction.actionDescription}</p>
              <p className="text-xs text-muted-foreground mt-2">
                By {game.currentAction.initiator.playerName}
              </p>
            </div>
          )}

          {/* Game History */}
          <GameHistory gameId={game.id} compact isHost={myPlayer?.isHost} />

          {/* Export */}
          <button
            onClick={async () => {
              try {
                const res = await api.get(`/games/${game.id}/export`, { responseType: 'blob' });
                const disposition = res.headers['content-disposition'] || '';
                downloadBlob(res.data, `${game.name}-export.yaml`, disposition);
              } catch {
                // silent fail — network errors are shown by the interceptor
              }
            }}
            className="w-full text-sm px-3 py-2 border rounded-lg text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
          >
            Export Game (YAML)
          </button>
        </div>
      </div>

      {/* Round History Modal */}
      {showRoundHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowRoundHistory(false)}
          />
          {/* Modal */}
          <div className="relative bg-background border rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Round History</h2>
              <button
                onClick={() => setShowRoundHistory(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <RoundHistory
                gameId={game.id}
                currentRoundNumber={game.currentRound?.roundNumber}
                isHost={myPlayer?.isHost}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NpcMomentumDisplay({ momentum, npcName }: { momentum: number; npcName: string }) {
  const getMomentumColor = () => {
    if (momentum >= 3) return 'text-red-600 dark:text-red-400';
    if (momentum >= 1) return 'text-orange-600 dark:text-orange-400';
    if (momentum <= -3) return 'text-green-600 dark:text-green-400';
    if (momentum <= -1) return 'text-emerald-600 dark:text-emerald-400';
    return 'text-muted-foreground';
  };

  const getMomentumLabel = () => {
    if (momentum >= 6) return 'Dominant';
    if (momentum >= 3) return 'Advancing';
    if (momentum >= 1) return 'Gaining';
    if (momentum === 0) return 'Neutral';
    if (momentum <= -6) return 'Defeated';
    if (momentum <= -3) return 'Weakening';
    return 'Losing';
  };

  return (
    <div className="p-4 border rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
      <h3 className="font-semibold mb-2 flex items-center gap-2">
        <span className="text-amber-600 dark:text-amber-400">⚔</span>
        {npcName} Momentum
      </h3>
      <div className="flex items-center justify-between">
        <span className={`text-2xl font-bold ${getMomentumColor()}`}>
          {momentum > 0 ? '+' : ''}{momentum}
        </span>
        <span className={`text-sm ${getMomentumColor()}`}>
          {getMomentumLabel()}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {momentum > 0
          ? `${npcName} is succeeding in their goals`
          : momentum < 0
          ? `${npcName} is being thwarted`
          : `The conflict is evenly balanced`}
      </p>
    </div>
  );
}

function PhaseGuide({ phase }: { phase: string }) {
  const guides: Record<string, { title: string; description: string }> = {
    PROPOSAL: {
      title: 'Propose Actions',
      description:
        'Each player proposes one action per round. Describe what you want to do and provide arguments for why it should succeed.',
    },
    ARGUMENTATION: {
      title: 'Make Arguments',
      description:
        'Add arguments for or against the proposed action. You can also add clarifications. When done, click "I\'m Done" to proceed.',
    },
    VOTING: {
      title: 'Cast Your Vote',
      description:
        'Vote on the likelihood of success. Your vote affects the token pool that will be drawn from.',
    },
    RESOLUTION: {
      title: 'Draw Tokens',
      description:
        'The initiator draws 3 tokens from the pool to determine the outcome. More success tokens in the pool means better odds!',
    },
    NARRATION: {
      title: 'Narrate the Result',
      description:
        'The initiator describes what happens based on the token draw. The result type guides the narrative.',
    },
    ROUND_SUMMARY: {
      title: 'Round Complete',
      description:
        'All actions for this round are done. The host writes a summary of what happened before the next round begins.',
    },
  };

  const guide = guides[phase] || { title: 'Unknown Phase', description: '' };

  return (
    <div>
      <p className="text-sm font-medium">{guide.title}</p>
      <p className="text-xs text-muted-foreground mt-1">{guide.description}</p>
    </div>
  );
}
