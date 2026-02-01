import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

interface ActionProposalProps {
  gameId: string;
  hasProposedThisRound: boolean;
  onProposed?: () => void;
}

export function ActionProposal({ gameId, hasProposedThisRound, onProposed }: ActionProposalProps) {
  const queryClient = useQueryClient();
  const [actionDescription, setActionDescription] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [arguments_, setArguments] = useState(['', '', '']);
  const [error, setError] = useState('');

  const proposeMutation = useMutation({
    mutationFn: (data: {
      actionDescription: string;
      desiredOutcome: string;
      initialArguments: string[];
    }) => api.post(`/games/${gameId}/actions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      setActionDescription('');
      setDesiredOutcome('');
      setArguments(['', '', '']);
      setError('');
      onProposed?.();
    },
    onError: (err: unknown) => {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosError.response?.data?.error?.message || 'Failed to propose action');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Filter out empty arguments
    const validArguments = arguments_.filter((arg) => arg.trim().length > 0);

    if (validArguments.length === 0) {
      setError('At least one argument is required');
      return;
    }

    proposeMutation.mutate({
      actionDescription: actionDescription.trim(),
      desiredOutcome: desiredOutcome.trim(),
      initialArguments: validArguments,
    });
  };

  const handleArgumentChange = (index: number, value: string) => {
    const newArgs = [...arguments_];
    newArgs[index] = value;
    setArguments(newArgs);
  };

  if (hasProposedThisRound) {
    return (
      <div className="p-6 border rounded-lg bg-muted/50">
        <h2 className="text-lg font-semibold mb-2">Action Proposed</h2>
        <p className="text-muted-foreground">
          You have already proposed an action this round. Wait for other players to propose
          their actions, or for the current action to be resolved.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 border rounded-lg space-y-4">
      <h2 className="text-lg font-semibold">Propose an Action</h2>

      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="actionDescription" className="text-sm font-medium">
          What do you want to do?
        </label>
        <textarea
          id="actionDescription"
          value={actionDescription}
          onChange={(e) => setActionDescription(e.target.value)}
          required
          maxLength={500}
          rows={3}
          className="w-full px-3 py-2 border rounded-md bg-background resize-none"
          placeholder="Describe the action you want to attempt..."
        />
        <p className="text-xs text-muted-foreground text-right">
          {actionDescription.length}/500 characters
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="desiredOutcome" className="text-sm font-medium">
          What outcome are you hoping for?
        </label>
        <textarea
          id="desiredOutcome"
          value={desiredOutcome}
          onChange={(e) => setDesiredOutcome(e.target.value)}
          required
          maxLength={300}
          rows={2}
          className="w-full px-3 py-2 border rounded-md bg-background resize-none"
          placeholder="Describe your desired outcome..."
        />
        <p className="text-xs text-muted-foreground text-right">
          {desiredOutcome.length}/300 characters
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">
          Initial Arguments (why this should succeed)
        </label>
        <p className="text-xs text-muted-foreground">
          Provide 1-3 arguments supporting your action. These will form the initial case for success.
        </p>
        {arguments_.map((arg, index) => (
          <div key={index} className="space-y-1">
            <textarea
              value={arg}
              onChange={(e) => handleArgumentChange(index, e.target.value)}
              maxLength={200}
              rows={2}
              className="w-full px-3 py-2 border rounded-md bg-background resize-none"
              placeholder={`Argument ${index + 1}${index === 0 ? ' (required)' : ' (optional)'}...`}
            />
            <p className="text-xs text-muted-foreground text-right">
              {arg.length}/200 characters
            </p>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={proposeMutation.isPending}
        className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
      >
        {proposeMutation.isPending ? 'Proposing...' : 'Propose Action'}
      </button>
    </form>
  );
}
