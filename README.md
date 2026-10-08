# AI Calling System: Enterprise Multi-Tenant Voice & SMS Platform

An enterprise-grade, multi-tenant voice calling and SMS automation platform built with **Next.js 16 (App Router)**, **TypeScript**, **Prisma 7**, **PostgreSQL**, **Vapi**, **Twilio**, **Google Calendar**, **JotForm**, and **OpenAI**.

This application completely replaces and modernizes the legacy Make.com scenario exports (`make.com/*.json`) with high-throughput, idempotent, duplicate-safe code running with deterministic timezone handling and an internal operational dashboard.

---

## 1. System Architecture & Multi-Tenancy

The platform provides isolated multi-tenant routing, database persistence, and external service credentials for two distinct businesses:

```
                            ┌────────────────────────┐
                            │    Vapi Voice Engine   │
                            └───────────┬────────────┘
                                        │ Webhook & Tool Calls
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Next.js App Router API                             │
│                                                                              │
│  /api/webhooks/vapi/tools/client-vip           (Allowlist & VIP caller check)│
│  /api/webhooks/vapi/tools/calendar-availability(Google Calendar FreeBusy check)│
│  /api/webhooks/vapi/patient-intake             (Cabinet Michelle End-of-Call)│
│  /api/webhooks/vapi/dani-batiment              (Dani Bâtiment End-of-Call)   │
│  /api/webhooks/twilio/inbound-sms              (Twilio SMS 2-way replies)    │
│  /api/webhooks/jotform/submission              (JotForm CRM enrichment)      │
└───────────────┬──────────────────────────────────────────────┬───────────────┘
                │                                              │
                ▼                                              ▼
┌───────────────────────────────┐              ┌───────────────────────────────┐
│  Tenant 1: Cabinet Michelle   │              │   Tenant 2: Dani Bâtiment     │
│  - Home Nursing & Healthcare  │              │   - Construction Contractor   │
│  - Assistant: 97808c43-...    │              │   - Assistant: 38a56410-...   │
│  - Inbound SMS: +33939033663  │              │   - Outbound SMS: +33939036462│
│  - Nurse Alert: +33612857915  │              │   - Staff Alert: +33612857915 │
│  - Calendar: monaldi2b@...    │              │   - Form: JotForm Devis       │
└───────────────────────────────┘              └───────────────────────────────┘
                │                                              │
                └───────────────────────┬──────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PostgreSQL 15+ via Prisma 7 Driver Adapter                │
│  (Business, AssistantConfig, Contact, Patient, Appointment, ServiceRequest,  │
│   CallerAllowlist, CallRecord, WebhookEvent, NotificationJob)                │
└───────────────────────────────────────┬──────────────────────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                   Durable Background Notification Retry Worker               │
│                   npm run worker (Exponential Backoff Retries)               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Make.com Workflow Replacements

All six original Make.com scenarios have been fully analyzed and re-architected into modular TypeScript services:

| Scenario | Original Make.com File | Next.js API Route | Service Class | Primary Functions |
|---|---|---|---|---|
| **A** | `Client_VIP.json` | `POST /api/webhooks/vapi/tools/client-vip` | `CallerLookupService` | Allowlist/VIP phone check, returning client history, new client detection. |
| **B** | `integration-webhooks-google-calendar.json` | `POST /api/webhooks/vapi/tools/calendar-availability` | `CalendarAvailabilityService` | FreeBusy slot verification in `Europe/Paris` DST timezone. |
| **C** | `patient-info.json` | `POST /api/webhooks/vapi/patient-intake` | `PatientIntakeService` | End-of-call report processing, mobile vs landline routing, urgent nurse alerts, cancellation handling. |
| **D** | `confirmation_de_rdv.json` | `POST /api/webhooks/twilio/inbound-sms` | `AppointmentConfirmationService` | Inbound SMS parser (OUI/NON/AUTRE), calendar event booking, instant TwiML `<Response/>`. |
| **E** | `links-v3-vapi-crm-sms-dani-batiment.json` | `POST /api/webhooks/vapi/dani-batiment` | `ServiceRequestsService` | Quote ("Devis") request creation, SMS dispatch with dynamic JotForm call ID link, "Suivi" routing. |
| **F** | `integration-google-forms-v2-jotform-crm-by-call-id.json` | `POST /api/webhooks/jotform/submission` | `JotformIntakeService` | Form submission webhook, CRM contact enrichment (address, email), status updated to `COMPLETED`. |

---

## 3. Key Technical & Reliability Features

1. **Deterministic Timezone Handling**: All dates and hours are parsed strictly in the `Europe/Paris` timezone using Luxon, correctly managing French Daylight Saving Time (CET UTC+1 vs CEST UTC+2). Fixes the Make.com bug where summer time subtracted 1 hour instead of adding.
2. **E.164 Phone Normalization**: Normalizes French local (`06...`), international (`+33...`), raw digits, and whitespace-delimited inputs into valid E.164 standards.
3. **Twilio Webhook Non-Blocking TwiML**: Inbound SMS webhooks respond immediately with `<Response/>` XML to prevent Twilio HTTP 15003 timeout retries while asynchronously executing business logic.
4. **Webhook Idempotency & Deduplication**:
   - `WebhookEvent` table tracks incoming event IDs and payload hashes.
   - Prevents duplicate appointment confirmations and duplicate service requests.
   - Deduplicates identical outbound SMS notifications within a 5-minute sliding window.
5. **Durable Retry Worker with Exponential Backoff**: Outbound notifications that fail due to rate limits or network issues are recorded in `NotificationJob` and retried up to 5 times (`10s`, `30s`, `2m`, `10m`, `30m`).
6. **Lookup v2 Line Type Intelligence**: Detects mobile vs landline to prevent sending SMS to landline numbers.
7. **Production Operational Dashboard**: Real-time KPI counters, appointment list, service request CRM, call records, webhook audit trail, and notification retry job monitoring at `/dashboard`.

---

## 4. Prerequisites & Installation

### Prerequisites
- Node.js 20.x or higher
- PostgreSQL 15.x or higher
- npm 10.x or higher

### Installation
```bash
# Clone the repository and checkout the rewrite branch
git clone https://github.com/HassenBenHadjHassen/AI-Calling-System.git
cd AI-Calling-System
git checkout nextjs-rewrite

# Install dependencies using npm
npm install
```

### Environment Configuration
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

| Variable | Description | Default / Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/ai_calling?schema=public` |
| `NEXT_PUBLIC_APP_URL` | Base application URL | `http://localhost:3000` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | `AC...` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | `...` |
| `TWILIO_PHONE_NUMBER` | Fallback outbound SMS number | `+33900000001` |
| `CABINET_INBOUND_PHONE` | Cabinet Michelle inbound SMS phone | `+33900000001` |
| `BATIMENT_OUTBOUND_PHONE`| Dani Bâtiment outbound SMS phone | `+33900000002` |
| `NURSE_ALERT_PHONE_NUMBER`| Internal nurse mobile phone for alerts | `+33600000001` |
| `BATIMENT_ALERT_PHONE_NUMBER`| Internal staff mobile phone for alerts | `+33600000002` |
| `CABINET_CALENDAR_ID` | Google Calendar email for Michelle | `cabinet@example.com` |
| `GOOGLE_CALENDAR_CREDENTIALS`| Google Service Account JSON | `{"type": "service_account", ...}` |
| `OPENAI_API_KEY` | OpenAI API key for SMS intent classifier | `sk-...` |
| `JOTFORM_FORM_URL` | Dani Bâtiment JotForm URL | `https://form.jotform.com/000000000000000?callId={callId}` |
| `DRY_RUN` | Set to `true` to mock Twilio & Google APIs | `true` |

### Database Setup & Seeding
```bash
# Generate Prisma Client (Prisma 7)
npm run db:generate

# Run initial migrations
npx prisma migrate deploy

# Seed initial tenants, assistant configurations, and allowlists
npm run db:seed
```

---

## 5. Running the Application

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard) to view the operational dashboard.

### Durable Background Retry Worker
In a separate terminal or supervisor process:
```bash
npm run worker
```

### Production Build
```bash
npm run build
npm start
```

### Quality Assurance & Tests
```bash
# Run unit & integration test suite (44 tests)
npm test

# Run TypeScript typechecker
npm run typecheck

# Run ESLint
npm run lint

# Validate Prisma schema
npm run db:validate
```

---

## 6. API Endpoint Catalog

### 1. `POST /api/webhooks/vapi/tools/client-vip`
- **Caller**: Vapi Voice Assistant (Tool Call)
- **Purpose**: Checks if incoming caller is on the whitelist, is an existing customer, or is a new customer.
- **Request Body (Example)**:
  ```json
  {
    "message": {
      "type": "tool-calls",
      "assistant": { "id": "97808c43-384a-4f40-a8dd-9149ba4988f5" },
      "toolCalls": [
        {
          "id": "call_12345",
          "function": {
            "name": "check_client_vip",
            "arguments": { "caller": "+33612857915" }
          }
        }
      ]
    }
  }
  ```
- **Response**: HTTP 200 with Vapi tool response format:
  ```json
  {
    "results": [
      {
        "toolCallId": "call_12345",
        "result": " NUMERO EST UN liste blanche / whitelist, DONC TRASNFERT LAPPEL VERS LE LINFIRMIERE "
      }
    ]
  }
  ```

### 2. `POST /api/webhooks/vapi/tools/calendar-availability`
- **Caller**: Vapi Voice Assistant (Tool Call)
- **Purpose**: Verifies whether a requested date and time slot is free on Google Calendar.
- **Request Body (Example)**:
  ```json
  {
    "message": {
      "type": "tool-calls",
      "toolCalls": [
        {
          "id": "cal_check_99",
          "function": {
            "name": "check_calendar_availability",
            "arguments": { "date": "15/10/2026", "time": "14:30" }
          }
        }
      ]
    }
  }
  ```
- **Response**:
  ```json
  {
    "results": [
      {
        "toolCallId": "cal_check_99",
        "result": {
          "available": true,
          "requestedSlot": "2026-10-15T14:30:00+02:00",
          "message": "Créneau disponible."
        }
      }
    ]
  }
  ```

### 3. `POST /api/webhooks/vapi/patient-intake`
- **Caller**: Vapi Server URL (`end-of-call-report`)
- **Purpose**: Ingests Cabinet Michelle patient calls, extracts structured outputs, determines phone line type, triggers nurse alert SMS for urgent cases, and initiates patient confirmation flow.

### 4. `POST /api/webhooks/twilio/inbound-sms`
- **Caller**: Twilio Inbound Webhook (`HTTP POST`)
- **Purpose**: Processes patient replies (`OUI`, `NON`, `AUTRE`). On `OUI`, automatically creates Google Calendar event on `monaldi2b@gmail.com` and marks appointment `CONFIRMED`.
- **Response**: Immediate `text/xml` containing `<Response/>`.

### 5. `POST /api/webhooks/vapi/dani-batiment`
- **Caller**: Vapi Server URL (`end-of-call-report`)
- **Purpose**: Ingests Dani Bâtiment calls, distinguishes "Devis" (quote) vs "Suivi" (status inquiry), creates service request, and sends SMS with dynamic JotForm link (`?callId={callId}`).

### 6. `POST /api/webhooks/jotform/submission`
- **Caller**: JotForm Webhook
- **Purpose**: Enriches service request by `callId` with submitted client address, email, and details, marking request `COMPLETED` and alerting staff.

---

## 7. Migration & Cutover Guide

For detailed step-by-step instructions on switching traffic from Make.com to this service, secret provisioning, smoke testing, and decommissioning Make.com, refer to:
- [docs/cutover-checklist.md](docs/cutover-checklist.md)
- [docs/workflow-mapping.md](docs/workflow-mapping.md)

---

## 8. License & Confidentiality

Internal business automation system for **Cabinet Michelle** and **Dani Bâtiment**. All rights reserved.
