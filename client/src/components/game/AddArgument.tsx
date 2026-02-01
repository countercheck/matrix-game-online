import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

interface AddArgumentProps {
  actionId: string;
  gameId: string;
  remainingArguments: number;
  onAdded?: () => void;
}

type ArgumentType = 'FOR' | 'AGAINST' | 'CLARIFICATION';

export function AddArgument({ actionId, gameId, remainingArguments, onAdded }: AddArgumentProps) {
  const queryClient = useQueryClient();
  const [argumentType, setArgumentType] = useState<ArgumentType>('FOR');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const addMutation = useMutation({
    mutationFn: (data: { argumentType: ArgumentType; content: string }) =>
      api.post(`/actions/${actionId}/arguments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['arguments', actionId] });
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      setContent('');
      setError('');
      onAdded?.();
    },
    onError: (err: unknown) => {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosError.response?.data?.error?.message || 'Failed to add argument');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!content.trim()) {
      setError('Argument content is required');
      return;
    }

    addMutation.mutate({
      argumentType,
      content: content.trim(),
    });
  };

  if (remainingArguments <= 0) {
    return (
      <div className="p-4 bg-muted/50 rounded-md text-sm text-muted-foreground">
        You have used all your arguments for this action.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Add Argument</h4>
        <span className="text-sm text-muted-foreground">
          {remainingArguments} remaining
        </span>
      </div>

      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setArgumentType('FOR')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            argumentType === 'FOR'
              ? 'bg-green-600 text-white'
              : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300'
          }`}
        >
          For
        </button>
        <button
          type="button"
          onClick={() => setArgumentType('AGAINST')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            argumentType === 'AGAINST'
              ? 'bg-red-600 text-white'
              : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300'
          }`}
        >
          Against
        </button>
        <button
          type="button"
          onClick={() => setArgumentType('CLARIFICATION')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            argumentType === 'CLARIFICATION'
              ? 'bg-blue-600 text-white'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300'
          }`}
        >
          Clarify
        </button>
      </div>

      <div className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={200}
          rows={3}
          className="w-full px-3 py-2 border rounded-md bg-background resize-none"
          placeholder={
            argumentType === 'FOR'
              ? 'Why this action should succeed...'
              : argumentType === 'AGAINST'
              ? 'Why this action might fail...'
              : 'Additional context or clarification...'
          }
        />
        <p className="text-xs text-muted-foreground text-right">
          {content.length}/200 characters
        </p>
      </div>

      <button
        type="submit"
        disabled={addMutation.isPending}
        className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
      >
        {addMutation.isPending ? 'Adding...' : 'Add Argument'}
      </button>
    </form>
  );
}
