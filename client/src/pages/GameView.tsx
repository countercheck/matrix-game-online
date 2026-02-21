import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import {
  ActionProposal,
  ArgumentationPhase,
  VotingPanel,
  NarrationForm,
  RoundSummary,
  RoundHistory,
  PhaseCountdown,
} from '../components/game';
import { GameSidebar } from '../components/game/GameSidebar';
import { ResolutionPhase } from '../components/game/resolution';
import { ArbiterReviewPhase } from '../components/game/ArbiterReviewPhase';
import { Skeleton, SkeletonText } from '../components/ui/Skeleton';
import { decodeHtmlEntities } from '../utils/decodeEntities';

const IMAGE_HEADER_PHASE_COLOR_CLASSES: Record<string, string> = {
  PROPOSAL: 'bg-blue-500 text-white',
  ARGUMENTATION: 'bg-purple-500 text-white',
  ARBITER_REVIEW: 'bg-amber-500 text-white',
  VOTING: 'bg-orange-500 text-white',
  RESOLUTION: 'bg-green-500 text-white',
  NARRATION: 'bg-indigo-500 text-white',
};

function getImageHeaderPhaseColorClass(phase: string): string {
  return IMAGE_HEADER_PHASE_COLOR_CLASSES[phase] ?? 'bg-gray-500 text-white';
}

const TEXT_HEADER_PHASE_COLOR_CLASSES: Record<string, string> = {
  PROPOSAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  ARGUMENTATION: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  ARBITER_REVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  VOTING: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  RESOLUTION: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  NARRATION: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

function getTextHeaderPhaseColorClass(phase: string): string {
  return (
    TEXT_HEADER_PHASE_COLOR_CLASSES[phase] ??
    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  );
}

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
    resolutionMethod?: string;
    proposalTimeoutHours?: number;
    argumentationTimeoutHours?: number;
    votingTimeoutHours?: number;
    narrationTimeoutHours?: number;
    chat?: {
      enablePersonaChat?: boolean;
      enableDirectChat?: boolean;
    };
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
    resolutionData?: Record<string, unknown>;
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
    gameRole?: string;
    user: { id: string; displayName: string };
    persona?: Persona | null;
  }>;
  myPlayer?: {
    id: string;
    playerName: string;
    isHost: boolean;
    gameRole?: string;
    personaId: string | null;
    isPersonaLead: boolean;
    hasProposedThisRound: boolean;
    remainingArguments: number;
    hasCompletedArgumentation: boolean;
  };
}

export default function GameView() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const [showRoundHistory, setShowRoundHistory] = useState(false);
  const [isTimeoutExpired, setIsTimeoutExpired] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<{ data: Game }>({
    queryKey: ['game', gameId],
    queryFn: () => api.get(`/games/${gameId}`).then((res) => res.data),
    refetchInterval: 5000,
  });

  const game = data?.data;

  const phaseTimeoutMap: Record<string, number | undefined> = game
    ? {
        PROPOSAL: game.settings.proposalTimeoutHours,
        ARGUMENTATION: game.settings.argumentationTimeoutHours,
        VOTING: game.settings.votingTimeoutHours,
        NARRATION: game.settings.narrationTimeoutHours,
      }
    : {};
  const currentTimeoutHours = game ? phaseTimeoutMap[game.currentPhase] : undefined;

  useEffect(() => {
    if (!game || !currentTimeoutHours || currentTimeoutHours === -1 || !game.phaseStartedAt) {
      return;
    }
    const deadline = new Date(game.phaseStartedAt).getTime() + currentTimeoutHours * 3600000;
    const checkTimeout = () => setIsTimeoutExpired(Date.now() >= deadline);
    checkTimeout();
    const interval = setInterval(checkTimeout, 1000);
    return () => clearInterval(interval);
  }, [game, currentTimeoutHours]);

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

      case 'ARBITER_REVIEW': {
        if (!game.currentAction) {
          return (
            <div className="p-6 border rounded-lg text-center text-muted-foreground">
              Waiting for action...
            </div>
          );
        }
        const isArbiter = myPlayer?.gameRole === 'ARBITER';
        const arbiterPlayer = game.players.find((p) => p.gameRole === 'ARBITER');
        return (
          <ArbiterReviewPhase
            gameId={game.id}
            action={game.currentAction}
            isArbiter={isArbiter}
            arbiterName={arbiterPlayer?.playerName}
          />
        );
      }

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
          <ResolutionPhase
            gameId={game.id}
            action={game.currentAction}
            currentUserId={currentUserId}
            resolutionMethod={game.settings.resolutionMethod}
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
          <img src={game.imageUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-between p-4">
            <div className="flex items-center gap-3">
              <Link to="/" className="text-white/90 hover:text-white" title="Back to Dashboard">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white">{decodeHtmlEntities(game.name)}</h1>
                {game.currentRound && (
                  <p className="text-sm text-white/90">
                    Round {game.currentRound.roundNumber} • {game.currentRound.actionsCompleted}/
                    {game.currentRound.totalActionsRequired} actions
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
                className={`text-xs px-3 py-1 rounded-full font-medium ${getImageHeaderPhaseColorClass(game.currentPhase)}`}
              >
                {game.currentPhase.replace('_', ' ')}
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
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold">{decodeHtmlEntities(game.name)}</h1>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <PhaseCountdown
                phaseStartedAt={game.phaseStartedAt}
                timeoutHours={currentTimeoutHours}
                currentPhase={game.currentPhase}
              />
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getTextHeaderPhaseColorClass(game.currentPhase)}`}
              >
                {game.currentPhase.replace('_', ' ')}
              </span>
            </div>
            {myPlayer && (
              <p className="text-xs text-muted-foreground mt-1">
                Playing as {decodeHtmlEntities(myPlayer.playerName)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main Game Area */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {myPlayer &&
            myPlayer.personaId &&
            myPlayer.isPersonaLead === false &&
            (game.currentPhase === 'PROPOSAL' || game.currentPhase === 'NARRATION') && (
              <div className="mb-4 p-3 text-sm bg-muted/50 border rounded-md text-muted-foreground">
                Your persona lead handles{' '}
                {game.currentPhase === 'PROPOSAL' ? 'proposals' : 'narration'} for your shared
                persona. You can participate in argumentation and voting.
              </div>
            )}
          {renderPhaseContent()}
        </div>

        {/* Sidebar with tabs */}
        <div>
          <GameSidebar
            game={game}
            currentUserId={currentUserId}
            myPlayer={myPlayer}
            isTimeoutExpired={isTimeoutExpired}
          />
        </div>
      </div>

      {/* Round History Modal */}
      {showRoundHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowRoundHistory(false)}
          />
          <div className="relative bg-background border rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Round History</h2>
              <button
                onClick={() => setShowRoundHistory(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
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
