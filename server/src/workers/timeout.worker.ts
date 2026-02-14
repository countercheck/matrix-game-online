import { processAllTimeouts, type TimeoutConfig } from '../services/timeout.service.js';
import { logger } from '../utils/logger.js';

// Default interval: check every 5 minutes
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

export interface TimeoutWorkerOptions {
  intervalMs?: number;
  timeoutConfig?: TimeoutConfig;
}

/**
 * Run a single timeout check cycle.
 * Can be called manually or by the scheduler.
 */
export async function runTimeoutCheck(config?: TimeoutConfig): Promise<void> {
  if (isRunning) {
    logger.debug('Timeout check already in progress, skipping');
    return;
  }

  isRunning = true;
  try {
    logger.debug('Running timeout check...');
    const results = await processAllTimeouts(config);

    if (results.errors.length > 0) {
      logger.warn(`Timeout check completed with ${results.errors.length} errors`);
    }

    if (results.argumentationTimeouts.length > 0 || results.votingTimeouts.length > 0) {
      logger.info(
        `Timeout check: processed ${results.argumentationTimeouts.length} argumentation, ` +
          `${results.votingTimeouts.length} voting timeouts`
      );
    }
  } catch (error) {
    logger.error(`Timeout check failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the timeout worker to run periodically.
 */
export function startTimeoutWorker(options: TimeoutWorkerOptions = {}): void {
  if (intervalId) {
    logger.warn('Timeout worker is already running');
    return;
  }

  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

  logger.info(`Starting timeout worker with ${intervalMs / 1000}s interval`);

  // Run immediately on start
  runTimeoutCheck(options.timeoutConfig);

  // Then run at intervals
  intervalId = setInterval(() => {
    runTimeoutCheck(options.timeoutConfig);
  }, intervalMs);
}

/**
 * Stop the timeout worker.
 */
export function stopTimeoutWorker(): void {
  if (intervalId) {
    logger.info('Stopping timeout worker');
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Check if the timeout worker is currently running.
 */
export function isTimeoutWorkerRunning(): boolean {
  return intervalId !== null;
}
