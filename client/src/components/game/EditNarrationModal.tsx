import { useState } from 'react';
import { RichTextEditor } from '../ui/RichTextEditor';
import { getApiErrorMessage } from '../../utils/apiError';

interface EditNarrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { content: string }) => Promise<void>;
  initialContent: string;
}

export function EditNarrationModal({
  isOpen,
  onClose,
  onSave,
  initialContent,
}: EditNarrationModalProps) {
  const [content, setContent] = useState(initialContent);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await onSave({ content });
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to update narration'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setContent(initialContent);
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <h2 className="text-xl font-semibold">Edit Narration</h2>

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="narration-content" className="text-sm font-medium">
                Narration
              </label>
              <RichTextEditor
                id="narration-content"
                value={content}
                onChange={setContent}
                placeholder="Enter narration text"
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
