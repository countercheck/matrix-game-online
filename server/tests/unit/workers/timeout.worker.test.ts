import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the timeout service
vi.mock('../../../src/services/timeout.service.js', () => ({
  processAllTimeouts: vi.fn(),
}));

// Mock the logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  runTimeoutCheck,
  startTimeoutWorker,
  stopTimeoutWorker,
  isTimeoutWorkerRunning,
} from '../../../src/workers/timeout.worker.js';
import { processAllTimeouts } from '../../../src/services/timeout.service.js';
import { logger } from '../../../src/utils/logger.js';

describe('Timeout Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stopTimeoutWorker(); // Ensure worker is stopped before each test
  });

  afterEach(() => {
    stopTimeoutWorker();
  });

  describe('runTimeoutCheck', () => {
    it('should call processAllTimeouts', async () => {
      vi.mocked(processAllTimeouts).mockResolvedValue({
        results: [],
        errors: [],
      });

      await runTimeoutCheck();

      expect(processAllTimeouts).toHaveBeenCalled();
    });

    it('should log when timeouts are processed', async () => {
      vi.mocked(processAllTimeouts).mockResolvedValue({
        results: [
          { actionId: 'a1', gameId: 'g1', phase: 'ARGUMENTATION', playersAffected: 2 },
          { gameId: 'g2', phase: 'PROPOSAL', playersAffected: 0, hostNotified: true },
        ],
        errors: [],
      });

      await runTimeoutCheck();

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('processed 2 timeouts'));
    });

    it('should log warning when there are errors', async () => {
      vi.mocked(processAllTimeouts).mockResolvedValue({
        results: [],
        errors: [{ gameId: 'g1', error: 'test error' }],
      });

      await runTimeoutCheck();

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('1 errors'));
    });

    it('should handle processAllTimeouts errors gracefully', async () => {
      vi.mocked(processAllTimeouts).mockRejectedValue(new Error('Database error'));

      await runTimeoutCheck();

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Database error'));
    });

    it('should not run concurrently (skip if already running)', async () => {
      let resolveFirst: () => void;
      const firstCallPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      vi.mocked(processAllTimeouts)
        .mockImplementationOnce(async () => {
          await firstCallPromise;
          return { results: [], errors: [] };
        })
        .mockResolvedValue({
          results: [],
          errors: [],
        });

      // Start first call (will hang until we resolve)
      const first = runTimeoutCheck();

      // Try to start second call immediately
      await runTimeoutCheck();

      // Should have been skipped - only 1 call
      expect(processAllTimeouts).toHaveBeenCalledTimes(1);

      // Now resolve and complete
      resolveFirst!();
      await first;
    });
  });

  describe('startTimeoutWorker', () => {
    it('should start the worker and set running state', () => {
      vi.mocked(processAllTimeouts).mockResolvedValue({
        results: [],
        errors: [],
      });

      startTimeoutWorker();

      expect(isTimeoutWorkerRunning()).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Starting timeout worker'));
    });

    it('should warn if worker already running', () => {
      vi.mocked(processAllTimeouts).mockResolvedValue({
        results: [],
        errors: [],
      });

      startTimeoutWorker();
      startTimeoutWorker(); // Try to start again

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('already running'));
    });

    it('should use default interval if not specified', () => {
      vi.mocked(processAllTimeouts).mockResolvedValue({
        results: [],
        errors: [],
      });

      startTimeoutWorker();

      // Default is 5 minutes (300000ms = 300s)
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('300s interval'));
    });

    it('should use custom interval if specified', () => {
      vi.mocked(processAllTimeouts).mockResolvedValue({
        results: [],
        errors: [],
      });

      startTimeoutWorker({ intervalMs: 60000 }); // 1 minute

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('60s interval'));
    });
  });

  describe('stopTimeoutWorker', () => {
    it('should stop the worker and clear running state', () => {
      vi.mocked(processAllTimeouts).mockResolvedValue({
        results: [],
        errors: [],
      });

      startTimeoutWorker();
      expect(isTimeoutWorkerRunning()).toBe(true);

      stopTimeoutWorker();
      expect(isTimeoutWorkerRunning()).toBe(false);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Stopping timeout worker'));
    });

    it('should handle stop when not running (no-op)', () => {
      stopTimeoutWorker();
      // Should not throw or log stopping message
      expect(isTimeoutWorkerRunning()).toBe(false);
      expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Stopping'));
    });
  });

  describe('isTimeoutWorkerRunning', () => {
    it('should return false when not started', () => {
      expect(isTimeoutWorkerRunning()).toBe(false);
    });

    it('should return true when running', () => {
      vi.mocked(processAllTimeouts).mockResolvedValue({
        results: [],
        errors: [],
      });

      startTimeoutWorker();
      expect(isTimeoutWorkerRunning()).toBe(true);
    });

    it('should return false after stopped', () => {
      vi.mocked(processAllTimeouts).mockResolvedValue({
        results: [],
        errors: [],
      });

      startTimeoutWorker();
      stopTimeoutWorker();
      expect(isTimeoutWorkerRunning()).toBe(false);
    });
  });
});
