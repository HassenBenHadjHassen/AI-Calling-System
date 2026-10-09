# Production Cutover & Migration Checklist: Make.com to Next.js

This checklist defines the operational procedure for migrating production traffic from the legacy Make.com scenarios to the new Next.js unified AI Calling System.

---

## 1. Pre-Cutover Preparation

### 1.1 Infrastructure & Database
- [ ] Provision a production PostgreSQL database (v15+ recommended, e.g. Neon, Supabase, AWS RDS, or Railway).
- [ ] Deploy Prisma migrations against the production database:
  ```bash
  npx prisma migrate deploy
  ```
  *(Tenants and assistant configurations are automatically bootstrapped on-the-fly from `.env` upon initial service boot or incoming requests - no manual seeding script required).*

### 1.2 Environment Variables & Secrets
Ensure all production secrets are populated in the deployment environment:
- [ ] `DATABASE_URL`: Production PostgreSQL connection string with SSL enabled if hosted.
- [ ] `NEXT_PUBLIC_APP_URL`: Canonical public HTTPS URL of the deployed Next.js service (e.g. `https://calling.yourdomain.com`).
- [ ] `TWILIO_ACCOUNT_SID`: Production Twilio Account SID.
- [ ] `TWILIO_AUTH_TOKEN`: Production Twilio Auth Token (used for API calls and webhook signature validation).
- [ ] `TWILIO_PHONE_NUMBER`: Main fallback SMS sender number in E.164 format.
- [ ] `CABINET_INBOUND_PHONE`: Inbound patient phone number (`+33939033663`).
- [ ] `BATIMENT_OUTBOUND_PHONE`: Dani Bâtiment outbound sender number (`+33939036462`).
- [ ] `NURSE_ALERT_PHONE_NUMBER`: Alert mobile phone number for nurse notifications (`+33612857915`).
- [ ] `BATIMENT_ALERT_PHONE_NUMBER`: Alert mobile phone number for building staff (`+33612857915`).
- [ ] `CABINET_CALENDAR_ID`: Google Calendar email ID for nursing appointments (`monaldi2b@gmail.com`).
- [ ] `GOOGLE_CALENDAR_CREDENTIALS`: Service Account JSON credentials string (or path) authorized with calendar read/write scopes.
- [ ] `OPENAI_API_KEY`: Production OpenAI API key (`gpt-4o-mini` classification fallback).
- [ ] `JOTFORM_FORM_URL`: Public JotForm URL (`https://form.jotform.com/260901590611047`).
- [ ] `JOTFORM_WEBHOOK_SECRET`: Secret header or query param configured in JotForm webhook settings.
- [ ] `DRY_RUN`: Set to `false` in production.

---

## 2. Background Retry Worker Deployment

The system contains an asynchronous worker that processes deferred notification retries with exponential backoff.

- [ ] Deploy the worker process alongside the Next.js web application using a process supervisor (PM2, systemd, or container):
  ```bash
  npm run worker
  ```
  *Example PM2 configuration:*
  ```json
  {
    "apps": [
      {
        "name": "calling-web",
        "script": "npm",
        "args": "start"
      },
      {
        "name": "calling-worker",
        "script": "npm",
        "args": "run worker"
      }
    ]
  }
  ```
- [ ] Verify worker starts cleanly and polls without errors.

---

## 3. Webhook Endpoint Reconfiguration

Execute the following configuration changes in the respective third-party dashboards.

### 3.1 Vapi Dashboard Configuration
Navigate to the [Vapi Dashboard](https://dashboard.vapi.ai):

1. **Tool Definition 1: `check_client_vip`**
   - Locate the function tool attached to both assistants (`Cabinet Michelle` and `Dani Bâtiment`).
   - Change Server URL to:
     ```
     https://<YOUR_DOMAIN>/api/webhooks/vapi/tools/client-vip
     ```
   - Method: `POST`

2. **Tool Definition 2: `check_calendar_availability`**
   - Locate the function tool attached to `Cabinet Michelle` assistant.
   - Change Server URL to:
     ```
     https://<YOUR_DOMAIN>/api/webhooks/vapi/tools/calendar-availability
     ```
   - Method: `POST`

3. **Assistant 1: Cabinet Michelle (`97808c43-384a-4f40-a8dd-9149ba4988f5`)**
   - Under Assistant Settings -> **Server URL**, update to:
     ```
     https://<YOUR_DOMAIN>/api/webhooks/vapi/patient-intake
     ```
   - Ensure the server URL is configured for `end-of-call-report` messages.

4. **Assistant 2: Dani Bâtiment (`38a56410-a3b6-49d5-96f1-8cd572b3f81c`)**
   - Under Assistant Settings -> **Server URL**, update to:
     ```
     https://<YOUR_DOMAIN>/api/webhooks/vapi/dani-batiment
     ```
   - Ensure the server URL is configured for `end-of-call-report` messages.

---

### 3.2 Twilio Console Configuration
Navigate to the [Twilio Console](https://console.twilio.com):

1. Under **Phone Numbers** -> **Manage** -> **Active numbers**, select `+33939033663` (Cabinet Michelle Inbound/SMS):
2. Scroll to the **Messaging Configuration** section:
   - "A MESSAGE COMES IN": Select **Webhook**
   - URL: `https://<YOUR_DOMAIN>/api/webhooks/twilio/inbound-sms`
   - HTTP Method: `HTTP POST`
3. Save changes.

---

### 3.3 JotForm Dashboard Configuration
Navigate to the [JotForm Form Settings](https://www.jotform.com/build/260901590611047/settings):

1. Go to **Settings** -> **Integrations**.
2. Select **Webhooks**.
3. Add or update Webhook URL to:
   ```
   https://<YOUR_DOMAIN>/api/webhooks/jotform/submission
   ```
4. Complete integration and save.

---

## 4. Verification & Smoke Testing (Dry-Run / Live)

Run the following test scenarios to verify end-to-end functionality before shutting down Make.com:

### Smoke Test 1: Vapi Tool Call - VIP & Allowlist
- **Action**: Simulate a tool call to `/api/webhooks/vapi/tools/client-vip` with a known allowlisted number (`+33612857915`).
- **Expected Result**: HTTP 200 with result `" NUMERO EST UN liste blanche / whitelist, DONC TRASNFERT LAPPEL VERS LE LINFIRMIERE "`.
- **Action**: Simulate with an unknown number.
- **Expected Result**: HTTP 200 with result indicating new client status.

### Smoke Test 2: Vapi Tool Call - Calendar Availability
- **Action**: Simulate a tool call to `/api/webhooks/vapi/tools/calendar-availability` with `date: "15/10/2026"` and `time: "14:30"`.
- **Expected Result**: HTTP 200 with `available: true` or `available: false` based on Google Calendar schedule.

### Smoke Test 3: Cabinet Michelle Patient Call (End of Call)
- **Action**: Trigger an end-of-call report to `/api/webhooks/vapi/patient-intake` with an urgent mobile patient request.
- **Expected Result**:
  - `Contact`, `Patient`, `CallRecord`, and `Appointment` created in PostgreSQL.
  - Appointment marked as `CONFIRMED_URGENT`.
  - Confirmation SMS sent to patient mobile.
  - Urgent alert SMS sent to nurse mobile (`+33612857915`).
  - Webhook event recorded in `WebhookEvent` table.

### Smoke Test 4: Inbound SMS Confirmation Workflow
- **Action**: Send an inbound SMS "OUI" from the patient's mobile number to `+33939033663`.
- **Expected Result**:
  - System matches pending appointment.
  - Status transitions to `CONFIRMED`.
  - Google Calendar event created on `monaldi2b@gmail.com`.
  - Confirmation SMS sent back to patient.
  - Immediate TwiML `<Response/>` returned.

### Smoke Test 5: Dani Bâtiment Devis Request
- **Action**: Trigger an end-of-call report to `/api/webhooks/vapi/dani-batiment` with a quote request ("Devis").
- **Expected Result**:
  - `Contact`, `CallRecord`, and `ServiceRequest` created in PostgreSQL.
  - Request marked `NOT_COMPLETED`.
  - SMS sent to customer containing the dynamic JotForm link with `?callId=<call_id>`.

### Smoke Test 6: JotForm Submission & CRM Enrichment
- **Action**: Submit the JotForm with the test `callId`.
- **Expected Result**:
  - `ServiceRequest` status transitions to `COMPLETED`.
  - Contact address, postal code, and email enriched in database.
  - Staff alert SMS dispatched to `+33612857915`.

---

## 5. Make.com Scenario Decommissioning

Once all smoke tests succeed:

1. Log in to [Make.com](https://eu1.make.com/organization).
2. Deactivate the following 6 scenarios:
   - [ ] Scenario 1: `Client_VIP` (ID: `2262799`)
   - [ ] Scenario 2: `integration-webhooks-google-calendar` (ID: `2262334`)
   - [ ] Scenario 3: `patient-info` (ID: `2261623`)
   - [ ] Scenario 4: `confirmation_de_rdv` (ID: `2266854`)
   - [ ] Scenario 5: `links-v3-vapi-crm-sms-dani-batiment` (ID: `2262445`)
   - [ ] Scenario 6: `integration-google-forms-v2-jotform-crm-by-call-id` (ID: `2262483`)
3. Archive or label scenarios as `MIGRATED_TO_NEXTJS`.

---

## 6. Rollback Plan

If an unexpected critical failure occurs during cutover:

1. **Reactivate Make.com Scenarios**: Toggle ON all 6 scenarios in Make.com.
2. **Revert Twilio Webhook**: Point `+33939033663` inbound webhook back to the Make.com webhook URL (`https://hook.eu1.make.com/...`).
3. **Revert Vapi Webhook URLs**: Point Assistant server URLs and Tool URLs back to the Make.com webhook URLs.
4. **Revert JotForm Webhook**: Point form integration webhook back to Make.com webhook URL.
5. **Investigate**: Inspect logs in the Next.js Operational Dashboard (`/dashboard`) under the **Webhooks** and **Notifications** tabs.
