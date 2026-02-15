import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { RichTextEditor, RichTextDisplay } from '../ui';
import { formatRelativeTime } from '../../utils/formatTime';
import { EditNarrationModal } from './EditNarrationModal';
import { getApiErrorMessage } from '../../utils/apiError';

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
  drawnTokens: { tokenType: 'SUCCESS' | 'FAILURE' }[];
  drawnSuccess: number;
  drawnFailure: number;
  resultValue: number;
  resultType: 'TRIUMPH' | 'SUCCESS_BUT' | 'FAILURE_BUT' | 'DISASTER';
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
  isHost?: boolean;
}

const resultLabels: Record<
  string,
  {
    label: string;
    guidance: string;
    colorKey: 'triumph' | 'successBut' | 'failureBut' | 'disaster';
  }
> = {
  TRIUMPH: {
    label: 'Triumph!',
    guidance: 'Describe a complete success with additional benefits or advantages.',
    colorKey: 'triumph',
  },
  SUCCESS_BUT: {
    label: 'Success, but...',
    guidance: 'Describe how you succeed, but with an unexpected complication or cost.',
    colorKey: 'successBut',
  },
  FAILURE_BUT: {
    label: 'Failure, but...',
    guidance: 'Describe how you fail, but find some unexpected benefit or opportunity.',
    colorKey: 'failureBut',
  },
  DISASTER: {
    label: 'Disaster!',
    guidance: 'Describe a complete failure with additional negative consequences.',
    colorKey: 'disaster',
  },
};

// Colorblind-friendly result styling
const getResultStyles = (colorKey: 'triumph' | 'successBut' | 'failureBut' | 'disaster') => {
  const styles = {
    triumph: {
      container: 'bg-result-triumph-bg border-result-triumph text-result-triumph-text',
      icon: (
        <svg
          className="w-5 h-5 text-result-triumph"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    successBut: {
      container: 'bg-result-success-but-bg border-result-success-but text-result-success-but-text',
      icon: (
        <svg
          className="w-5 h-5 text-result-success-but"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    failureBut: {
      container: 'bg-result-failure-but-bg border-result-failure-but text-result-failure-but-text',
      icon: (
        <svg
          className="w-5 h-5 text-result-failure-but"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    disaster: {
      container: 'bg-result-disaster-bg border-result-disaster text-result-disaster-text',
      icon: (
        <svg
          className="w-5 h-5 text-result-disaster"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  };
  return styles[colorKey];
};

export function NarrationForm({
  gameId,
  action,
  currentUserId,
  isHost = false,
}: NarrationFormProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [showEditNarration, setShowEditNarration] = useState(false);

  const editNarrationMutation = useMutation({
    mutationFn: (data: { content: string }) => api.put(`/actions/${action.id}/narration`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['narration', action.id] });
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });

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
      setError(getApiErrorMessage(err, 'Failed to submit narration'));
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

  const resultStyle = getResultStyles(resultInfo.colorKey);

  // If there's already a narration, show it
  if (existingNarration) {
    return (
      <div className="space-y-6">
        {/* Result summary */}
        <div className={`p-6 border-2 rounded-lg ${resultStyle.container}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {resultStyle.icon}
              <h2 className="text-lg font-semibold">{resultInfo.label}</h2>
            </div>
            <div className="flex items-center gap-1">
              {drawResult.drawnTokens.map((token, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                    token.tokenType === 'SUCCESS' ? 'bg-vote-success' : 'bg-vote-failure'
                  }`}
                >
                  {token.tokenType === 'SUCCESS' ? 'S' : 'F'}
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
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">What Happened</h3>
            {isHost && (
              <button
                onClick={() => setShowEditNarration(true)}
                className="text-xs text-primary hover:underline"
                title="Edit narration (host)"
              >
                Edit
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Narrated by {existingNarration.author.playerName} ·{' '}
            {formatRelativeTime(existingNarration.createdAt)}
          </p>
          <div className="p-4 bg-muted rounded-md">
            <RichTextDisplay content={existingNarration.content} />
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Action complete! Returning to proposal phase...
        </div>

        {/* Edit Narration Modal */}
        {showEditNarration && (
          <EditNarrationModal
            isOpen={showEditNarration}
            onClose={() => setShowEditNarration(false)}
            onSave={async (data) => {
              await editNarrationMutation.mutateAsync(data);
            }}
            initialContent={existingNarration.content}
          />
        )}
      </div>
    );
  }

  // Narration form (initiator only)
  return (
    <div className="space-y-6">
      {/* Result summary */}
      <div className={`p-6 border-2 rounded-lg ${resultStyle.container}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {resultStyle.icon}
            <h2 className="text-lg font-semibold">{resultInfo.label}</h2>
          </div>
          <div className="flex items-center gap-1">
            {drawResult.drawnTokens.map((token, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                  token.tokenType === 'SUCCESS' ? 'bg-vote-success' : 'bg-vote-failure'
                }`}
              >
                {token.tokenType === 'SUCCESS' ? 'S' : 'F'}
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
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
          )}

          <div className="space-y-2">
            <RichTextEditor
              value={content}
              onChange={setContent}
              maxLength={3600}
              rows={6}
              placeholder="Describe what happens as a result of your action..."
            />
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
