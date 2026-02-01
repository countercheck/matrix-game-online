import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

interface Action {
  id: string;
  actionDescription: string;
  desiredOutcome: string;
  initiator: {
    id: string;
    playerName: string;
    userId: string;
  };
}

interface DrawResult {
  drawnTokens: { type: 'SUCCESS' | 'FAILURE' }[];
  successCount: number;
  failureCount: number;
  numericResult: number;
  resultType: 'TRIUMPH' | 'SUCCESS_WITH_COMPLICATION' | 'FAILURE_WITH_SILVER_LINING' | 'DISASTER';
}

interface Narration {
  id: string;
  content: string;
  author: {
    playerName: string;
  };
  createdAt: string;
}

interface NarrationFormProps {
  gameId: string;
  action: Action;
  currentUserId: string;
}

const resultLabels: Record<string, { label: string; guidance: string; color: string }> = {
  TRIUMPH: {
    label: 'Triumph!',
    guidance: 'Describe a complete success with additional benefits or advantages.',
    color: 'green',
  },
  SUCCESS_WITH_COMPLICATION: {
    label: 'Success, but...',
    guidance: 'Describe how you succeed, but with an unexpected complication or cost.',
    color: 'yellow',
  },
  FAILURE_WITH_SILVER_LINING: {
    label: 'Failure, but...',
    guidance: 'Describe how you fail, but find some unexpected benefit or opportunity.',
    color: 'orange',
  },
  DISASTER: {
    label: 'Disaster!',
    guidance: 'Describe a complete failure with additional negative consequences.',
    color: 'red',
  },
};

export function NarrationForm({ gameId, action, currentUserId }: NarrationFormProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const isInitiator = action.initiator.userId === currentUserId;

  // Fetch draw result
  const { data: drawData } = useQuery<{ data: DrawResult | null }>({
    queryKey: ['drawResult', action.id],
    queryFn: () => api.get(`/actions/${action.id}/draw`).then((res) => res.data),
  });

  // Fetch existing narration
  const { data: narrationData } = useQuery<{ data: Narration | null }>({
    queryKey: ['narration', action.id],
    queryFn: () => api.get(`/actions/${action.id}/narration`).then((res) => res.data),
    refetchInterval: 5000,
  });

  const drawResult = drawData?.data;
  const existingNarration = narrationData?.data;

  const narrationMutation = useMutation({
    mutationFn: (narrationContent: string) =>
      api.post(`/actions/${action.id}/narration`, { content: narrationContent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['narration', action.id] });
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      setContent('');
      setError('');
    },
    onError: (err: unknown) => {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosError.response?.data?.error?.message || 'Failed to submit narration');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Narration is required');
      return;
    }
    narrationMutation.mutate(content.trim());
  };

  if (!drawResult) {
    return <div className="text-center py-4">Loading result...</div>;
  }

  const resultInfo = resultLabels[drawResult.resultType];

  // If there's already a narration, show it
  if (existingNarration) {
    return (
      <div className="space-y-6">
        {/* Result summary */}
        <div
          className={`p-6 border rounded-lg ${
            resultInfo.color === 'green'
              ? 'bg-green-50 border-green-500 dark:bg-green-950'
              : resultInfo.color === 'yellow'
              ? 'bg-yellow-50 border-yellow-500 dark:bg-yellow-950'
              : resultInfo.color === 'orange'
              ? 'bg-orange-50 border-orange-500 dark:bg-orange-950'
              : 'bg-red-50 border-red-500 dark:bg-red-950'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{resultInfo.label}</h2>
            <div className="flex items-center gap-1">
              {drawResult.drawnTokens.map((token, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                    token.type === 'SUCCESS' ? 'bg-green-500' : 'bg-red-500'
                  }`}
                >
                  {token.type === 'SUCCESS' ? 'S' : 'F'}
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm mb-4">
            <span className="font-medium">Action:</span> {action.actionDescription}
          </p>
        </div>

        {/* Narration display */}
        <div className="p-6 border rounded-lg">
          <h3 className="font-semibold mb-2">What Happened</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Narrated by {existingNarration.author.playerName}
          </p>
          <div className="p-4 bg-muted rounded-md">
            <p className="whitespace-pre-wrap">{existingNarration.content}</p>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Action complete! Returning to proposal phase...
        </div>
      </div>
    );
  }

  // Narration form (initiator only)
  return (
    <div className="space-y-6">
      {/* Result summary */}
      <div
        className={`p-6 border rounded-lg ${
          resultInfo.color === 'green'
            ? 'bg-green-50 border-green-500 dark:bg-green-950'
            : resultInfo.color === 'yellow'
            ? 'bg-yellow-50 border-yellow-500 dark:bg-yellow-950'
            : resultInfo.color === 'orange'
            ? 'bg-orange-50 border-orange-500 dark:bg-orange-950'
            : 'bg-red-50 border-red-500 dark:bg-red-950'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{resultInfo.label}</h2>
          <div className="flex items-center gap-1">
            {drawResult.drawnTokens.map((token, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                  token.type === 'SUCCESS' ? 'bg-green-500' : 'bg-red-500'
                }`}
              >
                {token.type === 'SUCCESS' ? 'S' : 'F'}
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm">
          <span className="font-medium">Action:</span> {action.actionDescription}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="font-medium">Desired outcome:</span> {action.desiredOutcome}
        </p>
      </div>

      {isInitiator ? (
        <form onSubmit={handleSubmit} className="p-6 border rounded-lg space-y-4">
          <h3 className="font-semibold">Narrate the Outcome</h3>
          <p className="text-sm text-muted-foreground">{resultInfo.guidance}</p>

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1000}
              rows={6}
              className="w-full px-3 py-2 border rounded-md bg-background resize-none"
              placeholder="Describe what happens as a result of your action..."
            />
            <p className="text-xs text-muted-foreground text-right">
              {content.length}/1000 characters
            </p>
          </div>

          <button
            type="submit"
            disabled={narrationMutation.isPending}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {narrationMutation.isPending ? 'Submitting...' : 'Submit Narration'}
          </button>
        </form>
      ) : (
        <div className="p-6 border rounded-lg text-center">
          <h3 className="font-semibold mb-2">Waiting for Narration</h3>
          <p className="text-sm text-muted-foreground">
            {action.initiator.playerName} is writing the narration for this action.
          </p>
        </div>
      )}
    </div>
  );
}
