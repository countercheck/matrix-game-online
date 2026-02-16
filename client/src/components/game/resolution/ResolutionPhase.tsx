import type { ResolutionProps } from './index';
import { rendererRegistry } from './index';

interface ResolutionPhaseProps extends ResolutionProps {
  resolutionMethod?: string;
}

export function ResolutionPhase({
  gameId,
  action,
  currentUserId,
  resolutionMethod,
}: ResolutionPhaseProps) {
  const strategyId = resolutionMethod || 'token_draw';
  const Renderer = rendererRegistry[strategyId] ?? rendererRegistry['token_draw'];

  if (!Renderer) {
    return (
      <div className="p-6 border rounded-lg text-center text-muted-foreground">
        Unknown resolution method: {strategyId}
      </div>
    );
  }

  return <Renderer gameId={gameId} action={action} currentUserId={currentUserId} />;
}
