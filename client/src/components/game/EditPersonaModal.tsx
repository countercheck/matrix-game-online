import { useState } from 'react';
import { RichTextEditor } from '../ui/RichTextEditor';

interface EditPersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { 
    name?: string; 
    description?: string;
    npcActionDescription?: string;
    npcDesiredOutcome?: string;
  }) => Promise<void>;
  persona: {
    id: string;
    name: string;
    description: string | null;
    isNpc?: boolean;
    npcActionDescription?: string | null;
    npcDesiredOutcome?: string | null;
  };
}

export function EditPersonaModal({
  isOpen,
  onClose,
  onSave,
  persona,
}: EditPersonaModalProps) {
  const [name, setName] = useState(persona.name);
  const [description, setDescription] = useState(persona.description || '');
  const [npcActionDescription, setNpcActionDescription] = useState(persona.npcActionDescription || '');
  const [npcDesiredOutcome, setNpcDesiredOutcome] = useState(persona.npcDesiredOutcome || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data: {
        name: string;
        description?: string;
        npcActionDescription?: string;
        npcDesiredOutcome?: string;
      } = { 
        name, 
        description: description || undefined,
      };
      
      if (persona.isNpc) {
        data.npcActionDescription = npcActionDescription || undefined;
        data.npcDesiredOutcome = npcDesiredOutcome || undefined;
      }
      
      await onSave(data);
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(error.response?.data?.error?.message || 'Failed to update persona');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setName(persona.name);
      setDescription(persona.description || '');
      setNpcActionDescription(persona.npcActionDescription || '');
      setNpcDesiredOutcome(persona.npcDesiredOutcome || '');
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <h2 className="text-xl font-semibold">
              Edit Persona
              {persona.isNpc && (
                <span className="ml-2 text-sm bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded">
                  NPC
                </span>
              )}
            </h2>

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="persona-name" className="text-sm font-medium">
                Persona Name
              </label>
              <input
                id="persona-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter persona name"
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="persona-description" className="text-sm font-medium">
                Description
              </label>
              <RichTextEditor
                id="persona-description"
                value={description}
                onChange={setDescription}
                placeholder="Enter persona description"
                maxLength={1800}
                disabled={isLoading}
                rows={8}
              />
            </div>

            {persona.isNpc && (
              <>
                <div className="space-y-2">
                  <label htmlFor="npc-action-description" className="text-sm font-medium">
                    NPC Action Description
                  </label>
                  <RichTextEditor
                    id="npc-action-description"
                    value={npcActionDescription}
                    onChange={setNpcActionDescription}
                    placeholder="What kind of actions does this NPC propose?"
                    maxLength={1800}
                    disabled={isLoading}
                    rows={6}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="npc-desired-outcome" className="text-sm font-medium">
                    NPC Desired Outcome
                  </label>
                  <RichTextEditor
                    id="npc-desired-outcome"
                    value={npcDesiredOutcome}
                    onChange={setNpcDesiredOutcome}
                    placeholder="What does this NPC want to achieve?"
                    maxLength={1200}
                    disabled={isLoading}
                    rows={5}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 pb-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
