# AI Calling System Backend Prompt

## Architecture Rules

- All code must use **classes**.
- **Repository** folder: Contains only database access code (CRUD, queries, etc.), each as a class.
- **Service** folder: Contains business logic, orchestrates repositories, each as a class.
- **Controller** folder: Handles API endpoints, calls services, each as a class.

## Schema & Database

- Prisma schema is set for MongoDB, with models for Lead, Campaign, CallHistory, and all necessary enums.
- All ObjectId relations use @db.ObjectId for MongoDB compatibility.
- Only one campaign can be active at a time; each campaign has up to 5 leads.
- Leads can be rescheduled; rescheduled leads are removed from their campaign and assigned to a new one.
- Scheduled calls (with scheduledCallAt) always preempt campaign calls and must be triggered at the exact scheduled time.

## Lead Management

- Endpoint to upload leads (CSV/Excel), batch into campaigns of 5
- Endpoint to list/filter leads by status
- Endpoint to update lead status (called, interested, transferred, failed, blacklisted, scheduled)
- Endpoint to schedule a call for a lead (set scheduledCallAt, etc.)
- Endpoint to blacklist a lead (GDPR opt-out)

## Campaign Management

- Endpoint to create/list campaigns
- Only one campaign can be active at a time
- Campaigns are processed sequentially (not in parallel)
- When a lead is rescheduled, remove from current campaign and assign to a new campaign

## Call Handling

- Integrate with Vapi.ai to trigger calls
- Webhook endpoint to receive call status updates (completed, transferred, failed, etc.)
- Log all call attempts in CallHistory
- Scheduled calls must preempt campaign calls (if scheduledCallAt is due, call at that exact time)
- Scheduler/service to trigger scheduled calls at the right time (node-cron or similar)

## Stats & Reporting

- Endpoint to get campaign/call stats (calls made, successful, transferred, conversion rate, etc.)

## Business Rules

- Max 5 simultaneous calls (enforced at all times)
- Scheduled calls always have priority over campaign calls
- If a scheduled call is due, it must be called at the scheduled time, even if a campaign is running
- GDPR: store minimal data, support opt-out/blacklist

## Testing & Validation

- Unit/integration tests for all endpoints and business logic
- Test with large lead uploads (e.g., 100+ leads)
- Test scheduled call preemption and campaign sequencing

---

**If you upload this file as context, the assistant will understand the backend structure, business rules, and architecture conventions for the AI Calling System project.**
