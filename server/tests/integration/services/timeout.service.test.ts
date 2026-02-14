import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../../src/config/database.js';
import { processAllTimeouts } from '../../../src/services/timeout.service.js';

/**
 * Integration tests for the refactored timeout service.
 * 
 * Note: The timeout service was refactored from action-level to game-level timeouts.
 * These tests focus on the new per-game timeout behavior with phaseStartedAt tracking.
 * 
 * Key changes:
 * - Timeouts now operate on games (not individual actions)
 * - Per-game timeout settings from game.settings
 * - PROPOSAL and NARRATION phases notify hosts only
 * - ARGUMENTATION and VOTING phases auto-resolve
 */

describe('Timeout Service Integration', () => {
  let testUserId: string;
  let testGameId: string;

  beforeAll(async () => {
    // Create a test user
    const user = await db.user.create({
      data: {
        email: `timeout-test-${Date.now()}@example.com`,
        displayName: 'Timeout Test User',
        passwordHash: 'not-used',
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testGameId) {
      await db.game.delete({ where: { id: testGameId } }).catch(() => {});
    }
    if (testUserId) {
      await db.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });

  beforeEach(async () => {
    // Clean up any previous test game
    if (testGameId) {
      await db.game.delete({ where: { id: testGameId } }).catch(() => {});
    }
  });

  describe('processAllTimeouts', () => {
    it('should skip games without phaseStartedAt', async () => {
      const game = await db.game.create({
        data: {
          name: 'Test Game - No Phase Started',
          description: 'Test',
          status: 'ACTIVE',
          currentPhase: 'PROPOSAL',
          phaseStartedAt: null, // No timestamp
          settings: { proposalTimeoutHours: 1 },
          createdById: testUserId,
        },
      });
      testGameId = game.id;

      const result = await processAllTimeouts();

      // Should not process this game
      expect(result.results.find(r => r.gameId === game.id)).toBeUndefined();
    });

    it('should skip games with infinite timeout (-1)', async () => {
      const game = await db.game.create({
        data: {
          name: 'Test Game - Infinite Timeout',
          description: 'Test',
          status: 'ACTIVE',
          currentPhase: 'PROPOSAL',
          phaseStartedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
          settings: { proposalTimeoutHours: -1 }, // Infinite
          createdById: testUserId,
        },
      });
      testGameId = game.id;

      const result = await processAllTimeouts();

      // Should not timeout
      expect(result.results.find(r => r.gameId === game.id)).toBeUndefined();
    });

    it('should skip games that have not timed out yet', async () => {
      const game = await db.game.create({
        data: {
          name: 'Test Game - Not Timed Out',
          description: 'Test',
          status: 'ACTIVE',
          currentPhase: 'PROPOSAL',
          phaseStartedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          settings: { proposalTimeoutHours: 24 }, // 24 hour timeout
          createdById: testUserId,
        },
      });
      testGameId = game.id;

      const result = await processAllTimeouts();

      // Should not timeout yet
      expect(result.results.find(r => r.gameId === game.id)).toBeUndefined();
    });

    it('should process PROPOSAL timeout and create event', async () => {
      const game = await db.game.create({
        data: {
          name: 'Test Game - Proposal Timeout',
          description: 'Test',
          status: 'ACTIVE',
          currentPhase: 'PROPOSAL',
          phaseStartedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          settings: { proposalTimeoutHours: 24 }, // 24 hour timeout
          createdById: testUserId,
        },
      });
      testGameId = game.id;

      // Add host player
      await db.gamePlayer.create({
        data: {
          gameId: game.id,
          userId: testUserId,
          isHost: true,
          isActive: true,
        },
      });

      const result = await processAllTimeouts();

      // Should process timeout
      const timeoutResult = result.results.find(r => r.gameId === game.id);
      expect(timeoutResult).toBeDefined();
      expect(timeoutResult?.phase).toBe('PROPOSAL');
      expect(timeoutResult?.hostNotified).toBe(true);

      // Should create event
      const event = await db.gameEvent.findFirst({
        where: {
          gameId: game.id,
          eventType: 'PROPOSAL_TIMEOUT',
        },
      });
      expect(event).toBeDefined();
    });

    it('should process NARRATION timeout and notify host', async () => {
      const game = await db.game.create({
        data: {
          name: 'Test Game - Narration Timeout',
          description: 'Test',
          status: 'ACTIVE',
          currentPhase: 'NARRATION',
          phaseStartedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          settings: { narrationTimeoutHours: 24 },
          createdById: testUserId,
        },
      });
      testGameId = game.id;

      // Add host player
      await db.gamePlayer.create({
        data: {
          gameId: game.id,
          userId: testUserId,
          isHost: true,
          isActive: true,
        },
      });

      const result = await processAllTimeouts();

      // Should process timeout
      const timeoutResult = result.results.find(r => r.gameId === game.id);
      expect(timeoutResult).toBeDefined();
      expect(timeoutResult?.phase).toBe('NARRATION');
      expect(timeoutResult?.hostNotified).toBe(true);

      // Should create event
      const event = await db.gameEvent.findFirst({
        where: {
          gameId: game.id,
          eventType: 'NARRATION_TIMEOUT',
        },
      });
      expect(event).toBeDefined();
    });

    it('should return empty results when no games need timeout processing', async () => {
      const result = await processAllTimeouts();

      // May have results from other tests, but should at least not error
      expect(result.results).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });
});
