export type {
  ResolutionStrategy,
  VotingResolutionStrategy,
  ArbiterResolutionStrategy,
  ArbiterResolutionContext,
  ResolutionVotes,
  ResolutionResult,
  VoteTokenMapping,
} from './resolution-strategy.js';

export { registerStrategy, getStrategy, getAllStrategies } from './registry.js';

// Import strategies to trigger self-registration
import './strategies/token-draw.strategy.js';
import './strategies/arbiter.strategy.js';
