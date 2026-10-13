import { NotificationService } from '../lib/services/notifications.service';
import { db } from '../lib/db';
import { logger, Logger } from '../lib/logger';

const POLL_INTERVAL_MS = 5000;
const LOG_PRUNE_INTERVAL_MS = 60 * 60 * 1000; // Prune old logs once per hour
let lastLogPrune = 0;
let isRunning = true;

async function startWorker() {
  const log = logger.child({ module: 'WORKER:Notifications' });
  log.info('🚀 AI Calling System - Background Notification Worker started');
  log.info(`⏱️ Polling database every ${POLL_INTERVAL_MS}ms for pending/retryable jobs...`);

  const shutdown = async (signal: string) => {
    log.info(`🛑 Received ${signal}. Shutting down worker gracefully...`);
    isRunning = false;
    await db.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  while (isRunning) {
    try {
      const processedCount = await NotificationService.processPendingJobs(20);
      if (processedCount > 0) {
        log.info(`[Worker Cycle] Processed ${processedCount} notification job(s)`);
      }
    } catch (err: unknown) {
      log.error('[Worker Cycle Error]', { error: err });
    }

    // Periodic safe maintenance: Prune historical system logs
    if (Date.now() - lastLogPrune > LOG_PRUNE_INTERVAL_MS) {
      try {
        const pruned = await Logger.pruneDatabaseLogs();
        if (pruned > 0) {
          log.info(`[Worker Maintenance] Safely pruned ${pruned} historical system log entries`);
        }
        lastLogPrune = Date.now();
      } catch (pruneErr) {
        log.error('[Worker Maintenance Error]', { error: pruneErr });
      }
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

if (require.main === module || process.argv[1]?.includes('worker')) {
  startWorker().catch((err) => {
    logger.error('Fatal worker process error', { module: 'WORKER', error: err });
    process.exit(1);
  });
}
