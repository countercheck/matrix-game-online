import type { ResolutionStrategy } from './resolution-strategy.js';
import { BadRequestError } from '../../middleware/errorHandler.js';

const strategies = new Map<string, ResolutionStrategy>();

export function registerStrategy(strategy: ResolutionStrategy): void {
  if (strategies.has(strategy.id)) {
    throw new Error(`Resolution strategy "${strategy.id}" is already registered`);
  }
  strategies.set(strategy.id, strategy);
}

export function getStrategy(id: string): ResolutionStrategy {
  const strategy = strategies.get(id);
  if (!strategy) {
    throw new BadRequestError(`Unknown resolution strategy: "${id}"`);
  }
  return strategy;
}

export function getAllStrategies(): ReadonlyArray<ResolutionStrategy> {
  return Array.from(strategies.values());
}
