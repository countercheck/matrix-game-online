import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { RichTextDisplay } from '../ui';

interface Action {
  id: string;
  actionDescription: string;
  desiredOutcome: string;
  initiator: {
    playerName: string;
  };
}

interface VoteInfo {
  hasVoted: boolean;
  myVote?: {
    voteType: 'LIKELY_SUCCESS' | 'LIKELY_FAILURE' | 'UNCERTAIN';
  };
  votesSubmitted: number;
  totalVoters: number;
}

interface VotingPanelProps {
  gameId: string;
  action: Action;
}

type VoteType = 'LIKELY_SUCCESS' | 'LIKELY_FAILURE' | 'UNCERTAIN';

const voteOptions: { type: VoteType; label: string; description: string; color: string }[] = [
  {
    type: 'LIKELY_SUCCESS',
    label: 'Likely to Succeed',
    description: '+2 Success tokens to the pool',
    color: 'green',
  },
  {
    type: 'UNCERTAIN',
    label: 'Uncertain',
    description: '+1 Success and +1 Failure token',
    color: 'yellow',
  },
  {
    type: 'LIKELY_FAILURE',
    label: 'Likely to Fail',
    description: '+2 Failure tokens to the pool',
    color: 'red',
  },
];

export function VotingPanel({ gameId, action }: VotingPanelProps) {
  const queryClient = useQueryClient();
  const [selectedVote, setSelectedVote] = useState<VoteType | null>(null);
  const [error, setError] = useState('');

  const { data: voteData } = useQuery<{ data: VoteInfo }>({
    queryKey: ['votes', action.id],
    queryFn: () => api.get(`/actions/${action.id}/votes`).then((res) => res.data),
    refetchInterval: 5000,
  });

  const voteInfo = voteData?.data;

  const voteMutation = useMutation({
    mutationFn: (voteType: VoteType) =>
      api.post(`/actions/${action.id}/votes`, { voteType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['votes', action.id] });
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      setError('');
    },
    onError: (err: unknown) => {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosError.response?.data?.error?.message || 'Failed to submit vote');
    },
  });

  const handleVote = () => {
    if (!selectedVote) {
      setError('Please select a vote');
      return;
    }
    voteMutation.mutate(selectedVote);
  };

  const hasVoted = voteInfo?.hasVoted;

  return (
    <div className="space-y-6">
      {/* Action summary */}
      <div className="p-6 border rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Vote on Action</h2>
        <div className="p-4 bg-muted rounded-md">
          <RichTextDisplay content={action.actionDescription} className="font-medium" />
          <div className="text-sm text-muted-foreground mt-2">
            <span className="font-medium">Desired outcome:</span>
            <RichTextDisplay content={action.desiredOutcome} className="mt-1" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Proposed by {action.initiator.playerName}
          </p>
        </div>
      </div>

      {/* Voting status */}
      {voteInfo && (
        <div className="p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Votes submitted</span>
            <span className="font-medium">
              {voteInfo.votesSubmitted} / {voteInfo.totalVoters}
            </span>
          </div>
        </div>
      )}

      {/* Vote options or confirmation */}
      {hasVoted ? (
        <div className="p-6 border rounded-lg text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-3">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="font-semibold">Vote Submitted</h3>
          <p className="text-sm text-muted-foreground mt-1">
            You voted:{' '}
            <span className="font-medium">
              {voteInfo?.myVote?.voteType === 'LIKELY_SUCCESS'
                ? 'Likely to Succeed'
                : voteInfo?.myVote?.voteType === 'LIKELY_FAILURE'
                ? 'Likely to Fail'
                : 'Uncertain'}
            </span>
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Waiting for other players to vote...
          </p>
        </div>
      ) : (
        <div className="p-6 border rounded-lg space-y-4">
          <h3 className="font-medium">Cast Your Vote</h3>
          <p className="text-sm text-muted-foreground">
            Your vote affects the token pool for the resolution draw.
          </p>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3 text-sm text-destructive bg-destructive/10 rounded-md"
            >
              {error}
            </div>
          )}

          <div
            className="space-y-3"
            role="radiogroup"
            aria-label="Vote options"
            aria-describedby="vote-description"
          >
            <p id="vote-description" className="sr-only">
              Select one option to cast your vote. Your vote affects the token pool for the resolution draw.
            </p>
            {voteOptions.map((option) => (
              <button
                key={option.type}
                type="button"
                role="radio"
                aria-checked={selectedVote === option.type}
                onClick={() => setSelectedVote(option.type)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  selectedVote === option.type
                    ? option.color === 'green'
                      ? 'border-green-500 bg-green-50 dark:bg-green-950 dark:text-green-100'
                      : option.color === 'red'
                      ? 'border-red-500 bg-red-50 dark:bg-red-950 dark:text-red-100'
                      : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-100'
                    : 'border-muted hover:border-primary/50'
                }`}
                aria-label={`${option.label}: ${option.description}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{option.label}</span>
                  <div className="flex items-center gap-1" aria-hidden="true">
                    {option.type === 'LIKELY_SUCCESS' && (
                      <>
                        <span className="w-4 h-4 rounded-full bg-green-500" title="Success token" />
                        <span className="w-4 h-4 rounded-full bg-green-500" title="Success token" />
                      </>
                    )}
                    {option.type === 'UNCERTAIN' && (
                      <>
                        <span className="w-4 h-4 rounded-full bg-green-500" title="Success token" />
                        <span className="w-4 h-4 rounded-full bg-red-500" title="Failure token" />
                      </>
                    )}
                    {option.type === 'LIKELY_FAILURE' && (
                      <>
                        <span className="w-4 h-4 rounded-full bg-red-500" title="Failure token" />
                        <span className="w-4 h-4 rounded-full bg-red-500" title="Failure token" />
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
              </button>
            ))}
          </div>

          <button
            onClick={handleVote}
            disabled={!selectedVote || voteMutation.isPending}
            aria-disabled={!selectedVote || voteMutation.isPending}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {voteMutation.isPending ? 'Submitting...' : 'Submit Vote'}
          </button>
        </div>
      )}
    </div>
  );
}
