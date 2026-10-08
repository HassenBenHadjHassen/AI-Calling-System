-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('HEALTHCARE', 'BUILDING_SERVICES');

-- CreateEnum
CREATE TYPE "WorkflowType" AS ENUM ('PATIENT_CARE', 'BUILDING_SERVICES');

-- CreateEnum
CREATE TYPE "LineType" AS ENUM ('MOBILE', 'LANDLINE', 'VOIP', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'PENDING_LANDLINE', 'CONFIRMED', 'CONFIRMED_URGENT', 'REFUSED', 'CANCELLED', 'RESCHEDULE_PROPOSED', 'SCAM');

-- CreateEnum
CREATE TYPE "ServiceRequestCategory" AS ENUM ('DEVIS', 'ANNULATION', 'SUIVI', 'INTERVENTION', 'MESSAGE', 'GENERAL');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('NOT_COMPLETED', 'COMPLETED', 'MESSAGE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('VAPI', 'TWILIO', 'JOTFORM');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'EMAIL', 'INTERNAL_ALERT');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessType" "BusinessType" NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "inboundPhoneNumber" TEXT,
    "outboundPhoneNumber" TEXT,
    "alertPhoneNumber" TEXT,
    "calendarId" TEXT,
    "formUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_configs" (
    "id" TEXT NOT NULL,
    "assistantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workflowType" "WorkflowType" NOT NULL,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "lineType" "LineType" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "medicalNotes" TEXT,
    "isAllowlisted" BOOLEAN NOT NULL DEFAULT false,
    "lastScamScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_records" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "vapiCallId" TEXT NOT NULL,
    "assistantId" TEXT NOT NULL,
    "contactId" TEXT,
    "callerNumber" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "status" TEXT,
    "summary" TEXT,
    "structuredData" JSONB,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "patientId" TEXT,
    "callRecordId" TEXT,
    "serviceType" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "urgency" BOOLEAN NOT NULL DEFAULT false,
    "scamScore" DOUBLE PRECISION,
    "googleCalendarEventId" TEXT,
    "proposedNewTime" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "callRecordId" TEXT,
    "vapiCallId" TEXT NOT NULL,
    "category" "ServiceRequestCategory" NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'NOT_COMPLETED',
    "serviceType" TEXT,
    "message" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "email" TEXT,
    "formSubmissionData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caller_allowlists" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caller_allowlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "provider" "WebhookProvider" NOT NULL,
    "eventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB,
    "error" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_jobs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'SMS',
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "businesses_slug_key" ON "businesses"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "assistant_configs_assistantId_key" ON "assistant_configs"("assistantId");

-- CreateIndex
CREATE INDEX "assistant_configs_assistantId_idx" ON "assistant_configs"("assistantId");

-- CreateIndex
CREATE INDEX "assistant_configs_businessId_idx" ON "assistant_configs"("businessId");

-- CreateIndex
CREATE INDEX "contacts_phoneNumber_idx" ON "contacts"("phoneNumber");

-- CreateIndex
CREATE INDEX "contacts_businessId_idx" ON "contacts"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_businessId_phoneNumber_key" ON "contacts"("businessId", "phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "patients_contactId_key" ON "patients"("contactId");

-- CreateIndex
CREATE INDEX "patients_businessId_idx" ON "patients"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "call_records_vapiCallId_key" ON "call_records"("vapiCallId");

-- CreateIndex
CREATE INDEX "call_records_vapiCallId_idx" ON "call_records"("vapiCallId");

-- CreateIndex
CREATE INDEX "call_records_callerNumber_idx" ON "call_records"("callerNumber");

-- CreateIndex
CREATE INDEX "call_records_businessId_idx" ON "call_records"("businessId");

-- CreateIndex
CREATE INDEX "appointments_businessId_status_idx" ON "appointments"("businessId", "status");

-- CreateIndex
CREATE INDEX "appointments_businessId_date_idx" ON "appointments"("businessId", "date");

-- CreateIndex
CREATE INDEX "service_requests_vapiCallId_idx" ON "service_requests"("vapiCallId");

-- CreateIndex
CREATE INDEX "service_requests_businessId_status_idx" ON "service_requests"("businessId", "status");

-- CreateIndex
CREATE INDEX "caller_allowlists_phoneNumber_idx" ON "caller_allowlists"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "caller_allowlists_businessId_phoneNumber_key" ON "caller_allowlists"("businessId", "phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_eventKey_key" ON "webhook_events"("eventKey");

-- CreateIndex
CREATE INDEX "webhook_events_eventKey_idx" ON "webhook_events"("eventKey");

-- CreateIndex
CREATE INDEX "webhook_events_provider_status_idx" ON "webhook_events"("provider", "status");

-- CreateIndex
CREATE INDEX "notification_jobs_status_nextRetryAt_idx" ON "notification_jobs"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "notification_jobs_businessId_idx" ON "notification_jobs"("businessId");

-- AddForeignKey
ALTER TABLE "assistant_configs" ADD CONSTRAINT "assistant_configs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_callRecordId_fkey" FOREIGN KEY ("callRecordId") REFERENCES "call_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_callRecordId_fkey" FOREIGN KEY ("callRecordId") REFERENCES "call_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caller_allowlists" ADD CONSTRAINT "caller_allowlists_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
