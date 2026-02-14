import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { RichTextDisplay } from '../ui';
import { formatRelativeTime } from '../../utils/formatTime';

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

interface DrawnToken {
  tokenType: 'SUCCESS' | 'FAILURE';
}

interface DrawResult {
  drawnTokens: DrawnToken[];
  drawnSuccess: number;
  drawnFailure: number;
  resultValue: number;
  resultType: 'TRIUMPH' | 'SUCCESS_BUT' | 'FAILURE_BUT' | 'DISASTER';
  drawnAt: string;
}

interface TokenDrawProps {
  gameId: string;
  action: Action;
  currentUserId: string;
}

const resultLabels: Record<string, { label: string; description: string; color: string }> = {
  TRIUMPH: {
    label: 'Triumph!',
    description: 'Complete success with additional benefits',
    color: 'green',
  },
  SUCCESS_BUT: {
    label: 'Success, but...',
    description: 'You succeed, but with a complication',
    color: 'yellow',
  },
  FAILURE_BUT: {
    label: 'Failure, but...',
    description: 'You fail, but with a silver lining',
    color: 'orange',
  },
  DISASTER: {
    label: 'Disaster!',
    description: 'Complete failure with additional consequences',
    color: 'red',
  },
};

export function TokenDraw({ gameId, action, currentUserId }: TokenDrawProps) {
  const queryClient = useQueryClient();
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnTokens, setDrawnTokens] = useState<DrawnToken[]>([]);
  const [animationComplete, setAnimationComplete] = useState(false);

  const isInitiator = action.initiator.userId === currentUserId;

  const { data: drawData } = useQuery<{ data: DrawResult | null }>({
    queryKey: ['drawResult', action.id],
    queryFn: () => api.get(`/actions/${action.id}/draw`).then((res) => res.data),
    refetchInterval: !animationComplete ? 3000 : false,
  });

  const existingResult = drawData?.data;

  const drawMutation = useMutation({
    mutationFn: () => api.post(`/actions/${action.id}/draw`),
    onSuccess: (response) => {
      const result = response.data.data as DrawResult;
      // Animate the tokens one by one
      animateTokenDraw(result.drawnTokens);
    },
    onError: () => {
      setIsDrawing(false);
    },
  });

  const animateTokenDraw = (tokens: DrawnToken[]) => {
    setIsDrawing(true);
    setDrawnTokens([]);

    tokens.forEach((token, index) => {
      setTimeout(
        () => {
          setDrawnTokens((prev) => [...prev, token]);
          if (index === tokens.length - 1) {
            setTimeout(() => {
              setAnimationComplete(true);
              setIsDrawing(false);
              queryClient.invalidateQueries({ queryKey: ['drawResult', action.id] });
              queryClient.invalidateQueries({ queryKey: ['game', gameId] });
            }, 1000);
          }
        },
        (index + 1) * 600
      );
    });
  };

  // If there's already a result, show it
  if (existingResult) {
    const resultInfo = resultLabels[existingResult.resultType];
    if (!resultInfo) {
      console.error(
        `Unknown resultType encountered: "${existingResult.resultType}". ` +
          `Expected one of: ${Object.keys(resultLabels).join(', ')}. ` +
          `This may indicate an API issue or data inconsistency.`
      );
    }
    const displayInfo = resultInfo || {
      label: existingResult.resultType,
      description: 'Result',
      color: 'yellow',
    };
    return (
      <div className="space-y-6">
        {/* Action summary */}
        <div className="p-6 border rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Resolution</h2>
          <div className="p-4 bg-muted rounded-md">
            <RichTextDisplay content={action.actionDescription} className="font-medium" />
            <p className="text-xs text-muted-foreground mt-2">
              Proposed by {action.initiator.playerName}
            </p>
          </div>
        </div>

        {/* Result display */}
        <div
          className={`p-6 border rounded-lg text-center ${
            displayInfo.color === 'green'
              ? 'bg-green-50 border-green-500 dark:bg-green-950'
              : displayInfo.color === 'yellow'
                ? 'bg-yellow-50 border-yellow-500 dark:bg-yellow-950'
                : displayInfo.color === 'orange'
                  ? 'bg-orange-50 border-orange-500 dark:bg-orange-950'
                  : 'bg-red-50 border-red-500 dark:bg-red-950'
          }`}
        >
          <h3 className="text-2xl font-bold mb-2">{displayInfo.label}</h3>
          <p className="text-muted-foreground mb-4">{displayInfo.description}</p>

          {/* Drawn tokens */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {existingResult.drawnTokens.map((token, i) => (
              <div
                key={i}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                  token.tokenType === 'SUCCESS' ? 'bg-green-500' : 'bg-red-500'
                }`}
              >
                {token.tokenType === 'SUCCESS' ? 'S' : 'F'}
              </div>
            ))}
          </div>

          <p className="text-lg font-semibold">
            Numeric Result:{' '}
            <span
              className={
                existingResult.resultValue > 0
                  ? 'text-green-600'
                  : existingResult.resultValue < 0
                    ? 'text-red-600'
                    : 'text-yellow-600'
              }
            >
              {existingResult.resultValue > 0 ? '+' : ''}
              {existingResult.resultValue}
            </span>
          </p>
          {existingResult.drawnAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Drawn {formatRelativeTime(existingResult.drawnAt)}
            </p>
          )}
        </div>

        <div className="text-center text-sm text-muted-foreground">
          {isInitiator ? 'Time to narrate the outcome!' : 'Waiting for the initiator to narrate...'}
        </div>
      </div>
    );
  }

  // Drawing animation in progress
  if (isDrawing) {
    return (
      <div className="space-y-6">
        <div className="p-6 border rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Drawing Tokens...</h2>
          <div className="flex items-center justify-center gap-4 py-8">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold transition-all duration-500 ${
                  drawnTokens[i]
                    ? drawnTokens[i].tokenType === 'SUCCESS'
                      ? 'bg-green-500 text-white scale-100'
                      : 'bg-red-500 text-white scale-100'
                    : 'bg-muted scale-75 animate-pulse'
                }`}
              >
                {drawnTokens[i] ? (drawnTokens[i].tokenType === 'SUCCESS' ? 'S' : 'F') : '?'}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Waiting for draw
  return (
    <div className="space-y-6">
      {/* Action summary */}
      <div className="p-6 border rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Resolution Phase</h2>
        <div className="p-4 bg-muted rounded-md">
          <RichTextDisplay content={action.actionDescription} className="font-medium" />
          <p className="text-xs text-muted-foreground mt-2">
            Proposed by {action.initiator.playerName}
          </p>
        </div>
      </div>

      {/* Draw button (initiator only) */}
      <div className="p-6 border rounded-lg text-center">
        {isInitiator ? (
          <>
            <h3 className="font-semibold mb-2">Time to Draw Tokens!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Draw 3 tokens from the pool to determine the outcome of your action.
            </p>
            <button
              onClick={() => drawMutation.mutate()}
              disabled={drawMutation.isPending}
              className="py-3 px-8 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 font-medium text-lg"
            >
              {drawMutation.isPending ? 'Drawing...' : 'Draw Tokens'}
            </button>
          </>
        ) : (
          <>
            <h3 className="font-semibold mb-2">Waiting for Token Draw</h3>
            <p className="text-sm text-muted-foreground">
              {action.initiator.playerName} will draw the tokens to determine the outcome.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
