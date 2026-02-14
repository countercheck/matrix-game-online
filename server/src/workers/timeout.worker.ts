import { processAllTimeouts } from '../services/timeout.service.js';
import { logger } from '../utils/logger.js';

// Default interval: check every 5 minutes
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

export interface TimeoutWorkerOptions {
  intervalMs?: number;
}

/**
 * Run a single timeout check cycle.
 * Can be called manually or by the scheduler.
 */
export async function runTimeoutCheck(): Promise<void> {
  if (isRunning) {
    logger.debug('Timeout check already in progress, skipping');
    return;
  }

  isRunning = true;
  try {
    logger.debug('Running timeout check...');
    const { results, errors } = await processAllTimeouts();

    if (errors.length > 0) {
      logger.warn(`Timeout check completed with ${errors.length} errors`);
    }

    if (results.length > 0) {
      logger.info(`Timeout check: processed ${results.length} timeouts`);
    }
  } catch (error) {
    logger.error(
      `Timeout check failed: ${error instanceof Error ? error.message : String(error)}`
    );
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
  runTimeoutCheck();

  // Then run at intervals
  intervalId = setInterval(() => {
    runTimeoutCheck();
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
