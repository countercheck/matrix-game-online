import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GameHistory, HostControls } from '../game';
import { RichTextDisplay } from '../ui/RichTextDisplay';
import { ChatPanel } from '../chat/ChatPanel';
import { decodeHtmlEntities } from '../../utils/decodeEntities';
import { downloadBlob } from '../../utils/download';
import { api } from '../../services/api';

interface Persona {
  id: string;
  name: string;
  description?: string | null;
  isNpc?: boolean;
  npcActionDescription?: string | null;
  npcDesiredOutcome?: string | null;
}

interface GameSidebarProps {
  game: {
    id: string;
    name: string;
    status: string;
    currentPhase: string;
    npcMomentum?: number;
    settings: {
      argumentLimit: number;
      resolutionMethod?: string;
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
  };
  currentUserId: string;
  myPlayer?: {
    id: string;
    playerName: string;
    isHost: boolean;
    personaId: string | null;
    isPersonaLead: boolean;
    gameRole?: string;
  };
  isTimeoutExpired: boolean;
}

export function GameSidebar({ game, currentUserId, myPlayer, isTimeoutExpired }: GameSidebarProps) {
  const [expandedPersona, setExpandedPersona] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const isArbiterGame = game.settings.resolutionMethod === 'arbiter';
  const isHost = myPlayer?.isHost || false;

  type GamePlayerRole = 'PLAYER' | 'ARBITER';

  const setRoleMutation = useMutation({
    mutationFn: ({ playerId, role }: { playerId: string; role: GamePlayerRole }) =>
      api.put(`/games/${game.id}/players/${playerId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', game.id] });
    },
    onError: (error) => {
      let message = 'Failed to update player role. Please try again.';
      if (error instanceof Error && error.message) {
        message = `Failed to update player role: ${error.message}`;
      }
      // Basic user-facing error display without assuming additional UI components
      window.alert(message);
    },
  });

  const currentArbiter = game.players.find((p) => p.gameRole === 'ARBITER');

  const handleSetArbiter = (playerId: string) => {
    const isCurrentArbiter = currentArbiter?.id === playerId;
    setRoleMutation.mutate({ playerId, role: isCurrentArbiter ? 'PLAYER' : 'ARBITER' });
  };

  // Total unread for tab badge - computed via channels query
  const chatSettings = game.settings.chat || {};
  const personas = game.players
    .filter((p) => p.persona)
    .map((p) => p.persona!)
    .filter((p, i, arr) => arr.findIndex((a) => a.id === p.id) === i);

  const chatPlayers = game.players
    .filter((p) => p.userId !== currentUserId && !p.isNpc)
    .map((p) => ({
      id: p.id,
      playerName: p.playerName,
      personaName: p.persona?.name || null,
    }));

  return (
    <Tabs.Root defaultValue="info" className="flex flex-col">
      <Tabs.List className="flex border-b">
        <Tabs.Trigger
          value="info"
          className="flex-1 py-2 px-3 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary transition-colors"
        >
          Game Info
        </Tabs.Trigger>
        <Tabs.Trigger
          value="chat"
          className="flex-1 py-2 px-3 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary transition-colors"
        >
          Chat
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="info" className="space-y-4 pt-4">
        {/* Phase Guide */}
        <div className="p-4 border rounded-lg bg-muted/30">
          <h3 className="font-semibold mb-2">Phase Guide</h3>
          <PhaseGuide phase={game.currentPhase} />
        </div>

        {/* Host Controls */}
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
                    player.persona
                      ? 'cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors'
                      : ''
                  }`}
                  onClick={() => {
                    if (player.persona) {
                      setExpandedPersona(expandedPersona === player.id ? null : player.id);
                    }
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className={`flex items-center gap-1 ${player.userId === currentUserId ? 'font-medium' : ''}`}
                    >
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
                        {decodeHtmlEntities(
                          player.persona ? player.persona.name : player.playerName
                        )}
                        {player.userId === currentUserId && ' (you)'}
                      </span>
                    </div>
                    {player.persona && (
                      <p className="text-xs text-muted-foreground pl-4">
                        {decodeHtmlEntities(player.playerName)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    {player.isNpc && (
                      <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                        NPC
                      </span>
                    )}
                    {player.gameRole === 'ARBITER' && (
                      <span className="text-xs bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded">
                        Arbiter
                      </span>
                    )}
                    {player.isHost && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        Host
                      </span>
                    )}
                    {isHost && isArbiterGame && !player.isNpc && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetArbiter(player.id);
                        }}
                        disabled={setRoleMutation.isPending}
                        className={`text-xs px-2 py-0.5 rounded border transition-colors disabled:opacity-50 ${
                          player.gameRole === 'ARBITER'
                            ? 'border-violet-400 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950'
                            : 'border-muted-foreground/40 text-muted-foreground hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400'
                        }`}
                      >
                        {player.gameRole === 'ARBITER' ? 'Unset' : 'Set Arbiter'}
                      </button>
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
                        <span className="font-medium text-amber-700 dark:text-amber-300">
                          Action:{' '}
                        </span>
                        <RichTextDisplay
                          content={player.persona.npcActionDescription}
                          className="text-muted-foreground [&_p]:inline [&_p]:my-0"
                          inline
                        />
                      </div>
                    )}
                    {player.persona.isNpc && player.persona.npcDesiredOutcome && (
                      <div>
                        <span className="font-medium text-amber-700 dark:text-amber-300">
                          Goal:{' '}
                        </span>
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

        {/* NPC Momentum */}
        {game.players.some((p) => p.isNpc) && (
          <NpcMomentumDisplay
            momentum={game.npcMomentum || 0}
            npcName={decodeHtmlEntities(game.players.find((p) => p.isNpc)?.playerName || 'NPC')}
          />
        )}

        {/* Current Action Summary */}
        {game.currentAction && game.currentPhase !== 'PROPOSAL' && (
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Current Action</h3>
            <RichTextDisplay content={game.currentAction.actionDescription} className="text-sm" />
            <p className="text-xs text-muted-foreground mt-2">
              By {decodeHtmlEntities(game.currentAction.initiator.playerName)}
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
            } catch (err) {
              console.error('Failed to export game:', err);
              window.alert('Failed to export game. Please try again.');
            }
          }}
          className="w-full text-sm px-3 py-2 border rounded-lg text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
        >
          Export Game (YAML)
        </button>
      </Tabs.Content>

      <Tabs.Content value="chat" className="pt-4">
        <ChatPanel
          gameId={game.id}
          gameStatus={game.status}
          currentPlayerId={myPlayer?.id}
          personas={personas}
          players={chatPlayers}
          chatSettings={chatSettings}
        />
      </Tabs.Content>
    </Tabs.Root>
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
          {momentum > 0 ? '+' : ''}
          {momentum}
        </span>
        <span className={`text-sm ${getMomentumColor()}`}>{getMomentumLabel()}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {momentum > 0
          ? `${npcName} is succeeding in their goals`
          : momentum < 0
            ? `${npcName} is being thwarted`
            : 'The conflict is evenly balanced'}
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
    ARBITER_REVIEW: {
      title: 'Arbiter Review',
      description:
        'The arbiter marks arguments as strong. Strong FOR arguments help; strong AGAINST arguments hurt. When ready, the arbiter rolls dice to resolve.',
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
