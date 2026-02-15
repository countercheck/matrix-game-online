import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { Skeleton } from '../components/ui/Skeleton';
import { RichTextDisplay } from '../components/ui/RichTextDisplay';
import { EditGameModal } from '../components/game/EditGameModal';
import { EditPersonaModal } from '../components/game/EditPersonaModal';
import { getApiErrorMessage } from '../utils/apiError';

interface Persona {
  id: string;
  name: string;
  description: string | null;
  isNpc?: boolean;
  npcActionDescription?: string | null;
  npcDesiredOutcome?: string | null;
  claimedBy: { id: string; playerName: string } | null;
}

interface Player {
  id: string;
  playerName: string;
  isHost: boolean;
  isNpc?: boolean;
  user: { id: string; displayName: string };
  persona: { id: string; name: string } | null;
}

interface Game {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  status: string;
  players: Player[];
  personas: Persona[];
  settings: {
    personasRequired?: boolean;
    proposalTimeoutHours?: number;
    argumentationTimeoutHours?: number;
    votingTimeoutHours?: number;
    narrationTimeoutHours?: number;
  };
}

export default function GameLobby() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showEditGameModal, setShowEditGameModal] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{ data: Game }>({
    queryKey: ['game', gameId],
    queryFn: () => api.get(`/games/${gameId}`).then((res) => res.data),
    refetchInterval: 3000, // Poll for new players
  });

  const startMutation = useMutation({
    mutationFn: () => api.post(`/games/${gameId}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      navigate(`/game/${gameId}/play`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/games/${gameId}`),
    onSuccess: () => {
      navigate('/');
    },
    onError: (err: unknown) => {
      setDeleteError(getApiErrorMessage(err, 'Failed to delete game'));
    },
  });

  const selectPersonaMutation = useMutation({
    mutationFn: (personaId: string | null) =>
      api.post(`/games/${gameId}/select-persona`, { personaId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });

  const updateGameMutation = useMutation({
    mutationFn: (data: { name: string; description: string | null; settings?: Record<string, unknown> }) =>
      api.put(`/games/${gameId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });

  const updatePersonaMutation = useMutation({
    mutationFn: ({
      personaId,
      data,
    }: {
      personaId: string;
      data: {
        name?: string;
        description?: string | null;
        npcActionDescription?: string | null;
        npcDesiredOutcome?: string | null;
      };
    }) => api.put(`/games/${gameId}/personas/${personaId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });

  const game = data?.data;
  const currentPlayer = game?.players.find((p) => p.user.id === user?.id);
  const isHost = currentPlayer?.isHost || false;
  const inviteLink = `${window.location.origin}/join/${gameId}`;

  const hasPersonas = (game?.personas?.length || 0) > 0;
  const personasRequired = game?.settings?.personasRequired || false;
  // NPC personas cannot be claimed by players
  const availablePersonas = game?.personas?.filter((p) => !p.claimedBy && !p.isNpc) || [];
  const hasNpcPersona = game?.personas?.some((p) => p.isNpc) || false;

  // Check if all players have personas (for start validation warning)
  const playersWithoutPersona = game?.players.filter((p) => !p.persona) || [];
  const canStart =
    game && game.players.length >= 2 && (!personasRequired || playersWithoutPersona.length === 0);

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to render persona selection button
  const renderPersonaButton = (persona: Persona) => (
    <button
      key={persona.id}
      onClick={() => selectPersonaMutation.mutate(persona.id)}
      disabled={selectPersonaMutation.isPending}
      className="w-full p-3 text-left border rounded-md hover:bg-muted/50 transition-colors"
    >
      <div className="font-medium">{persona.name}</div>
      {persona.description && (
        <RichTextDisplay
          content={persona.description}
          className="text-sm text-muted-foreground [&_p]:my-1"
        />
      )}
    </button>
  );

  // Redirect if game already started
  if (game?.status === 'ACTIVE') {
    navigate(`/game/${gameId}/play`, { replace: true });
    return null;
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="p-4 border rounded-lg space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="p-4 border rounded-lg space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12 border rounded-lg bg-destructive/5">
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Game Image Header */}
      {game.imageUrl && (
        <div className="relative w-full h-48 sm:h-64 rounded-lg overflow-hidden">
          <img src={game.imageUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
            <h1 className="text-3xl font-bold text-white p-6">{game.name}</h1>
          </div>
        </div>
      )}

      <div>
        {!game.imageUrl && (
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{game.name}</h1>
            {isHost && (
              <button
                onClick={() => setShowEditGameModal(true)}
                className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted"
                title="Edit game details"
              >
                ✏️ Edit
              </button>
            )}
          </div>
        )}
        {game.imageUrl && isHost && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setShowEditGameModal(true)}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted"
              title="Edit game details"
            >
              ✏️ Edit
            </button>
          </div>
        )}
        {game.description && (
          <RichTextDisplay
            content={game.description}
            className="mt-2 [&_p]:my-1 [&_p]:text-muted-foreground"
          />
        )}
      </div>

      <div className="p-4 border rounded-lg space-y-2">
        <label className="text-sm font-medium">Invite Link</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inviteLink}
            readOnly
            className="flex-1 px-3 py-2 border rounded-md bg-muted text-sm"
          />
          <button onClick={copyInviteLink} className="px-4 py-2 border rounded-md hover:bg-muted">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Share this link with others to invite them to the game
        </p>
      </div>

      <div className="p-4 border rounded-lg space-y-4">
        <h2 className="font-semibold">Players ({game.players.length})</h2>
        <ul className="space-y-2">
          {game.players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between p-2 bg-muted rounded-md"
            >
              <div className="flex items-center gap-2">
                <span>{player.playerName}</span>
                {player.persona && (
                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                    {player.persona.name}
                  </span>
                )}
              </div>
              {player.isHost && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Host</span>
              )}
            </li>
          ))}
        </ul>
        {game.players.length < 2 && (
          <p className="text-sm text-muted-foreground">
            Waiting for at least 2 players to start...
          </p>
        )}
      </div>

      {/* Persona Selection for Current Player */}
      {hasPersonas && currentPlayer && (
        <div className="p-4 border rounded-lg space-y-4">
          <h2 className="font-semibold">
            Your Persona {personasRequired && <span className="text-destructive">*</span>}
          </h2>

          {currentPlayer.persona ? (
            <div className="space-y-3">
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
                <div className="font-medium">{currentPlayer.persona.name}</div>
                {(() => {
                  const currentPersona = game.personas.find(
                    (p) => p.id === currentPlayer.persona?.id
                  );
                  if (!currentPersona?.description) return null;
                  return (
                    <RichTextDisplay
                      content={currentPersona.description}
                      className="text-sm text-muted-foreground mt-1 [&_p]:my-1"
                    />
                  );
                })()}
              </div>

              {/* Show available personas for direct swapping */}
              {availablePersonas.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Switch to:</p>
                  {availablePersonas.map(renderPersonaButton)}
                </div>
              )}

              {/* Option to clear persona selection */}
              <button
                onClick={() => selectPersonaMutation.mutate(null)}
                disabled={selectPersonaMutation.isPending}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Clear persona selection
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {availablePersonas.length === 0 ? (
                <p className="text-sm text-muted-foreground">All personas have been claimed.</p>
              ) : (
                availablePersonas.map(renderPersonaButton)
              )}
            </div>
          )}
        </div>
      )}

      {/* Available Personas Overview */}
      {hasPersonas && (
        <div className="p-4 border rounded-lg space-y-4">
          <h2 className="font-semibold">All Personas</h2>
          <div className="grid gap-2">
            {game.personas.map((persona) => (
              <div
                key={persona.id}
                className={`p-2 rounded-md text-sm ${
                  persona.isNpc
                    ? 'bg-amber-100/50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700'
                    : persona.claimedBy
                      ? 'bg-muted/50 text-muted-foreground'
                      : 'bg-muted'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium flex items-center gap-2">
                    {persona.name}
                    {persona.isNpc && (
                      <span className="text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded">
                        NPC
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {persona.isNpc ? (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Auto-controlled
                      </span>
                    ) : persona.claimedBy ? (
                      <span className="text-xs">{persona.claimedBy.playerName}</span>
                    ) : (
                      <span className="text-xs text-green-600 dark:text-green-400">Available</span>
                    )}
                    {isHost && (
                      <button
                        onClick={() => setEditingPersona(persona)}
                        className="ml-2 px-2 py-0.5 text-xs border rounded hover:bg-muted"
                        title="Edit persona"
                        aria-label={`Edit persona ${persona.name}`}
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {hasNpcPersona && (
            <p className="text-xs text-muted-foreground">
              The NPC goes last each round and automatically proposes an action.
            </p>
          )}
        </div>
      )}

      {/* Start Game Warning */}
      {isHost && personasRequired && playersWithoutPersona.length > 0 && (
        <div className="p-3 text-sm bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-md">
          Cannot start: {playersWithoutPersona.map((p) => p.playerName).join(', ')}{' '}
          {playersWithoutPersona.length === 1 ? 'needs' : 'need'} to select a persona.
        </div>
      )}

      {isHost && (
        <div className="space-y-3">
          <button
            onClick={() => startMutation.mutate()}
            disabled={!canStart || startMutation.isPending}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {startMutation.isPending ? 'Starting...' : 'Start Game'}
          </button>

          {!showDeleteConfirm ? (
            <button
              onClick={() => {
                setShowDeleteConfirm(true);
                setDeleteError('');
              }}
              className="w-full py-2 px-4 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            >
              Delete Game
            </button>
          ) : (
            <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/5 space-y-3">
              <p className="text-sm text-destructive font-medium">
                Are you sure you want to delete this game? This cannot be undone.
              </p>
              {deleteError && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  {deleteError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-2 px-4 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-2 px-4 border rounded-md hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!isHost && (
        <p className="text-center text-muted-foreground">
          Waiting for the host to start the game...
        </p>
      )}

      {/* Edit Game Modal */}
      {game && (
        <EditGameModal
          isOpen={showEditGameModal}
          onClose={() => setShowEditGameModal(false)}
          onSave={async (data) => {
            await updateGameMutation.mutateAsync(data);
          }}
          initialName={game.name}
          initialDescription={game.description || ''}
          initialSettings={game.settings}
        />
      )}

      {/* Edit Persona Modal */}
      {editingPersona && (
        <EditPersonaModal
          isOpen={!!editingPersona}
          onClose={() => setEditingPersona(null)}
          onSave={async (data) => {
            await updatePersonaMutation.mutateAsync({
              personaId: editingPersona.id,
              data,
            });
          }}
          persona={editingPersona}
        />
      )}
    </div>
  );
}
