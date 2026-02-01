import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';

interface Player {
  id: string;
  playerName: string;
  isHost: boolean;
  user: { id: string; displayName: string };
}

interface Game {
  id: string;
  name: string;
  description?: string;
  status: string;
  players: Player[];
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

  const game = data?.data;
  const isHost = game?.players.some(
    (p) => p.user.id === user?.id && p.isHost
  );
  const inviteLink = `${window.location.origin}/join/${gameId}`;

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
        {game.description && (
          <p className="mt-2 text-muted-foreground">{game.description}</p>
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
          <button
            onClick={copyInviteLink}
            className="px-4 py-2 border rounded-md hover:bg-muted"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Share this link with others to invite them to the game
        </p>
      </div>

      <div className="p-4 border rounded-lg space-y-4">
        <h2 className="font-semibold">
          Players ({game.players.length})
        </h2>
        <ul className="space-y-2">
          {game.players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between p-2 bg-muted rounded-md"
            >
              <span>{player.playerName}</span>
              {player.isHost && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                  Host
                </span>
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

      {isHost && (
        <button
          onClick={() => startMutation.mutate()}
          disabled={game.players.length < 2 || startMutation.isPending}
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
