import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { ArgumentList } from './ArgumentList';
import { AddArgument } from './AddArgument';
import { EditActionModal } from './EditActionModal';

interface Action {
  id: string;
  actionDescription: string;
  desiredOutcome: string;
  initiator: {
    playerName: string;
  };
}

interface ArgumentationPhaseProps {
  gameId: string;
  action: Action;
  remainingArguments: number;
  hasCompletedArgumentation: boolean;
  isHost?: boolean;
}

interface CompleteResponse {
  data: {
    message: string;
    waitingFor?: string[];
    playersRemaining?: number;
  };
}

export function ArgumentationPhase({
  gameId,
  action,
  remainingArguments,
  hasCompletedArgumentation,
  isHost = false,
}: ArgumentationPhaseProps) {
  const queryClient = useQueryClient();
  const [showEditAction, setShowEditAction] = useState(false);
  const [waitingStatus, setWaitingStatus] = useState<{
    waitingFor?: string[];
    playersRemaining?: number;
  } | null>(null);

  const editActionMutation = useMutation({
    mutationFn: (data: { actionDescription?: string; desiredOutcome?: string }) =>
      api.put(`/actions/${action.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/actions/${action.id}/complete-argumentation`),
    onSuccess: (response: CompleteResponse) => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      if (response.data.waitingFor || response.data.playersRemaining) {
        setWaitingStatus({
          waitingFor: response.data.waitingFor,
          playersRemaining: response.data.playersRemaining,
        });
      }
    },
  });

  return (
    <div className="space-y-6">
      {/* Action being discussed */}
      <div className="p-6 border rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Action Under Discussion</h2>
          {isHost && (
            <button
              onClick={() => setShowEditAction(true)}
              className="text-xs text-primary hover:underline"
              title="Edit action (host)"
            >
              Edit
            </button>
          )}
        </div>
        <div className="p-4 bg-muted rounded-md">
          <p className="font-medium">{action.actionDescription}</p>
          <p className="text-sm text-muted-foreground mt-2">
            <span className="font-medium">Desired outcome:</span> {action.desiredOutcome}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Proposed by {action.initiator.playerName}
          </p>
        </div>
      </div>

      {/* Edit Action Modal */}
      {showEditAction && (
        <EditActionModal
          isOpen={showEditAction}
          onClose={() => setShowEditAction(false)}
          onSave={async (data) => {
            await editActionMutation.mutateAsync(data);
          }}
          initialActionDescription={action.actionDescription}
          initialDesiredOutcome={action.desiredOutcome}
        />
      )}

      {/* Arguments list */}
      <div className="p-6 border rounded-lg">
        <ArgumentList actionId={action.id} gameId={gameId} isHost={isHost} />
      </div>

      {/* Add argument form */}
      {!hasCompletedArgumentation && (
        <AddArgument actionId={action.id} gameId={gameId} remainingArguments={remainingArguments} />
      )}

      {/* Complete argumentation */}
      <div className="p-4 border rounded-lg bg-muted/50">
        {hasCompletedArgumentation ? (
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              You have finished arguing. Waiting for other players...
            </p>
            {waitingStatus?.waitingFor && waitingStatus.waitingFor.length > 0 && (
              <p className="text-xs text-orange-600 dark:text-orange-400">
                Waiting for arguments from: {waitingStatus.waitingFor.join(', ')}
              </p>
            )}
            {waitingStatus?.playersRemaining && (
              <p className="text-xs text-muted-foreground">
                {waitingStatus.playersRemaining} player
                {waitingStatus.playersRemaining !== 1 ? 's' : ''} still arguing
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Done arguing?</p>
              <p className="text-sm text-muted-foreground">
                Click when you're ready to move to voting.
              </p>
            </div>
            <button
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              className="py-2 px-4 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-50"
            >
              {completeMutation.isPending ? 'Submitting...' : "I'm Done"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
