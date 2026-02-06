import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { SkeletonGameCard } from '../components/ui/Skeleton';
import { RichTextDisplay } from '../components/ui/RichTextDisplay';

interface Game {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  status: string;
  currentPhase: string;
  playerCount: number;
  playerName: string;
  isHost: boolean;
  currentRound?: number;
  updatedAt: string;
}

export default function Dashboard() {
  const { data, isLoading, error, refetch } = useQuery<{ data: Game[] }>({
    queryKey: ['userGames'],
    queryFn: () => api.get('/users/me/games').then((res) => res.data),
  });

  const games = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Your Games</h1>
        <Link
          to="/create-game"
          className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          aria-label="Create a new game"
        >
          Create Game
        </Link>
      </div>

      {/* Loading state with aria-live for screen readers */}
      <div aria-live="polite" aria-busy={isLoading}>
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonGameCard />
            <SkeletonGameCard />
            <SkeletonGameCard />
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="text-center py-8 sm:py-12 border rounded-lg bg-destructive/5"
        >
          <p className="text-destructive">Failed to load games.</p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-label="Retry loading games"
          >
            Try Again
          </button>
        </div>
      )}

      {!isLoading && games.length === 0 && (
        <div className="text-center py-8 sm:py-12 border rounded-lg bg-muted/50">
          <p className="text-muted-foreground">No games yet.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Create a new game or join one using an invite link.
          </p>
        </div>
      )}

      {games.length > 0 && (
        <section aria-label="Your games list">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => {
              // Validate image URL for security
              const isValidImageUrl = game.imageUrl && 
                (game.imageUrl.startsWith('http://localhost:') || 
                 game.imageUrl.startsWith('https://') ||
                 game.imageUrl.startsWith('/uploads/'));
              
              return (
                <Link
                  key={game.id}
                  to={
                    game.status === 'LOBBY'
                      ? `/game/${game.id}/lobby`
                      : `/game/${game.id}/play`
                  }
                  className="block p-4 border rounded-lg hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label={`${game.name} - ${game.status} - ${game.playerCount} players${game.isHost ? ' - You are the host' : ''}`}
                >
                  <article>
                    {/* Game Image */}
                    {isValidImageUrl && (
                      <div className="mb-3 -mx-4 -mt-4">
                        <img
                          src={game.imageUrl}
                          alt={game.name}
                          className="w-full h-32 object-cover rounded-t-lg"
                        />
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold truncate">{game.name}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                        game.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100'
                          : game.status === 'LOBBY'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-100'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-100'
                      }`}
                      aria-label={`Status: ${game.status}`}
                    >
                      {game.status}
                    </span>
                  </div>

                  {game.description && (
                    <RichTextDisplay
                      content={game.description}
                      className="text-sm text-muted-foreground mt-1 line-clamp-2 [&_p]:my-0"
                    />
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
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
                </article>
              </Link>
            );
          })}
          </div>
        </section>
      )}
    </div>
  );
}
