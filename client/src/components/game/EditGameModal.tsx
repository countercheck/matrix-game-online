import { useState } from 'react';
import { RichTextEditor } from '../ui/RichTextEditor';

interface EditGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; description: string | null }) => Promise<void>;
  initialName: string;
  initialDescription: string;
}

export function EditGameModal({
  isOpen,
  onClose,
  onSave,
  initialName,
  initialDescription,
}: EditGameModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await onSave({ 
        name, 
        description: description.trim() || null
      });
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(error.response?.data?.error?.message || 'Failed to update game');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setName(initialName);
      setDescription(initialDescription);
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
            <h2 className="text-xl font-semibold">Edit Game</h2>

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="game-name" className="text-sm font-medium">
                Game Name
              </label>
              <input
                id="game-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter game name"
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="game-description" className="text-sm font-medium">
                Description
              </label>
              <RichTextEditor
                id="game-description"
                value={description}
                onChange={setDescription}
                placeholder="Enter game description"
                maxLength={3600}
                disabled={isLoading}
                rows={10}
              />
            </div>
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
