# Task: Complete the AI Calling System Rewrite

Act as a senior full-stack engineer specializing in Next.js, TypeScript, Prisma, PostgreSQL, Vapi, Twilio, Google Calendar, and webhook-driven integrations.

Your task is to implement the complete application directly in the current repository. Do not just provide a plan, code snippets, or recommendations. Inspect the existing files, create and modify the necessary files, install dependencies using npm, implement the workflows, run tests, fix errors, and document the finished system.

## 1. Repository rules and source of truth

The current repository is `HassenBenHadjHassen/AI-Calling-System`.

The current working branch is intended to be `nextjs-rewrite`, created from the `migration` branch.

IMPORTANT: The old `master` branch contains outdated application code and must not be used as an architectural reference. Do not copy its backend, frontend, Prisma schema, services, or assumptions into this implementation.

The authoritative specifications are the six Make.com scenario exports in `make.com/`:

1. `Client_VIP.json`
2. `confirmation_de_rdv.json`
3. `integration-google-forms-v2-jotform-crm-by-call-id.json`
4. `integration-webhooks-google-calendar.json`
5. `links-v3-vapi-crm-sms-dani-batiment.json`
6. `patient-info.json`

Inspect every scenario in full, including nested routers, route filters, conditions, field mappings, structured outputs, webhook responses, SMS messages, calendar actions, and fallback behavior.

Do not assume that inspecting only the top-level modules is sufficient. The important business logic is frequently nested inside routers.

Before changing files, inspect `git status`, the current directory structure, `web/package.json`, the current Prisma configuration, installed dependency versions, and all six scenario exports. Preserve existing user changes and never overwrite the scenario exports.

If any configuration or external credentials are missing, use environment-variable placeholders and test doubles. Continue implementation rather than stopping to ask me questions.

## 2. Technology stack

Build the new application using:

- Next.js App Router
- React and TypeScript with strict type checking
- PostgreSQL
- Prisma ORM 7 with the PostgreSQL driver adapter
- npm exclusively for package management
- Zod for runtime validation
- Tailwind CSS for the dashboard
- Vapi for AI phone-call integrations
- Twilio for SMS and phone-number intelligence
- Google Calendar API for calendar availability and appointment management
- JotForm webhooks for form submissions
- OpenAI only where required by the original workflows, such as interpreting ambiguous SMS replies

The Next.js application has already been scaffolded inside `web/`, and Prisma initialization and npm dependency installation have already been attempted.

Inspect the actual installed configuration first. Reuse and fix it as needed. Do not blindly rerun project scaffolding or replace the existing `package.json`, lockfile, or Prisma configuration.

Use compatible versions of all packages. Consult current official documentation when version-specific configuration is uncertain.

All commands, scripts, installations, tests, and setup instructions must use npm. Do not use pnpm, yarn, or bun.

## 3. Overall objective

Replace Make.com as the workflow orchestration layer.

The finished application must own its business logic and use PostgreSQL as the source of truth instead of Google Sheets.

Retain the external integrations that are part of the workflows:

- Vapi for voice-assistant tool calls and call information
- Twilio for inbound and outbound SMS and phone-number intelligence
- Google Calendar for availability checks and appointment events
- JotForm for quote-request form submissions
- OpenAI where needed to interpret free-text SMS responses

External services must be isolated behind typed integration modules. The business logic must not depend directly on Make.com expressions, spreadsheet row numbers, or provider-specific details.

## 4. Analyze and document the six scenarios

Before implementing them, create `docs/workflow-mapping.md`.

For each scenario, document:

- Trigger and incoming payload
- Every nested branch and its exact conditions
- Fields extracted from the payload
- Database lookup or mutation required
- External API requests
- SMS templates and recipients
- Response returned to the caller or provider
- Error handling, fallback behavior, and idempotency strategy
- Corresponding new application endpoint, service, and database model

Preserve existing business behavior wherever it is intentional. If the export contains an apparent bug, unsafe assumption, contradictory filter, or ambiguous condition, document it and implement the most defensible behavior with a regression test. Do not silently remove a business rule.

## 5. Database architecture

Design a normalized relational PostgreSQL schema in `web/prisma/schema.prisma`.

At minimum, evaluate and implement appropriate models for:

### Business
Represents a business or workflow tenant, such as patient care or building services. Include a stable identifier, business name, business type, timezone, and appropriate configuration.

### AssistantConfig
Maps each Vapi assistant ID to its business, workflow type, configuration, and relevant settings. Assistant-specific routing must be configurable rather than scattered throughout source code.

### Contact
Stores normalized contact information such as name, phone number in E.164 format, email, address, postcode, and business association.

### Patient
Stores the patient-specific information required by the patient-intake workflow. Separate sensitive patient-related information from generic contact data where appropriate.

### CallRecord
Stores the external Vapi call ID, assistant ID, contact association, timestamps, call summary, relevant structured outputs, and other necessary call metadata.

### Appointment
Stores the patient, requested start/end times, confirmation status, refusal, cancellation, rescheduling state, and Google Calendar event ID.

### ServiceRequest
Stores building-service enquiries, quote requests, interventions, messages, cancellations, and follow-ups. Include the related contact, call record, external Vapi call ID, request category, address details where applicable, message or summary, and processing status.

### CallerAllowlist
Represents any allowlisted or specially routed phone numbers required by `Client_VIP.json`. Scope the records to the appropriate business or assistant.

### WebhookEvent
Tracks received webhook events, provider, event key, processing status, timestamps, and error information. Add a uniqueness constraint for reliable event deduplication. Avoid retaining unnecessary sensitive payload data.

### NotificationJob
Persists SMS and other notification tasks, recipients, message type, delivery status, attempt count, retry time, and external provider message ID.

Add any additional models justified by the actual scenario logic.

Use appropriate enums, relations, foreign keys, indexes, unique constraints, timestamps, and deletion behavior. Use transactions wherever related database changes must succeed together.

Every tenant-owned record must be scoped to its business so that the two business workflows cannot accidentally read or modify each other's records.

Avoid a giant generic table that combines patients, appointments, building-service enquiries, and notifications.

Configure Prisma using the actual Prisma 7 conventions and the PostgreSQL driver adapter. Verify the generated configuration before changing it.

Create migrations, generate the Prisma client, and provide a reproducible way to initialize and seed development data.

## 6. Workflow A: Client VIP lookup

Implement a Vapi tool endpoint that reproduces the logic in `Client_VIP.json`.

It must:

- Identify the caller and applicable assistant from the actual webhook payload.
- Normalize the caller's number before database lookup.
- Apply assistant-specific and business-specific routing rules.
- Check the required caller allowlist.
- Retrieve existing-client information and relevant service or appointment history.
- Distinguish existing customers from unknown callers.
- Return the appropriate result for each branch, including any existing-client history, booking information, service information, or transfer instructions.
- Handle empty results, ambiguous caller matches, and unknown assistant IDs safely.

Vapi tool responses must preserve the response structure and corresponding tool-call IDs expected by the exported workflows.

Inspect the payload variations used in the exports, including `message.toolCalls`, `message.toolCallList`, `message.customer.number`, `message.assistant.id`, and caller information supplied through lead metadata or tool arguments. Do not assume all versions have the same shape.

Use typed parsing and validation rather than unchecked deep property access.

## 7. Workflow B: Google Calendar availability

Implement the workflow from `integration-webhooks-google-calendar.json`.

It must:

- Extract the requested date/time from the Vapi tool call.
- Parse and validate the date accurately.
- Query the correct configured Google Calendar.
- Detect conflicts over the actual requested appointment interval.
- Return the expected available/unavailable result to Vapi.
- Handle invalid dates, missing calendar configuration, API errors, and ambiguous timezone input.

Use the `Europe/Paris` timezone for the French workflows unless the business configuration explicitly specifies otherwise.

The Make.com export uses an LLM prompt to force dates into fixed GMT+1. Replace this with correct timezone handling that accounts for French daylight-saving transitions. Never manually subtract an hour based only on the date or treat `Z` as equivalent to GMT+1.

Use Google's FreeBusy API or another appropriate Calendar API operation to check the complete target interval. Do not blindly reproduce the existing preceding-hour search if it can return incorrect availability.

Use a one-hour default duration only where consistent with the appointment workflow. Make the duration configurable where the scenario requires it.

Persist calendar event IDs when creating events. Implement duplicate-safe event updates and cancellation behavior.

## 8. Workflow C: Patient information and intake

Implement `patient-info.json`.

The implementation must process the actual Vapi structured outputs and reproduce the existing branch logic, including:

- Patient name and caller phone number
- Appointment date and time
- Postal code and service type
- Call ID
- Urgency classification
- Scam-score classification
- Cancellation classification
- Phone-line type lookup using Twilio where required
- Relevant patient records and status updates
- Internal notifications and customer SMS where required

Inspect the actual structured-output identifiers and field names in the export. Build a typed normalization layer for these values rather than scattering opaque identifiers throughout the application.

Reproduce the existing business thresholds and router conditions, including the urgent classification, the score-based scam branch, and fixed-line handling. Do not invent new medical or urgency classifications.

Persist the intake or appointment data before queueing notifications. Ensure a repeated event cannot create duplicate appointments or repeated internal alerts.

Treat all patient-related information as sensitive. Minimize stored information, validate access, redact sensitive details from logs, and document any compliance requirements that must be confirmed before production deployment.

## 9. Workflow D: Appointment confirmation via Twilio

Implement `confirmation_de_rdv.json`.

The workflow must:

- Receive inbound SMS from Twilio.
- Validate the Twilio webhook signature.
- Normalize the sender phone number.
- Match the sender to the correct pending appointment.
- Classify responses into the existing business outcomes: `OUI`, `NON`, `NONE`, or `AUTRE` with an alternative time.
- Validate any proposed alternative time before changing an appointment.
- Update appointment state in PostgreSQL.
- Create, update, or cancel the relevant Google Calendar event as appropriate.
- Send the corresponding SMS response or rescheduling instructions.
- Persist notification outcomes and errors.

Use the existing classification rules and message content as the behavioral reference. Reproduce the intent and relevant wording from the export, correcting only clear errors.

Use deterministic handling for unambiguous replies where possible. For free-text responses that require AI classification, use a configurable OpenAI integration and validate its output against a strict schema. Never directly execute an arbitrary time or instruction generated by an LLM.

Handle duplicate inbound SMS webhooks idempotently. A repeated `OUI` must not create another Calendar event or send a duplicate confirmation.

Return the appropriate TwiML response for Twilio. Do not confuse Twilio's expected response with the internal Vapi tool response format.

## 10. Workflow E: Dani Bâtiment CRM and SMS

Implement `links-v3-vapi-crm-sms-dani-batiment.json`.

Extract and validate the call information and structured outputs, including patient/customer name, caller phone number, request reason, service type, message, call summary, and Vapi call ID.

Reproduce the business routing for:

- `Devis`
- `Annulation`
- `Suivi`
- `Intervention`
- `Message`
- Any general-call or fallback branch actually represented in the export

For each branch:

- Create or update the correct `ServiceRequest`.
- Preserve the Vapi call ID so subsequent submissions can find the same record.
- Apply the appropriate request category and status.
- Send the relevant acknowledgement SMS where required.
- Queue internal notifications with the expected summary, contact details, request type, and service information.
- Ensure that duplicate Vapi events do not create duplicate service requests or duplicate notifications.

Preserve the existing JotForm link and necessary message content, but move business-specific sender numbers, recipient numbers, URLs, and other configuration into validated environment variables or appropriate business configuration.

Never use real customer or patient phone numbers as hardcoded production defaults. Provide safe placeholder configuration and test-mode behavior.

## 11. Workflow F: JotForm submission → CRM by CALL_ID

Implement `integration-google-forms-v2-jotform-crm-by-call-id.json`.

The webhook must:

- Receive and validate the JotForm submission.
- Extract the call ID, client name, email, address fields, and postcode.
- Find the original `ServiceRequest` through the Vapi call ID.
- Update that existing record.
- Mark the request completed according to the source workflow.
- Queue the corresponding internal SMS notification.
- Handle an unknown call ID, malformed submission, missing fields, conflicting data, and repeated form submission safely.

The original scenario uses `q14_callId`, `q17_nomDe`, `q4_adresse.addr_line1`, `q4_adresse.addr_line2`, `q4_adresse.postal`, and `q3_email`. Create a typed adapter for the actual exported mapping and confirm the real payload structure from sanitized fixtures.

Never create a second CRM record simply because a form was resubmitted.

Use a signature or shared-secret check only if supported by the configured JotForm webhook setup. If no signed webhook is available, document the chosen verification mechanism, add appropriate validation and rate limiting, and verify the referenced call before updating data.

## 12. API and source-code organization

Keep Next.js Route Handlers thin. Put business logic in testable services and provider calls in separate integration modules.

Use an organization similar to:

web/
  prisma/
    schema.prisma
    migrations/
  src/
    app/
      api/
        webhooks/
          vapi/
          twilio/
          jotform/
      dashboard/
      appointments/
      service-requests/
    lib/
      db.ts
      env.ts
      validation/
      integrations/
        vapi.ts
        twilio.ts
        google-calendar.ts
        jotform.ts
        openai.ts
      repositories/
      services/
        caller-lookup.service.ts
        patient-intake.service.ts
        appointments.service.ts
        service-requests.service.ts
        notifications.service.ts
        webhook-processing.service.ts
      jobs/
    generated/
      prisma/
  scripts/
  tests/

This is a suggested structure. Adjust it to idiomatic Next.js conventions while preserving the separation of responsibilities.

Use Zod schemas for all external requests and environment configuration. Avoid `any` in the implementation except where a narrowly scoped third-party compatibility boundary requires it.

Create a Prisma singleton suitable for local development and server-side Next.js use. Keep database credentials and all provider secrets server-side.

## 13. Reliable jobs, retries, and idempotency

Implement persistent webhook processing and notification delivery.

At minimum:

- Persist webhook receipt and processing state.
- Use stable idempotency keys.
- Enforce uniqueness in the database rather than depending only on in-memory checks.
- Use a database transaction for related record mutations.
- Persist notifications before delivery.
- Track notification attempt count, provider response, and next retry time.
- Retry transient failures with bounded exponential backoff.
- Avoid retrying permanent validation failures indefinitely.
- Make retries safe if a process crashes after sending a provider request but before updating the database.
- Record enough operational information to diagnose failures without logging secrets or sensitive patient data.

Implement a separate runnable worker if necessary. It must use the same npm project, database and integration modules. Do not implement durable jobs using an in-memory array or a `setInterval` inside a serverless Route Handler.

Use database-safe concurrency handling so two workers cannot claim the same job simultaneously. Document how the worker is started in development and production.

For external side effects such as SMS and Calendar event creation, explain any unavoidable gap between a database transaction and an external API request, and implement recovery and deduplication to prevent duplicate business records.

## 14. Configuration and security

Create `.env.example` with documented placeholders for all required configuration, including:

- `DATABASE_URL`
- Vapi API credentials and webhook/server authentication secrets
- Twilio account credentials, sender numbers, and alert recipients
- Google Calendar authentication and calendar IDs
- JotForm integration configuration
- OpenAI API key and configurable model, if AI classification is used
- Application URL, webhook URLs, and appropriate feature flags

Never commit real secrets. Inspect `.gitignore` and ensure all `.env` files with credentials are ignored.

Validate required configuration during server-side startup or when the relevant integration is initialized. Give actionable configuration errors without printing secret values.

Implement provider-specific webhook validation, request size limits, safe error responses, and rate limiting where appropriate.

Use least-privilege Google and database credentials. Never expose API keys, tokens, raw sensitive webhook bodies, or private configuration through frontend responses.

Add a `DRY_RUN` or equivalent safe development mode in which tests and local development cannot accidentally send real SMS messages or create live calendar events.

## 15. Operational dashboard

Implement a clean, responsive internal dashboard using the Next.js application and Tailwind CSS.

It should provide useful visibility into:

- Overview of appointments and service requests
- Recent calls and their associated records
- Appointment statuses and scheduled times
- Service requests filtered by type and status
- Webhook processing failures
- Failed or retrying notifications
- Relevant record details and processing history

Use server-side database queries and pagination for lists. Add appropriate authentication and authorization; do not expose sensitive patient data to unauthenticated visitors.

Do not spend time building decorative UI while webhook processing or database persistence is incomplete. Prioritize functionality, reliability, usability and clear error states.

## 16. Testing requirements

Set up a working test suite using a compatible testing framework. Use npm scripts and test doubles for external providers.

Do not send real SMS messages or create live Calendar events during automated tests.

Create sanitized fixture payloads derived from the Make.com exports and cover all six workflows.

Test at least:

- Existing caller, new caller and allowlisted caller
- Assistant-specific routing
- Available and unavailable calendar intervals
- French summer/winter timezone transitions
- Valid and invalid patient intake
- Urgent classification and scam-score conditions
- Mobile versus fixed-line behavior
- Appointment confirmation, refusal, irrelevant reply and alternative time
- Cancellation and rescheduling
- All Dani Bâtiment request categories
- JotForm enrichment of the matching call record
- Unknown or missing call IDs
- Repeated Vapi, Twilio and JotForm webhooks
- Twilio signature validation
- Missing integration credentials
- Provider API failures and retries
- Concurrent webhook processing
- Notification deduplication
- Authorization and tenant separation
- Database constraints and failed transactions

Include unit tests for business rules and integration tests for Route Handlers and database behavior.

Create a CI-friendly npm script set for linting, type checking, tests, Prisma validation, and production build.

Run all applicable checks. Fix the issues rather than merely reporting them.

Where tests cannot run due to missing database infrastructure or external credentials, provide mocks where feasible, clearly distinguish successful mock tests from unverified live integration behavior, and document the exact remaining validation.

## 17. Documentation and deployment

Update `web/README.md` and the root `README.md` to explain the new project.

Document:

- Prerequisites
- Environment setup
- PostgreSQL setup
- Prisma migrations and client generation
- Seed data initialization
- Development commands
- How to run the worker
- All webhook endpoints and their expected payloads
- How to configure each external provider
- How to test webhooks locally
- How to deploy the Next.js app and worker
- How to monitor failures and retry notification jobs
- How to migrate traffic away from Make.com safely

Include sanitized example payloads and expected responses for Vapi tools, Twilio inbound SMS, and JotForm submissions.

Create `docs/cutover-checklist.md` explaining how to switch each Make.com scenario to the new code one at a time, how to avoid duplicate live actions during the switch, and how to roll back if needed.

Keep Make.com exports unchanged as the reference specification.

## 18. Definition of done

The project is not complete until:

1. All six scenarios are mapped in documentation.
2. PostgreSQL and Prisma schema are implemented with migrations.
3. Every workflow has functioning server-side business logic and endpoints.
4. External API clients are isolated, typed, and configurable.
5. Webhook handling and notification delivery are duplicate-safe.
6. The internal dashboard can inspect the stored data and processing failures.
7. Tests cover important success, failure, and duplicate-processing cases.
8. Linting, type checking, Prisma validation, tests, and production build have been run.
9. `.env.example` and setup/deployment documentation are complete.
10. The project can run locally in dry-run mode without real provider credentials.
11. No application implementation depends on the old `master` branch.
12. The six JSON scenario exports remain untouched.

Work in phases, but continue implementing each phase without waiting for my approval. Make reasonable decisions when details are missing, document significant assumptions, and use safe placeholders where credentials are unavailable.

Do not report an integration as production-verified when only mocked tests were possible. At the end, summarize the actual implementation, the files created, the commands that succeeded, the test results, the configuration still required, and anything that remains blocked.

Start by auditing the current workspace and all six scenario exports, then implement the application.