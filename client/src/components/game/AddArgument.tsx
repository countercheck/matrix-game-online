import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { RichTextEditor } from '../ui';
import { getApiErrorMessage } from '../../utils/apiError';

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
      setError(getApiErrorMessage(err, 'Failed to add argument'));
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
    <form
      onSubmit={handleSubmit}
      className="space-y-4 p-4 border rounded-lg"
      aria-label="Add argument form"
    >
      <div className="flex items-center justify-between">
        <h4 className="font-medium" id="argument-form-title">
          Add Argument
        </h4>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {remainingArguments} remaining
        </span>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="p-3 text-sm text-destructive bg-destructive/10 rounded-md"
        >
          {error}
        </div>
      )}

      <div className="flex gap-1.5 sm:gap-2" role="radiogroup" aria-label="Argument type">
        <button
          type="button"
          role="radio"
          aria-checked={argumentType === 'FOR'}
          onClick={() => setArgumentType('FOR')}
          className={`flex-1 py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-arg-for inline-flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 ${
            argumentType === 'FOR'
              ? 'bg-arg-for text-white'
              : 'bg-arg-for-bg text-arg-for-text hover:bg-arg-for-badge-bg border border-arg-for-border'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          For
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={argumentType === 'AGAINST'}
          onClick={() => setArgumentType('AGAINST')}
          className={`flex-1 py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-arg-against inline-flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 ${
            argumentType === 'AGAINST'
              ? 'bg-arg-against text-white'
              : 'bg-arg-against-bg text-arg-against-text hover:bg-arg-against-badge-bg border border-arg-against-border'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          Against
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={argumentType === 'CLARIFICATION'}
          onClick={() => setArgumentType('CLARIFICATION')}
          className={`flex-1 py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-arg-clarify inline-flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 ${
            argumentType === 'CLARIFICATION'
              ? 'bg-arg-clarify text-white'
              : 'bg-arg-clarify-bg text-arg-clarify-text hover:bg-arg-clarify-badge-bg border border-arg-clarify-border'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          Clarify
        </button>
      </div>

      <div className="space-y-2">
        <label htmlFor="argument-content" className="sr-only">
          Argument content
        </label>
        <RichTextEditor
          id="argument-content"
          value={content}
          onChange={setContent}
          maxLength={900}
          rows={3}
          placeholder={
            argumentType === 'FOR'
              ? 'Why this action should succeed...'
              : argumentType === 'AGAINST'
                ? 'Why this action might fail...'
                : 'Additional context or clarification...'
          }
        />
      </div>

      <button
        type="submit"
        disabled={addMutation.isPending}
        aria-disabled={addMutation.isPending}
        className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {addMutation.isPending ? 'Adding...' : 'Add Argument'}
      </button>
    </form>
  );
}
