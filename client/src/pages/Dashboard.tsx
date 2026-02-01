import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

interface Game {
  id: string;
  name: string;
  description?: string;
  status: string;
  currentPhase: string;
  playerCount: number;
  playerName: string;
  isHost: boolean;
  currentRound?: number;
  updatedAt: string;
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery<{ data: Game[] }>({
    queryKey: ['userGames'],
    queryFn: () => api.get('/users/me/games').then((res) => res.data),
  });

  const games = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Games</h1>
        <Link
          to="/create-game"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Create Game
        </Link>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading games...</div>
      )}

      {error && (
        <div className="text-center py-12 text-destructive">
          Failed to load games. Please try again.
        </div>
      )}

      {!isLoading && games.length === 0 && (
        <div className="text-center py-12 border rounded-lg bg-muted/50">
          <p className="text-muted-foreground">No games yet.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Create a new game or join one using an invite link.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => (
          <Link
            key={game.id}
            to={
              game.status === 'LOBBY'
                ? `/game/${game.id}/lobby`
                : `/game/${game.id}/play`
            }
            className="block p-4 border rounded-lg hover:border-primary transition-colors"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-semibold">{game.name}</h3>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  game.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-700'
                    : game.status === 'LOBBY'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {game.status}
              </span>
            </div>

            {game.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {game.description}
              </p>
            )}

            <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
              <span>{game.playerCount} players</span>
              {game.currentRound && <span>Round {game.currentRound}</span>}
              {game.isHost && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                  Host
                </span>
              )}
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              Playing as <span className="font-medium">{game.playerName}</span>
            </div>

            {game.status === 'ACTIVE' && (
              <div className="mt-2 text-xs">
                <span className="text-muted-foreground">Phase: </span>
                <span className="font-medium">{game.currentPhase}</span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
