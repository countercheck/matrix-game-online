import { useState } from 'react';
import { RichTextEditor } from '../ui/RichTextEditor';

interface EditActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { actionDescription?: string; desiredOutcome?: string }) => Promise<void>;
  initialActionDescription: string;
  initialDesiredOutcome: string;
}

export function EditActionModal({
  isOpen,
  onClose,
  onSave,
  initialActionDescription,
  initialDesiredOutcome,
}: EditActionModalProps) {
  const [actionDescription, setActionDescription] = useState(initialActionDescription);
  const [desiredOutcome, setDesiredOutcome] = useState(initialDesiredOutcome);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data: { actionDescription?: string; desiredOutcome?: string } = {};
      if (actionDescription !== initialActionDescription) {
        data.actionDescription = actionDescription;
      }
      if (desiredOutcome !== initialDesiredOutcome) {
        data.desiredOutcome = desiredOutcome;
      }
      if (Object.keys(data).length === 0) {
        onClose();
        return;
      }
      await onSave(data);
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(error.response?.data?.error?.message || 'Failed to update action');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setActionDescription(initialActionDescription);
      setDesiredOutcome(initialDesiredOutcome);
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
            <h2 className="text-xl font-semibold">Edit Action Proposal</h2>

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="action-description" className="text-sm font-medium">
                Action Description
              </label>
              <RichTextEditor
                id="action-description"
                value={actionDescription}
                onChange={setActionDescription}
                placeholder="Describe the proposed action"
                maxLength={1800}
                disabled={isLoading}
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="desired-outcome" className="text-sm font-medium">
                Desired Outcome
              </label>
              <RichTextEditor
                id="desired-outcome"
                value={desiredOutcome}
                onChange={setDesiredOutcome}
                placeholder="Describe the desired outcome"
                maxLength={1200}
                disabled={isLoading}
                rows={4}
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
