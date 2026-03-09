import { useState } from 'react';
import { RichTextEditor } from '../ui/RichTextEditor';
import { getApiErrorMessage } from '../../utils/apiError';

interface EditArgumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { content: string }) => Promise<void>;
  initialContent: string;
  argumentType?: 'FOR' | 'AGAINST';
}

export function EditArgumentModal({
  isOpen,
  onClose,
  onSave,
  initialContent,
  argumentType,
}: EditArgumentModalProps) {
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
      setError(getApiErrorMessage(err, 'Failed to update argument'));
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
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-lg lg:max-w-2xl mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Edit Argument</h2>
              {argumentType && (
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    argumentType === 'FOR'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}
                >
                  {argumentType}
                </span>
              )}
            </div>

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="argument-content" className="text-sm font-medium">
                Argument
              </label>
              <RichTextEditor
                id="argument-content"
                value={content}
                onChange={setContent}
                placeholder="Enter your argument"
                maxLength={900}
                disabled={isLoading}
                rows={6}
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
