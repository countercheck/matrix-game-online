import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { RichTextDisplay, PrimaryActionButton } from '../ui';
import { getApiErrorMessage } from '../../utils/apiError';
import { decodeHtmlEntities } from '../../utils/decodeEntities';

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

const voteOptions: {
  type: VoteType;
  label: string;
  description: string;
  colorKey: 'success' | 'uncertain' | 'failure';
}[] = [
  {
    type: 'LIKELY_SUCCESS',
    label: 'Likely to Succeed',
    description: '+2 Success tokens to the pool',
    colorKey: 'success',
  },
  {
    type: 'UNCERTAIN',
    label: 'Uncertain',
    description: '+1 Success and +1 Failure token',
    colorKey: 'uncertain',
  },
  {
    type: 'LIKELY_FAILURE',
    label: 'Likely to Fail',
    description: '+2 Failure tokens to the pool',
    colorKey: 'failure',
  },
];

// Colorblind-friendly styling for vote options
const getVoteStyles = (colorKey: 'success' | 'uncertain' | 'failure', isSelected: boolean) => {
  const styles = {
    success: {
      selected: 'border-vote-success bg-vote-success-bg',
      unselected: 'border-muted hover:border-vote-success/50',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    uncertain: {
      selected: 'border-vote-uncertain bg-vote-uncertain-bg',
      unselected: 'border-muted hover:border-vote-uncertain/50',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    failure: {
      selected: 'border-vote-failure bg-vote-failure-bg',
      unselected: 'border-muted hover:border-vote-failure/50',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  };
  return {
    className: isSelected ? styles[colorKey].selected : styles[colorKey].unselected,
    icon: styles[colorKey].icon,
  };
};

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
    mutationFn: (voteType: VoteType) => api.post(`/actions/${action.id}/votes`, { voteType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['votes', action.id] });
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      setError('');
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, 'Failed to submit vote'));
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
            Proposed by {decodeHtmlEntities(action.initiator.playerName)}
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
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-vote-success-bg text-vote-success mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <p className="text-sm text-muted-foreground mt-2">Waiting for other players to vote...</p>
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
              Select one option to cast your vote. Your vote affects the token pool for the
              resolution draw.
            </p>
            {voteOptions.map((option) => {
              const voteStyle = getVoteStyles(option.colorKey, selectedVote === option.type);
              return (
                <button
                  key={option.type}
                  type="button"
                  role="radio"
                  aria-checked={selectedVote === option.type}
                  onClick={() => setSelectedVote(option.type)}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${voteStyle.className}`}
                  aria-label={`${option.label}: ${option.description}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          option.colorKey === 'success'
                            ? 'text-vote-success'
                            : option.colorKey === 'failure'
                              ? 'text-vote-failure'
                              : 'text-vote-uncertain'
                        }
                      >
                        {voteStyle.icon}
                      </span>
                      <span className="font-medium">{option.label}</span>
                    </div>
                    <div className="flex items-center gap-1" aria-hidden="true">
                      {option.type === 'LIKELY_SUCCESS' && (
                        <>
                          <span
                            className="w-4 h-4 rounded-full bg-vote-success flex items-center justify-center text-white text-xs font-bold"
                            title="Success token"
                          >
                            S
                          </span>
                          <span
                            className="w-4 h-4 rounded-full bg-vote-success flex items-center justify-center text-white text-xs font-bold"
                            title="Success token"
                          >
                            S
                          </span>
                        </>
                      )}
                      {option.type === 'UNCERTAIN' && (
                        <>
                          <span
                            className="w-4 h-4 rounded-full bg-vote-success flex items-center justify-center text-white text-xs font-bold"
                            title="Success token"
                          >
                            S
                          </span>
                          <span
                            className="w-4 h-4 rounded-full bg-vote-failure flex items-center justify-center text-white text-xs font-bold"
                            title="Failure token"
                          >
                            F
                          </span>
                        </>
                      )}
                      {option.type === 'LIKELY_FAILURE' && (
                        <>
                          <span
                            className="w-4 h-4 rounded-full bg-vote-failure flex items-center justify-center text-white text-xs font-bold"
                            title="Failure token"
                          >
                            F
                          </span>
                          <span
                            className="w-4 h-4 rounded-full bg-vote-failure flex items-center justify-center text-white text-xs font-bold"
                            title="Failure token"
                          >
                            F
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                </button>
              );
            })}
          </div>

          <PrimaryActionButton
            onClick={handleVote}
            disabled={!selectedVote}
            loading={voteMutation.isPending}
            loadingText="Submitting..."
          >
            Submit Vote
          </PrimaryActionButton>
        </div>
      )}
    </div>
  );
}
