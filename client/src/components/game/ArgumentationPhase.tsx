import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { ArgumentList } from './ArgumentList';
import { AddArgument } from './AddArgument';

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
}

export function ArgumentationPhase({
  gameId,
  action,
  remainingArguments,
  hasCompletedArgumentation,
}: ArgumentationPhaseProps) {
  const queryClient = useQueryClient();

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/actions/${action.id}/complete-argumentation`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Action being discussed */}
      <div className="p-6 border rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Action Under Discussion</h2>
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

      {/* Arguments list */}
      <div className="p-6 border rounded-lg">
        <ArgumentList actionId={action.id} />
      </div>

      {/* Add argument form */}
      {!hasCompletedArgumentation && (
        <AddArgument
          actionId={action.id}
          gameId={gameId}
          remainingArguments={remainingArguments}
        />
      )}

      {/* Complete argumentation */}
      <div className="p-4 border rounded-lg bg-muted/50">
        {hasCompletedArgumentation ? (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              You have finished arguing. Waiting for other players...
            </p>
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
              {completeMutation.isPending ? 'Submitting...' : 'I\'m Done'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
