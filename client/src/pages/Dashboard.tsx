import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { SkeletonGameCard } from '../components/ui/Skeleton';
import { RichTextDisplay } from '../components/ui/RichTextDisplay';
import { downloadBlob } from '../utils/download';

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
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{ data: Game[] }>({
    queryKey: ['userGames'],
    queryFn: () => api.get('/users/me/games').then((res) => res.data),
  });

  const games = data?.data || [];

  const handleImport = async (file: File) => {
    setImportError(null);
    setImporting(true);
    try {
      const text = await file.text();
      const res = await api.post('/games/import', text, {
        headers: { 'Content-Type': 'text/yaml' },
      });
      const newGame = res.data.data;
      navigate(`/game/${newGame.id}/lobby`);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (() => {
              const responseData = (err as {
                response?: { data?: { error?: { message?: string }; message?: string } };
              }).response?.data;
              return responseData?.error?.message || responseData?.message || 'Import failed';
            })()
          : 'Import failed';
      setImportError(message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExport = async (gameId: string, gameName: string) => {
    setExportError(null);
    try {
      const response = await api.get(`/games/${gameId}/export`, {
        responseType: 'blob',
      });
      
      // Use Content-Type from response or fallback to common YAML MIME type
      const contentType = response.headers['content-type'] || 'application/x-yaml';
      const blob = new Blob([response.data], { type: contentType });
      const contentDisposition = response.headers['content-disposition'];
      
      downloadBlob(blob, `${gameName}-export.yaml`, contentDisposition);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (() => {
              const responseData = (err as {
                response?: { data?: { error?: { message?: string }; message?: string } };
              }).response?.data;
              return responseData?.error?.message || responseData?.message || 'Export failed';
            })()
          : 'Export failed';
      setExportError(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Your Games</h1>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center justify-center px-4 py-2 border rounded-md text-sm hover:border-primary hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
            aria-label="Import a game from YAML file"
          >
            {importing ? 'Importing...' : 'Import Game'}
          </button>
          <Link
            to="/create-game"
            className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-label="Create a new game"
          >
            Create Game
          </Link>
        </div>
      </div>

      {importError && (
        <div role="alert" className="p-3 text-sm border rounded-lg bg-destructive/5 text-destructive">
          {importError}
          <button onClick={() => setImportError(null)} className="ml-2 underline text-xs">Dismiss</button>
        </div>
      )}

      {exportError && (
        <div role="alert" className="p-3 text-sm border rounded-lg bg-destructive/5 text-destructive">
          {exportError}
          <button onClick={() => setExportError(null)} className="ml-2 underline text-xs" aria-label="Dismiss export error message">Dismiss</button>
        </div>
      )}

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
                <div
                  key={game.id}
                  className="border rounded-lg hover:border-primary transition-colors"
                >
                  <Link
                    to={
                      game.status === 'LOBBY'
                        ? `/game/${game.id}/lobby`
                        : `/game/${game.id}/play`
                    }
                    className="block p-4 focus:outline-none focus:ring-2 focus:ring-primary rounded-t-lg"
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
                        className="text-sm mt-1 line-clamp-2 [&_p]:my-0 [&_p]:text-muted-foreground [&_h2]:text-muted-foreground [&_h3]:text-muted-foreground [&_li]:text-muted-foreground [&_blockquote]:text-muted-foreground"
                        disableLinks
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
                <div className="px-4 pb-3 pt-1 border-t">
                  <button
                    onClick={() => handleExport(game.id, game.name)}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded"
                    aria-label={`Export ${game.name} as YAML`}
                  >
                    Export YAML
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </section>
      )}
    </div>
  );
}
