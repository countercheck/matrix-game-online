import { RichTextDisplay } from '../../ui';
import type { ResolutionProps } from './index';

interface ArbiterStrategyData {
  diceRoll: [number, number];
  base: number;
  strongProCount: number;
  strongAntiCount: number;
  modified: number;
  resultType: 'SUCCESS_BUT' | 'FAILURE_BUT';
  resultValue: number;
}

const resultLabels: Record<string, { label: string; description: string; color: string }> = {
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
};

export function ArbiterResolution({ action, currentUserId }: ResolutionProps) {
  const isInitiator = action.initiator.userId === currentUserId;

  // resolutionData is present once the arbiter has resolved the action.
  // The parent ResolutionPhase polls until resolutionData is present.
  const resolutionData = action.resolutionData as ArbiterStrategyData | undefined;

  if (!resolutionData) {
    return (
      <div className="p-6 border rounded-lg text-center text-muted-foreground">
        Waiting for resolution data...
      </div>
    );
  }

  const { diceRoll, base, strongProCount, strongAntiCount, modified, resultType, resultValue } =
    resolutionData;
  const resultInfo = resultLabels[resultType] || {
    label: resultType,
    description: 'Result',
    color: 'yellow',
  };

  return (
    <div className="space-y-6">
      <div className="p-6 border rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Resolution</h2>
        <div className="p-4 bg-muted rounded-md">
          <RichTextDisplay content={action.actionDescription} className="font-medium" />
          <p className="text-xs text-muted-foreground mt-2">
            Proposed by {action.initiator.playerName}
          </p>
        </div>
      </div>

      {/* Dice roll breakdown */}
      <div className="p-6 border rounded-lg font-mono text-sm space-y-1">
        <p className="text-muted-foreground text-xs uppercase tracking-wide mb-3">
          Arbiter Roll Breakdown
        </p>
        <p>
          Roll: {diceRoll[0]} + {diceRoll[1]} = <strong>{base}</strong> (base)
        </p>
        {strongProCount > 0 && (
          <p className="text-green-600 dark:text-green-400">
            + {strongProCount} strong FOR argument{strongProCount !== 1 ? 's' : ''}
          </p>
        )}
        {strongAntiCount > 0 && (
          <p className="text-red-600 dark:text-red-400">
            − {strongAntiCount} strong AGAINST argument{strongAntiCount !== 1 ? 's' : ''}
          </p>
        )}
        <hr className="border-muted my-2" />
        <p>
          Modified roll: <strong>{modified}</strong>
          <span className="text-muted-foreground ml-2">(threshold: &gt; 7)</span>
        </p>
      </div>

      {/* Result */}
      <div
        className={`p-6 border rounded-lg text-center ${
          resultInfo.color === 'yellow'
            ? 'bg-yellow-50 border-yellow-500 dark:bg-yellow-950'
            : 'bg-orange-50 border-orange-500 dark:bg-orange-950'
        }`}
      >
        <h3 className="text-2xl font-bold mb-2">{resultInfo.label}</h3>
        <p className="text-muted-foreground mb-4">{resultInfo.description}</p>
        <p className="text-lg font-semibold">
          Numeric Result:{' '}
          <span
            className={
              resultValue > 0
                ? 'text-green-600'
                : resultValue < 0
                  ? 'text-red-600'
                  : 'text-yellow-600'
            }
          >
            {resultValue > 0 ? '+' : ''}
            {resultValue}
          </span>
        </p>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        {isInitiator ? 'Time to narrate the outcome!' : 'Waiting for the initiator to narrate...'}
      </div>
    </div>
  );
}
