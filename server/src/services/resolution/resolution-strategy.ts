import type { ResultType } from '@prisma/client';

/** Immutable input representing votes cast on an action */
export interface ResolutionVotes {
  readonly votes: ReadonlyArray<{
    readonly playerId: string;
    readonly voteType: 'LIKELY_SUCCESS' | 'LIKELY_FAILURE' | 'UNCERTAIN';
    readonly successTokens: number;
    readonly failureTokens: number;
  }>;
}

/** Common result shape produced by every resolution strategy */
export interface ResolutionResult {
  readonly resultType: ResultType;
  readonly resultValue: number;
  readonly strategyData: Record<string, unknown>;
}

/** Token contributions for a given vote type */
export interface VoteTokenMapping {
  readonly successTokens: number;
  readonly failureTokens: number;
}

/** Input for arbiter-style resolution */
export interface ArbiterResolutionContext {
  readonly strongProCount: number;
  readonly strongAntiCount: number;
}

/**
 * Base fields shared by all resolution strategies.
 * phaseAfterArgumentation drives the state machine branch after argumentation.
 * maxArgumentsPerSide, when set, enforces a per-side argument cap.
 */
interface BaseResolutionStrategy {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly type: 'voting' | 'arbiter';
  readonly phaseAfterArgumentation: 'VOTING' | 'ARBITER_REVIEW';
  readonly maxArgumentsPerSide?: number;
}

/**
 * Voting-based strategy: players cast votes and tokens are drawn to resolve.
 */
export interface VotingResolutionStrategy extends BaseResolutionStrategy {
  readonly type: 'voting';
  readonly phaseAfterArgumentation: 'VOTING';
  mapVoteToTokens(voteType: 'LIKELY_SUCCESS' | 'LIKELY_FAILURE' | 'UNCERTAIN'): VoteTokenMapping;
  resolve(votes: ResolutionVotes): ResolutionResult;
}

/**
 * Arbiter-based strategy: a designated arbiter marks strong arguments,
 * a 2d6 roll is modified by strong argument counts to determine the result.
 */
export interface ArbiterResolutionStrategy extends BaseResolutionStrategy {
  readonly type: 'arbiter';
  readonly phaseAfterArgumentation: 'ARBITER_REVIEW';
  resolve(context: ArbiterResolutionContext): ResolutionResult;
}

/** Discriminated union of all supported resolution strategies */
export type ResolutionStrategy = VotingResolutionStrategy | ArbiterResolutionStrategy;
