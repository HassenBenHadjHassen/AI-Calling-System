-- CreateEnum
CREATE TYPE "PatientRequestType" AS ENUM ('APPOINTMENT', 'CANCELLATION', 'MESSAGE');

-- CreateEnum
CREATE TYPE "PatientRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "patient_requests" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "vapiCallId" TEXT NOT NULL,
    "callerNumber" TEXT NOT NULL,
    "patientName" TEXT,
    "requestType" "PatientRequestType" NOT NULL,
    "postalCode" TEXT,
    "serviceType" TEXT,
    "requestedDate" TEXT,
    "requestedTime" TEXT,
    "summary" TEXT,
    "urgency" BOOLEAN NOT NULL DEFAULT false,
    "status" "PatientRequestStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "contactId" TEXT,
    "callRecordId" TEXT,
    "appointmentId" TEXT,
    "serviceRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_requests_vapiCallId_idx" ON "patient_requests"("vapiCallId");

-- CreateIndex
CREATE INDEX "patient_requests_businessId_status_idx" ON "patient_requests"("businessId", "status");

-- CreateIndex
CREATE INDEX "patient_requests_callerNumber_idx" ON "patient_requests"("callerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "patient_requests_vapiCallId_requestType_key" ON "patient_requests"("vapiCallId", "requestType");

-- AddForeignKey
ALTER TABLE "patient_requests" ADD CONSTRAINT "patient_requests_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_requests" ADD CONSTRAINT "patient_requests_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_requests" ADD CONSTRAINT "patient_requests_callRecordId_fkey" FOREIGN KEY ("callRecordId") REFERENCES "call_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_requests" ADD CONSTRAINT "patient_requests_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_requests" ADD CONSTRAINT "patient_requests_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
