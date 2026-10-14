-- CreateEnum
CREATE TYPE "RoutingAction" AS ENUM ('DIRECT', 'BLOCK');

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN "priorityTransferNumber" TEXT;
ALTER TABLE "businesses" ADD COLUMN "routingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "caller_routing_rules" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "action" "RoutingAction" NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caller_routing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "caller_routing_rules_businessId_phoneNumber_key" ON "caller_routing_rules"("businessId", "phoneNumber");

-- CreateIndex
CREATE INDEX "caller_routing_rules_phoneNumber_idx" ON "caller_routing_rules"("phoneNumber");

-- CreateIndex
CREATE INDEX "caller_routing_rules_businessId_active_idx" ON "caller_routing_rules"("businessId", "active");

-- AddForeignKey
ALTER TABLE "caller_routing_rules" ADD CONSTRAINT "caller_routing_rules_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
