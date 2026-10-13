-- AlterTable
ALTER TABLE "notification_jobs" ADD COLUMN "lockedAt" TIMESTAMP(3);
ALTER TABLE "notification_jobs" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
ALTER TABLE "notification_jobs" ADD COLUMN "lockedBy" TEXT;

-- CreateIndex
CREATE INDEX "notification_jobs_status_leaseExpiresAt_idx" ON "notification_jobs"("status", "leaseExpiresAt");
