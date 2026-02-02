import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';

interface Persona {
  id: string;
  name: string;
  description: string | null;
  claimedBy: { id: string; playerName: string } | null;
}

interface Player {
  id: string;
  playerName: string;
  isHost: boolean;
  user: { id: string; displayName: string };
  persona: { id: string; name: string } | null;
}

interface Game {
  id: string;
  name: string;
  description?: string;
  status: string;
  players: Player[];
  personas: Persona[];
  settings: {
    personasRequired?: boolean;
  };
}

export default function GameLobby() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<{ data: Game }>({
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

  const selectPersonaMutation = useMutation({
    mutationFn: (personaId: string | null) =>
      api.post(`/games/${gameId}/select-persona`, { personaId }),
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
  const availablePersonas = game?.personas?.filter((p) => !p.claimedBy) || [];

  // Check if all players have personas (for start validation warning)
  const playersWithoutPersona = game?.players.filter((p) => !p.persona) || [];
  const canStart =
    game &&
    game.players.length >= 2 &&
    (!personasRequired || playersWithoutPersona.length === 0);

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Redirect if game already started
  if (game?.status === 'ACTIVE') {
    navigate(`/game/${gameId}/play`, { replace: true });
    return null;
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading game...</div>;
  }

  if (error || !game) {
    return <div className="text-center py-12 text-destructive">Failed to load game</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{game.name}</h1>
        {game.description && <p className="mt-2 text-muted-foreground">{game.description}</p>}
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
            <li key={player.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
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
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
              <div className="font-medium">{currentPlayer.persona.name}</div>
              {game.personas.find((p) => p.id === currentPlayer.persona?.id)?.description && (
                <div className="text-sm text-muted-foreground mt-1">
                  {game.personas.find((p) => p.id === currentPlayer.persona?.id)?.description}
                </div>
              )}
              <button
                onClick={() => selectPersonaMutation.mutate(null)}
                disabled={selectPersonaMutation.isPending}
                className="mt-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Change persona
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {availablePersonas.length === 0 ? (
                <p className="text-sm text-muted-foreground">All personas have been claimed.</p>
              ) : (
                availablePersonas.map((persona) => (
                  <button
                    key={persona.id}
                    onClick={() => selectPersonaMutation.mutate(persona.id)}
                    disabled={selectPersonaMutation.isPending}
                    className="w-full p-3 text-left border rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <div className="font-medium">{persona.name}</div>
                    {persona.description && (
                      <div className="text-sm text-muted-foreground">{persona.description}</div>
                    )}
                  </button>
                ))
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
                  persona.claimedBy ? 'bg-muted/50 text-muted-foreground' : 'bg-muted'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{persona.name}</span>
                  {persona.claimedBy ? (
                    <span className="text-xs">{persona.claimedBy.playerName}</span>
                  ) : (
                    <span className="text-xs text-green-600 dark:text-green-400">Available</span>
                  )}
                </div>
              </div>
            ))}
          </div>
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
        <button
          onClick={() => startMutation.mutate()}
          disabled={!canStart || startMutation.isPending}
          className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {startMutation.isPending ? 'Starting...' : 'Start Game'}
        </button>
      )}

      {!isHost && (
        <p className="text-center text-muted-foreground">
          Waiting for the host to start the game...
        </p>
      )}
    </div>
  );
}
