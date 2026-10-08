import { NotificationService } from '../lib/services/notifications.service';
import { db } from '../lib/db';

const POLL_INTERVAL_MS = 5000;
let isRunning = true;

async function startWorker() {
  console.log('🚀 AI Calling System - Background Notification Worker started');
  console.log(`⏱️ Polling database every ${POLL_INTERVAL_MS}ms for pending/retryable jobs...`);

  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down worker gracefully...`);
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
        console.log(`[Worker] Processed ${processedCount} notification job(s)`);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Worker Error]:', errMsg);
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

if (require.main === module || process.argv[1]?.includes('worker')) {
  startWorker().catch((err) => {
    console.error('Fatal worker error:', err);
    process.exit(1);
  });
}
