import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

interface Persona {
  id: string;
  name: string;
}

interface Player {
  id: string;
  playerName: string;
  personaName?: string | null;
}

interface ChatSettings {
  enablePersonaChat?: boolean;
  enableDirectChat?: boolean;
}

interface NewChannelModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    scope: 'PERSONA' | 'DIRECT';
    personaIds?: string[];
    playerIds?: string[];
    name?: string;
  }) => Promise<void>;
  personas: Persona[];
  players: Player[];
  chatSettings: ChatSettings;
}

export function NewChannelModal({
  open,
  onClose,
  onCreate,
  personas,
  players,
  chatSettings,
}: NewChannelModalProps) {
  const [scope, setScope] = useState<'PERSONA' | 'DIRECT'>('DIRECT');
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const personaChatEnabled = chatSettings.enablePersonaChat !== false;
  const directChatEnabled = chatSettings.enableDirectChat !== false;

  const handleCreate = async () => {
    setError('');
    setCreating(true);
    try {
      if (scope === 'PERSONA') {
        if (selectedPersonas.length === 0) {
          setError('Select at least one persona');
          return;
        }
        await onCreate({ scope: 'PERSONA', personaIds: selectedPersonas });
      } else {
        if (selectedPlayers.length === 0) {
          setError('Select at least one player');
          return;
        }
        await onCreate({ scope: 'DIRECT', playerIds: selectedPlayers });
      }
      onClose();
      setSelectedPersonas([]);
      setSelectedPlayers([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create channel');
    } finally {
      setCreating(false);
    }
  };

  const togglePersona = (id: string) => {
    setSelectedPersonas((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const togglePlayer = (id: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-4 sm:mx-auto bg-background border rounded-lg shadow-xl p-5 sm:p-6 space-y-4">
          <Dialog.Title className="text-lg font-semibold">New Chat</Dialog.Title>

          {/* Scope tabs */}
          <div className="flex gap-1 bg-muted/50 p-1 rounded-md">
            <button
              onClick={() => setScope('DIRECT')}
              disabled={!directChatEnabled}
              className={`flex-1 py-1.5 px-3 text-sm rounded transition-colors ${
                scope === 'DIRECT'
                  ? 'bg-background shadow font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              } ${!directChatEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Direct Message
            </button>
            {personas.length > 0 && (
              <button
                onClick={() => setScope('PERSONA')}
                disabled={!personaChatEnabled}
                className={`flex-1 py-1.5 px-3 text-sm rounded transition-colors ${
                  scope === 'PERSONA'
                    ? 'bg-background shadow font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                } ${!personaChatEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Persona Chat
              </button>
            )}
          </div>

          {/* Disabled notice */}
          {scope === 'PERSONA' && !personaChatEnabled && (
            <p className="text-sm text-muted-foreground">Disabled by host</p>
          )}
          {scope === 'DIRECT' && !directChatEnabled && (
            <p className="text-sm text-muted-foreground">Disabled by host</p>
          )}

          {/* Selection list */}
          {scope === 'PERSONA' && personaChatEnabled && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-2">Select personas to chat with:</p>
              {personas.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedPersonas.includes(p.id)}
                    onChange={() => togglePersona(p.id)}
                    className="rounded"
                  />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
          )}

          {scope === 'DIRECT' && directChatEnabled && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-2">Select players to message:</p>
              {players.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedPlayers.includes(p.id)}
                    onChange={() => togglePlayer(p.id)}
                    className="rounded"
                  />
                  <span>{p.personaName ? `${p.personaName} (${p.playerName})` : p.playerName}</span>
                </label>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <button className="px-4 py-2 text-sm border rounded-md hover:bg-muted">Cancel</button>
            </Dialog.Close>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
