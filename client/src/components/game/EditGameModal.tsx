import { useState } from 'react';
import { RichTextEditor } from '../ui/RichTextEditor';

const TIMEOUT_OPTIONS = [
  { label: 'No limit', value: -1 },
  { label: '1 hour', value: 1 },
  { label: '4 hours', value: 4 },
  { label: '8 hours', value: 8 },
  { label: '12 hours', value: 12 },
  { label: '24 hours', value: 24 },
  { label: '48 hours', value: 48 },
  { label: '72 hours', value: 72 },
  { label: '1 week', value: 168 },
];

interface EditGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string | null;
    settings?: Record<string, unknown>;
  }) => Promise<void>;
  initialName: string;
  initialDescription: string;
  initialSettings?: {
    proposalTimeoutHours?: number;
    argumentationTimeoutHours?: number;
    votingTimeoutHours?: number;
    narrationTimeoutHours?: number;
  };
}

export function EditGameModal({
  isOpen,
  onClose,
  onSave,
  initialName,
  initialDescription,
  initialSettings,
}: EditGameModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [proposalTimeout, setProposalTimeout] = useState(
    initialSettings?.proposalTimeoutHours ?? -1
  );
  const [argumentationTimeout, setArgumentationTimeout] = useState(
    initialSettings?.argumentationTimeoutHours ?? -1
  );
  const [votingTimeout, setVotingTimeout] = useState(
    initialSettings?.votingTimeoutHours ?? -1
  );
  const [narrationTimeout, setNarrationTimeout] = useState(
    initialSettings?.narrationTimeoutHours ?? -1
  );
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
        description: description.trim() || null,
        settings: {
          proposalTimeoutHours: proposalTimeout,
          argumentationTimeoutHours: argumentationTimeout,
          votingTimeoutHours: votingTimeout,
          narrationTimeoutHours: narrationTimeout,
        },
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
      setProposalTimeout(initialSettings?.proposalTimeoutHours ?? -1);
      setArgumentationTimeout(initialSettings?.argumentationTimeoutHours ?? -1);
      setVotingTimeout(initialSettings?.votingTimeoutHours ?? -1);
      setNarrationTimeout(initialSettings?.narrationTimeoutHours ?? -1);
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

            {/* Phase Timeouts */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Phase Timeouts</h3>
              <p className="text-xs text-muted-foreground">
                Set time limits for each phase. Changes take effect immediately.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <TimeoutSelect
                  label="Proposal"
                  value={proposalTimeout}
                  onChange={setProposalTimeout}
                  disabled={isLoading}
                />
                <TimeoutSelect
                  label="Argumentation"
                  value={argumentationTimeout}
                  onChange={setArgumentationTimeout}
                  disabled={isLoading}
                />
                <TimeoutSelect
                  label="Voting"
                  value={votingTimeout}
                  onChange={setVotingTimeout}
                  disabled={isLoading}
                />
                <TimeoutSelect
                  label="Narration"
                  value={narrationTimeout}
                  onChange={setNarrationTimeout}
                  disabled={isLoading}
                />
              </div>
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

function TimeoutSelect({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full px-2 py-1.5 border rounded-md bg-background text-sm disabled:opacity-50"
      >
        {TIMEOUT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
