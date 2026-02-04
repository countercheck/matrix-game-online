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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: CreateGameData) => api.post('/games', data),
    onSuccess: async (response) => {
      const gameId = response.data.data.id;
      
      // Upload image if one was selected
      if (imageFile) {
        try {
          const formData = new FormData();
          formData.append('image', imageFile);
          await api.post(`/games/${gameId}/image`, formData);
        } catch (err) {
          console.error('Failed to upload image:', err);
          // Continue anyway - game was created successfully
        }
      }
      
      navigate(`/game/${gameId}/lobby`);
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      setError(err.response?.data?.error?.message || 'Failed to create game');
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (5MB limit)
      if (file.size > 5242880) {
        setImageFile(null);
        setImagePreview(null);
        e.target.value = '';
        setError('Image file size must be less than 5MB');
        return;
      }

      // Check file type
      if (!file.type.match(/^image\/(jpe?g|png|gif|webp)$/)) {
        setImageFile(null);
        setImagePreview(null);
        e.target.value = '';
        setError('Only JPEG, PNG, GIF, and WebP images are allowed');
        return;
      }

      setImageFile(file);
      
      // Create preview using URL.createObjectURL for better memory efficiency
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const removeImage = () => {
    // Revoke object URL to prevent memory leaks
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
  };

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

        {/* Image Upload Section */}
        <div className="space-y-2">
          <label htmlFor="image" className="text-sm font-medium">
            Game Image (Optional)
          </label>
          
          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Game preview"
                className="w-full h-48 object-cover rounded-md border"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 px-2 py-1 bg-destructive text-destructive-foreground rounded-md text-sm hover:bg-destructive/90"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-md p-6 text-center">
              <input
                id="image"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
              <label
                htmlFor="image"
                className="cursor-pointer inline-flex flex-col items-center justify-center"
                role="button"
                tabIndex={0}
                aria-label="Upload game image"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const input = document.getElementById('image') as HTMLInputElement | null;
                    input?.click();
                  }
                }}
              >
                <div className="space-y-2">
                  <div className="text-4xl" aria-hidden="true">📷</div>
                  <p className="text-sm text-muted-foreground">
                    Click to upload an image
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG, GIF, or WebP (max 5MB)
                  </p>
                </div>
              </label>
            </div>
          )}
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
