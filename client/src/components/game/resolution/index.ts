import type { ComponentType } from 'react';
import { TokenDrawResolution } from './TokenDrawResolution';
import { ArbiterResolution } from './ArbiterResolution';

export interface ResolutionProps {
  gameId: string;
  action: {
    id: string;
    actionDescription: string;
    desiredOutcome: string;
    initiator: {
      id: string;
      playerName: string;
      userId: string;
    };
    resolutionData?: Record<string, unknown>;
  };
  currentUserId: string;
}

/** Maps strategy IDs to their React renderer components */
export const rendererRegistry: Record<string, ComponentType<ResolutionProps>> = {
  token_draw: TokenDrawResolution,
  arbiter: ArbiterResolution,
};

export { ResolutionPhase } from './ResolutionPhase';
export { TokenDrawResolution } from './TokenDrawResolution';
export { ArbiterResolution } from './ArbiterResolution';
