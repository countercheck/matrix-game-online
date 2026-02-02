import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';

interface Persona {
  name: string;
  description: string;
}

interface CreateGameData {
  name: string;
  description?: string;
  settings?: {
    personasRequired?: boolean;
  };
  personas?: Persona[];
}

export default function CreateGame() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personasRequired, setPersonasRequired] = useState(false);
  const [showPersonas, setShowPersonas] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: CreateGameData) => api.post('/games', data),
    onSuccess: (response) => {
      const gameId = response.data.data.id;
      navigate(`/game/${gameId}/lobby`);
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      setError(err.response?.data?.error?.message || 'Failed to create game');
    },
  });

  const addPersona = () => {
    if (personas.length < 20) {
      setPersonas([...personas, { name: '', description: '' }]);
    }
  };

  const removePersona = (index: number) => {
    setPersonas(personas.filter((_, i) => i !== index));
  };

  const updatePersona = (index: number, field: 'name' | 'description', value: string) => {
    const newPersonas = [...personas];
    newPersonas[index] = { ...newPersonas[index], [field]: value };
    setPersonas(newPersonas);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Filter out empty personas
    const validPersonas = personas.filter((p) => p.name.trim());

    const data: CreateGameData = {
      name,
      description: description || undefined,
    };

    if (validPersonas.length > 0) {
      data.personas = validPersonas;
      data.settings = { personasRequired };
    }

    createMutation.mutate(data);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Create New Game</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Game Name *
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className="w-full px-3 py-2 border rounded-md bg-background"
            placeholder="My Matrix Game"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="description" className="text-sm font-medium">
            Description / Setting
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={4}
            className="w-full px-3 py-2 border rounded-md bg-background resize-none"
            placeholder="Describe the scenario or setting for your game..."
          />
          <p className="text-xs text-muted-foreground">{description.length}/1000 characters</p>
        </div>

        {/* Personas Section */}
        <div className="border rounded-md">
          <button
            type="button"
            onClick={() => setShowPersonas(!showPersonas)}
            className="w-full px-4 py-3 text-left font-medium flex justify-between items-center hover:bg-muted/50"
          >
            <span>Personas (Optional)</span>
            <span className="text-muted-foreground">
              {personas.length > 0 ? `${personas.length} defined` : 'None'}
            </span>
          </button>

          {showPersonas && (
            <div className="p-4 border-t space-y-4">
              <p className="text-sm text-muted-foreground">
                Define character personas that players can claim when joining the game.
              </p>

              {personas.map((persona, index) => (
                <div key={index} className="p-3 border rounded-md space-y-2 bg-muted/30">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={persona.name}
                      onChange={(e) => updatePersona(index, 'name', e.target.value)}
                      maxLength={50}
                      className="flex-1 px-2 py-1 border rounded-md bg-background text-sm"
                      placeholder="Persona name"
                    />
                    <button
                      type="button"
                      onClick={() => removePersona(index)}
                      className="px-2 py-1 text-destructive hover:bg-destructive/10 rounded-md text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    value={persona.description}
                    onChange={(e) => updatePersona(index, 'description', e.target.value)}
                    maxLength={500}
                    rows={2}
                    className="w-full px-2 py-1 border rounded-md bg-background text-sm resize-none"
                    placeholder="Description (optional)"
                  />
                </div>
              ))}

              {personas.length < 20 && (
                <button
                  type="button"
                  onClick={addPersona}
                  className="w-full py-2 border border-dashed rounded-md text-sm text-muted-foreground hover:bg-muted/50"
                >
                  + Add Persona
                </button>
              )}

              {personas.length > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={personasRequired}
                    onChange={(e) => setPersonasRequired(e.target.checked)}
                    className="rounded"
                  />
                  Require players to select a persona when joining
                </label>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex-1 py-2 px-4 border rounded-md hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || !name.trim()}
            className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Game'}
          </button>
        </div>
      </form>
    </div>
  );
}
