export type {
  ResolutionStrategy,
  ResolutionVotes,
  ResolutionResult,
  VoteTokenMapping,
} from './resolution-strategy.js';

export {
  registerStrategy,
  getStrategy,
  getAllStrategies,
} from './registry.js';

// Import strategies to trigger self-registration
import './strategies/token-draw.strategy.js';
