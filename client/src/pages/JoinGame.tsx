import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';

export default function JoinGame() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const [playerName, setPlayerName] = useState(user?.displayName || '');
  const [error, setError] = useState('');

  const joinMutation = useMutation({
    mutationFn: (data: { playerName: string }) =>
      api.post(`/games/${gameId}/join`, data),
    onSuccess: () => {
      navigate(`/game/${gameId}/lobby`);
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      setError(err.response?.data?.error?.message || 'Failed to join game');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    joinMutation.mutate({ playerName });
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Join Game</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="playerName" className="text-sm font-medium">
            Your Name in This Game
          </label>
          <input
            id="playerName"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            required
            maxLength={50}
            className="w-full px-3 py-2 border rounded-md bg-background"
            placeholder="Enter your name"
          />
        </div>

        <button
          type="submit"
          disabled={joinMutation.isPending || !playerName.trim()}
          className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {joinMutation.isPending ? 'Joining...' : 'Join Game'}
        </button>
      </form>
    </div>
  );
}
