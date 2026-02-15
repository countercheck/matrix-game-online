import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';

interface HostControlsProps {
  gameId: string;
  currentPhase: string;
  currentActionId?: string;
  isHost: boolean;
}

export function HostControls({
  gameId,
  currentPhase,
  currentActionId,
  isHost,
}: HostControlsProps) {
  const queryClient = useQueryClient();
  const [confirmSkip, setConfirmSkip] = useState<string | null>(null);

  const skipProposalsMutation = useMutation({
    mutationFn: () => api.post(`/games/${gameId}/skip-proposals`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      setConfirmSkip(null);
    },
  });

  const skipArgumentationMutation = useMutation({
    mutationFn: () => api.post(`/actions/${currentActionId}/skip-argumentation`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      setConfirmSkip(null);
    },
  });

  const skipVotingMutation = useMutation({
    mutationFn: () => api.post(`/actions/${currentActionId}/skip-voting`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      setConfirmSkip(null);
    },
  });

  if (!isHost) {
    return null;
  }

  const renderSkipButton = () => {
    // Determine which skip action is available based on current phase
    if (currentPhase === 'PROPOSAL' && !currentActionId) {
      // In proposal phase waiting for proposals
      return (
        <SkipConfirmButton
          label="Skip Remaining Proposals"
          description="End the proposal phase and move to round summary. At least one action must have been proposed."
          confirmKey="proposals"
          confirmSkip={confirmSkip}
          setConfirmSkip={setConfirmSkip}
          isLoading={skipProposalsMutation.isPending}
          onConfirm={() => skipProposalsMutation.mutate()}
          error={skipProposalsMutation.error}
        />
      );
    }

    if (currentPhase === 'ARGUMENTATION' && currentActionId) {
      return (
        <SkipConfirmButton
          label="Skip Argumentation"
          description="End the argumentation phase early and move to voting."
          confirmKey="argumentation"
          confirmSkip={confirmSkip}
          setConfirmSkip={setConfirmSkip}
          isLoading={skipArgumentationMutation.isPending}
          onConfirm={() => skipArgumentationMutation.mutate()}
          error={skipArgumentationMutation.error}
        />
      );
    }

    if (currentPhase === 'VOTING' && currentActionId) {
      return (
        <SkipConfirmButton
          label="Skip Voting"
          description="End the voting phase. Missing votes will be auto-filled as 'Uncertain'."
          confirmKey="voting"
          confirmSkip={confirmSkip}
          setConfirmSkip={setConfirmSkip}
          isLoading={skipVotingMutation.isPending}
          onConfirm={() => skipVotingMutation.mutate()}
          error={skipVotingMutation.error}
        />
      );
    }

    return null;
  };

  const skipButton = renderSkipButton();

  if (!skipButton) {
    return null;
  }

  return (
    <div className="p-4 border rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
      <h3 className="font-semibold mb-2 flex items-center gap-2 text-amber-800 dark:text-amber-200">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Host Controls
      </h3>
      {skipButton}
    </div>
  );
}

interface SkipConfirmButtonProps {
  label: string;
  description: string;
  confirmKey: string;
  confirmSkip: string | null;
  setConfirmSkip: (key: string | null) => void;
  isLoading: boolean;
  onConfirm: () => void;
  error: Error | null;
}

function SkipConfirmButton({
  label,
  description,
  confirmKey,
  confirmSkip,
  setConfirmSkip,
  isLoading,
  onConfirm,
  error,
}: SkipConfirmButtonProps) {
  const isConfirming = confirmSkip === confirmKey;

  if (isConfirming) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-amber-700 dark:text-amber-300">{description}</p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50"
          >
            {isLoading ? 'Skipping...' : 'Confirm Skip'}
          </button>
          <button
            onClick={() => setConfirmSkip(null)}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-md"
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {getApiErrorMessage(error, 'Failed to skip')}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirmSkip(confirmKey)}
      className="w-full px-3 py-2 text-sm text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-md transition-colors"
    >
      {label}
    </button>
  );
}
