import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { RichTextDisplay } from '../components/ui/RichTextDisplay';
import { getApiErrorMessage } from '../utils/apiError';
import { decodeHtmlEntities } from '../utils/decodeEntities';

interface Persona {
  id: string;
  name: string;
  description: string | null;
  claimedBy: { id: string; playerName: string } | null;
}

interface GameData {
  id: string;
  name: string;
  personas: Persona[];
  settings: {
    personasRequired?: boolean;
  };
}

export default function JoinGame() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const [playerName, setPlayerName] = useState(user?.displayName || '');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Fetch game to get personas
  const { data: gameData, isLoading: isLoadingGame } = useQuery<{ data: GameData }>({
    queryKey: ['game', gameId],
    queryFn: () => api.get(`/games/${gameId}`).then((res) => res.data),
    enabled: !!gameId,
  });

  const game = gameData?.data;
  const personas = game?.personas || [];
  const personasRequired = game?.settings?.personasRequired || false;
  const availablePersonas = personas.filter((p) => !p.claimedBy);
  const hasPersonas = personas.length > 0;

  const joinMutation = useMutation({
    mutationFn: (data: { playerName: string; personaId?: string }) =>
      api.post(`/games/${gameId}/join`, data),
    onSuccess: () => {
      navigate(`/game/${gameId}/lobby`);
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, 'Failed to join game'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (hasPersonas && personasRequired && !selectedPersonaId) {
      setError('Please select a persona to join this game');
      return;
    }

    joinMutation.mutate({
      playerName,
      personaId: selectedPersonaId || undefined,
    });
  };

  if (isLoadingGame) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center py-8 text-muted-foreground">Loading game...</div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Join Game</h1>
      {game && <p className="text-muted-foreground">Joining: {decodeHtmlEntities(game.name)}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
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

        {/* Persona Selection */}
        {hasPersonas && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Select a Persona {personasRequired && <span className="text-destructive">*</span>}
            </label>
            <div className="space-y-2">
              {availablePersonas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  All personas have been claimed.
                </p>
              ) : (
                availablePersonas.map((persona) => (
                  <label
                    key={persona.id}
                    className={`block p-3 border rounded-md cursor-pointer transition-colors ${
                      selectedPersonaId === persona.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="persona"
                        value={persona.id}
                        checked={selectedPersonaId === persona.id}
                        onChange={() => setSelectedPersonaId(persona.id)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">{decodeHtmlEntities(persona.name)}</div>
                        {persona.description && (
                          <RichTextDisplay
                            content={persona.description}
                            className="text-sm text-muted-foreground [&_p]:my-1"
                          />
                        )}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
            {!personasRequired && selectedPersonaId && (
              <button
                type="button"
                onClick={() => setSelectedPersonaId(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Clear selection
              </button>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={
            joinMutation.isPending ||
            !playerName.trim() ||
            (hasPersonas && personasRequired && !selectedPersonaId)
          }
          className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {joinMutation.isPending ? 'Joining...' : 'Join Game'}
        </button>
      </form>
    </div>
  );
}
