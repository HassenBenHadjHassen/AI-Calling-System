# Make.com Workflow Analysis & Architecture Mapping

This document provides the authoritative mapping of the six Make.com scenario exports from `make.com/` into the new Next.js / PostgreSQL / Prisma application. It analyzes each scenario's trigger, payload structure, router branches, filters, database mutations, external integrations, SMS templates, edge cases, known bugs in the Make.com export, and the target application architecture.

---

## Executive Summary & Tenant Architecture

The system orchestrates automated voice and messaging workflows for two distinct business tenants:

1. **Tenant 1: Cabinet Michelle (`CABINET_MICHELLE`)**
   - **Domain**: Home Nursing / Healthcare Clinic (`Cabinet d'infirmiers`)
   - **Vapi Assistant ID**: `97808c43-384a-4f40-a8dd-9149ba4988f5`
   - **Inbound Twilio SMS Phone Number**: `+33939033663` (configurable)
   - **Internal Alert Recipient (Nurse Mobile)**: `+33612857915` (configurable via `NURSE_ALERT_PHONE_NUMBER`)
   - **Google Calendar ID**: `monaldi2b@gmail.com` (configurable via `CABINET_CALENDAR_ID`)
   - **Timezone**: `Europe/Paris` (handles Daylight Saving Time / CET / CEST transitions)

2. **Tenant 2: Dani Bâtiment (`DANI_BATIMENT`)**
   - **Domain**: Building / Construction Contractor (`Artisan Bâtiment / Travaux`)
   - **Vapi Assistant ID**: `38a56410-a3b6-49d5-96f1-8cd572b3f81c`
   - **Outbound Twilio SMS Phone Number**: `+33939036462` (configurable)
   - **Internal Alert Recipient (Staff Mobile)**: `+33612857915` (configurable via `BATIMENT_ALERT_PHONE_NUMBER`)
   - **JotForm Devis Form URL**: `https://form.jotform.com/260901590611047?callId={callId}` (configurable)

---

## 1. Scenario 1: `Client_VIP.json`

### 1.1 Overview & Purpose
Vapi Voice Assistant tool-call endpoint executed during an incoming phone call to determine if the caller is an allowlisted contact (VIP / Whitelist), an existing customer with past appointment/service records, or a new customer.

### 1.2 Trigger and Incoming Payload
- **Trigger**: HTTP POST Webhook from Vapi (Tool Call)
- **Supported Payload Variations**:
  - `message.toolCalls[0].function.arguments.caller` or `message.toolCallList[0].function.arguments.caller`
  - `message.customer.number` (fallback if caller argument is omitted)
  - `message.assistant.id` (Assistant UUID)
  - `message.toolCalls[0].id` or `message.toolCallList[0].id` (Tool call identifier for response correlation)

### 1.3 Nested Branches and Exact Conditions

1. **Global Whitelist Check (Module 31)**:
   - Make.com checked sheet `1Qo1aGxMn-MIM8-fehzCXOsfRuC1lqs-if-LyrnkwThY` (column A = customer phone).
   - If found (`length == 1`), the caller is allowlisted.

2. **Assistant Routing (Module 9)**:
   - **Branch 1: Cabinet Michelle (`message.assistant.id == "97808c43-384a-4f40-a8dd-9149ba4988f5"`)**:
     - Queries existing client database for matching caller phone.
     - **Sub-branch 1.1: Existing Client (Module 3)**:
       - Condition: `Sheet_Match == 1` AND `Allowlist_Match != 1`
       - Action: Returns existing client history to the assistant.
       - Result: `"Utilisateur est un client existant, Nom : {name}, Historique : {service_type}, Heure: {time}, Date: {date}"`
     - **Sub-branch 1.2: New Client (Module 16)**:
       - Condition: `Sheet_Match != 1` AND `Allowlist_Match != 1`
       - Result: `"Utilisateur est un nouveau client"`
     - **Sub-branch 1.3: Whitelist / VIP (Module 22)**:
       - Condition: `Allowlist_Match == 1`
       - Result: `" NUMERO EST UN liste blanche / whitelist, DONC TRASNFERT LAPPEL VERS LE LINFIRMIERE "`
   - **Branch 2: Dani Bâtiment (`message.assistant.id == "38a56410-a3b6-49d5-96f1-8cd572b3f81c"`)**:
     - Queries building service requests for caller phone.
     - Result (Module 14):
       `"NOM: {name}, service: {service}, Motif: {motif}, Message: {message}, ADRESSE: {address or 'Non specifie'}"`
     - Fallback: If caller has no prior records, returns clean non-error response indicating no prior history found.

### 1.4 Response Returned to Vapi
Standard Vapi Tool Call format:
```json
{
  "results": [
    {
      "toolCallId": "<toolCallId>",
      "result": "<French instructions for voice agent>"
    }
  ]
}
```

### 1.5 Analysis of Bugs & Design Flaws in Make.com Export
- **Bug in Make.com**: In Route 2 (Dani Bâtiment), if no rows match in Sheet 11, referencing `11.0`, `11.4`, etc. yielded empty strings or failed in Make.com.
- **Defensible Fix**: When no record is found for Dani Bâtiment caller, return `"Utilisateur est un nouveau client pour les travaux de bâtiment"` so the AI assistant knows to proceed with intake rather than assuming empty tokens.
- **Phone Normalization**: Caller numbers arrive in mixed formats (`+33...`, `06...`, `336...`). We normalize caller numbers to E.164 before lookup.

### 1.6 Application Mapping
- **Endpoint**: `POST /api/webhooks/vapi/tools/client-vip`
- **Service**: `CallerLookupService`
- **Database Models**: `CallerAllowlist`, `Contact`, `Appointment`, `ServiceRequest`, `AssistantConfig`

---

## 2. Scenario 2: `integration-webhooks-google-calendar.json`

### 2.1 Overview & Purpose
Vapi tool-call endpoint to check Google Calendar availability before proposing an appointment slot to the caller.

### 2.2 Trigger and Incoming Payload
- **Trigger**: HTTP POST Webhook from Vapi
- **Payload**:
  - `message.toolCalls[0].function.arguments.date_time` (e.g., `"2026-10-15T14:00:00"`, `"2026-10-15 14:00"`, etc.)
  - `message.toolCalls[0].id`
  - `message.assistant.id`

### 2.3 Nested Branches and Exact Conditions
- **Time parsing & conflict check**:
  - Checks if calendar event exists overlapping requested time slot.
  - **Branch 1: NOT_AVAILABLE (Module 5)**: If any overlapping busy event is found:
    - Result: `"available=False ,Donc Ce créneau est déjà pris "`
  - **Branch 2: AVAILABLE (Module 6)**: If no overlapping busy events:
    - Result: `"available=True, Donc Le créneau est libre"`

### 2.4 Analysis of Bugs & Design Flaws in Make.com Export
- **Critical Bug**: Make.com used an OpenAI prompt (Module 8) attempting to subtract 1 hour during summer (GMT+2 vs GMT+1) and then queried Google Calendar with `timeMin = date - 1 hour` and `timeMax = date`. This meant it looked for events in the *hour before* the requested time rather than the actual requested slot!
- **Defensible Fix**:
  1. Use deterministic Luxon / native `Intl` with `Europe/Paris` timezone to parse the date and compute the true interval `[start, start + duration]` (default 1 hour).
  2. Account for French DST transitions automatically without heuristic hour subtraction.
  3. Query Google Calendar FreeBusy API or `events.list` checking for direct overlap: `event.start < slot.end AND event.end > slot.start`.

### 2.5 Application Mapping
- **Endpoint**: `POST /api/webhooks/vapi/tools/calendar-availability`
- **Service**: `CalendarAvailabilityService` & `GoogleCalendarIntegration`
- **Database Models**: `Business` (stores calendar config & timezone), `AssistantConfig`

---

## 3. Scenario 3: `patient-info.json`

### 3.1 Overview & Purpose
Vapi End-of-Call / Server webhook for Cabinet Michelle. Persists patient appointment details, checks phone line type (Mobile vs Landline via Twilio Lookup), assesses scam score & urgency, and sends internal SMS alerts to the nurse.

### 3.2 Trigger and Incoming Payload
- **Trigger**: HTTP POST Webhook from Vapi (`end-of-call-report` or structured output event)
- **Extracted Fields**:
  - Structured output `389d26dd-40e4-4670-9f2b-5acd1c40e6ee`:
    - `patient_name`: string
    - `DATE`: appointment date (YYYY-MM-DD)
    - `HEURE`: appointment time (e.g. "14h30" or "14:30")
    - `code_postal`: postal code
    - `service_type`: nursing service requested
    - `urgency`: boolean or "true"/"false"
  - Structured output `500a4dac-64f0-4d0a-9b0f-8523954132af`:
    - `result`: cancellation flag ("true" if cancellation)
  - Structured output `78937e6c-b9cc-46c2-a1c5-1e36df0fa42f`:
    - `result`: Scam / credibility score (numeric: 1 to 10)
  - `message.call.id`: External Vapi Call ID
  - `message.customer.number`: Caller's phone number

### 3.3 Nested Branches and Exact Conditions
1. **Branch 1: Cancellation (`500a4dac.result == "true"`)**:
   - Sends internal SMS to nurse (+33612857915):
     `"ANNULATION DE RDV \nclient info:\nnom: {patient_name}\nsoin: {service_type}\ndate: {date}\nheure: {heure}\nnumero: {customer_number}"`
   - Updates appointment status to `CANCELLED`.
2. **Branch 2: Normal Intake (`500a4dac != "true"` and `e9485024 != "true"`)**:
   - Saves row with status `PENDING`.
   - Calls Twilio Lookup API v2: `/v2/PhoneNumbers/{caller}?Fields=line_type_intelligence`.
   - **Sub-branch 2.1: Mobile Number (`line_type == "mobile"`)**:
     - **Urgent (`urgency == "true"`)**:
       - Sends SMS to nurse: `"c'est un urgent condition\nrapeller le patient\n"`
       - Updates status to `CONFIRMED URGENT`.
     - **Standard Appointment (`urgency != "true"` AND scam score >= 5)**:
       - Sends SMS to nurse with confirmation options:
         `"bonjour nouveau patient:\nDATE:{date}   à{heure}\nNOM:{name}\nService:{service}\ncode postale:\n{postcode}\nnumero :{caller}\n\nOPTION:\n1.OUI\n2.NON\n\n"`
       - Status remains `PENDING`.
     - **Scam Call (scam score <= 3)**:
       - Updates status to `SCAM`. No SMS sent.
   - **Sub-branch 2.2: Landline Number (`line_type == "landline"`)**:
     - Sends SMS to nurse:
       `"Le cleint vient d'appeler d'une nunemro FIXE ces infos:\ntu le rappeleras sur le numero :{caller}\n\nDATE:\n{date}   à{heure}\nNOM:{name}\nService:{service}\n"`
     - Status remains `PENDING_LANDLINE`.

### 3.4 Application Mapping
- **Endpoint**: `POST /api/webhooks/vapi/patient-intake`
- **Service**: `PatientIntakeService` & `TwilioIntegration`
- **Database Models**: `Patient`, `Contact`, `Appointment`, `CallRecord`, `WebhookEvent`, `NotificationJob`

---

## 4. Scenario 4: `confirmation_de_rdv.json`

### 4.1 Overview & Purpose
Twilio Inbound SMS webhook. The nurse replies to an appointment alert with `OUI`, `NON`, or proposes an alternative time. The system parses the response, updates the appointment status, creates Google Calendar events, and sends confirmation SMS to the patient.

### 4.2 Trigger and Incoming Payload
- **Trigger**: HTTP POST Webhook from Twilio (`application/x-www-form-urlencoded`)
- **Key Fields**:
  - `From`: Nurse phone number (e.g., `+33612857915`)
  - `Body`: SMS message text
  - `MessageSid`: Twilio message unique identifier (used for idempotency)

### 4.3 Nested Branches and Exact Conditions
1. **Lookup**:
   - Finds latest appointment with status `PENDING` associated with the business.
2. **Immediate TwiML Response**:
   - Returns HTTP 200 with `<Response></Response>`.
3. **Classification via Rules + OpenAI fallback**:
   - Classifies response as `OUI`, `NON`, `AUTRE (HH:mm)`, or `NONE`.
   - **Branch OUI**:
     - Creates Google Calendar Event:
       - Summary: `"rendez-vous avec patient :{patient_name}"`
       - Start: Requested appointment date/time
       - Duration: 1 hour
     - Sends confirmation SMS to patient:
       `"Bonjour, votre RDV infirmier est confirmé pour le {date} à {heure}.\nEn cas d'empêchement, merci de nous prévenir au plus vite.\n"`
     - Updates appointment status to `CONFIRMED`.
     - Stores Google Calendar Event ID.
   - **Branch NON**:
     - Sends SMS to patient:
       `"Bonjour, le créneau demandé n'est malheureusement plus disponible. \nMerci de rappeler le cabinet pour convenir d'un autre horaire.\n Cordialement."`
     - Updates appointment status to `REFUSER`.
   - **Branch AUTRE (alternative time)**:
     - Sends SMS to patient proposing alternative time:
       `"l'infirmière vous proposerez une autre heure à {new_time}\nrepondre avec juste:\nOUI\nNON\nsi vous voulez une autre rendez-vous merci de rappler l'assitance"`
     - Updates appointment state to `RESCHEDULE_PROPOSED`.
   - **Branch NONE**:
     - Ignores unrelated messages without mutating state.

### 4.4 Application Mapping
- **Endpoint**: `POST /api/webhooks/twilio/inbound-sms`
- **Service**: `AppointmentConfirmationService`
- **Database Models**: `Appointment`, `Patient`, `NotificationJob`, `WebhookEvent`

---

## 5. Scenario 5: `links-v3-vapi-crm-sms-dani-batiment.json`

### 5.1 Overview & Purpose
Vapi End-of-Call / Server webhook for Dani Bâtiment. Classifies building customer calls into `Devis`, `Annulation`, `Suivi`, `Intervention`, or `Message`. Creates service requests in PostgreSQL and sends tailored SMS messages.

### 5.2 Trigger and Incoming Payload
- **Trigger**: HTTP POST Webhook from Vapi
- **Key Fields**:
  - `message.call.id`: External Vapi Call ID
  - `_lead_metadata.phone_number` or `message.customer.number`: Caller's phone number
  - Structured output `2e375095-f01f-40a6-ad7c-4a1ae3caf67a`:
    - `patient_name`: Customer name
    - `motif-appel`: Call category (`Devis`, `Annulation`, `Suivi`, `Intervention`, `Message`)
    - `service_type`: Type of building work (e.g. Plomberie, Peinture, Maçonnerie)
    - `message`: Specific customer request details
    - `call_summary`: Assistant call summary

### 5.3 Nested Branches and Exact Conditions
1. **Branch 1: DEVIS (`motif-appel == "Devis"`)**:
   - Creates `ServiceRequest` with category `DEVIS`, status `NOT_COMPLETED`.
   - Sends SMS to customer:
     `"Bonjour, suite à votre appel, merci de remplir ce formulaire rapide avec vos coordonnées exactes (adresse du chantier et email) : https://form.jotform.com/260901590611047?callId={callId}\n Cela nous permettra d'étudier votre demande de devis dans les meilleures conditions. L'équipe de Dani bâtiment.\n(Merci de ne pas répondre à ce SMS généré automatiquement)"`
2. **Branch 2: ANNULATION ou SUIVI (`motif-appel in ["Annulation", "Suivi"]`)**:
   - Sends acknowledgement SMS to customer:
     `"Bonjour, nous vous confirmons avoir bien pris en compte votre message/annulation suite à votre appel. L'information a été transmise au dossier. Cordialement, l'équipe Dani Bâtiment.\n(Merci de ne pas répondre à ce SMS généré automatiquement)"`
   - Finds existing client record and creates/updates `ServiceRequest`.
   - Sends internal alert SMS to staff (+33612857915):
     `"🔧 SUIVI/ANNULATION :\n-Nom: {name}\n-numero:{phone}\n-Motif : {motif}\n-message:{message}\n- Résumé : {summary}\n"`
3. **Branch 3: INTERVENTION ou MESSAGE (`motif-appel in ["Intervention", "Message"]`)**:
   - Creates `ServiceRequest` with status `MESSAGE`.
   - Sends SMS to customer:
     `"Bonjour, votre appel a bien été pris en compte. Nos équipes sont actuellement en intervention. Nous avons noté vos coordonnées et vous rappelons dès que possible. Bonne journée, Dani bâtiment.\n(Merci de ne pas répondre à ce SMS généré automatiquement)"`
   - Sends internal alert SMS to staff (+33612857915):
     `"📞 APPEL GÉNÉRAL : \nnom:{name}\nphone:{phone}\nMessage :{summary}\nservice:{service_type}"`

### 5.4 Application Mapping
- **Endpoint**: `POST /api/webhooks/vapi/dani-batiment`
- **Service**: `ServiceRequestService` & `NotificationService`
- **Database Models**: `ServiceRequest`, `Contact`, `CallRecord`, `NotificationJob`, `WebhookEvent`

---

## 6. Scenario 6: `integration-google-forms-v2-jotform-crm-by-call-id.json`

### 6.1 Overview & Purpose
Webhook receiver for JotForm form submissions. Enriches the existing `ServiceRequest` identified by `callId` with site address and customer email, changes status to `COMPLETED`, and alerts staff via SMS.

### 6.2 Trigger and Incoming Payload
- **Trigger**: HTTP POST Webhook from JotForm (`multipart/form-data` or `application/json` rawRequest)
- **Extracted Fields**:
  - `q14_callId`: Vapi Call ID correlating back to the initial call
  - `q17_nomDe`: Customer full name
  - `q3_email`: Customer email
  - `q4_adresse`:
    - `addr_line1`: Street address line 1
    - `addr_line2`: Street address line 2
    - `postal`: Postal code

### 6.3 Processing & Actions
1. **Record Correlation**:
   - Looks up `ServiceRequest` by `vapiCallId == q14_callId`.
2. **Update Service Request**:
   - Updates customer name, address, postal code, email.
   - Marks status `COMPLETED`.
3. **Internal SMS Alert**:
   - Sends SMS to staff (+33612857915):
     `"🚨 NOUVEAU DEVIS:\n\nClient : {name}\nTél : {phone}\nEmail : {email}\nMotif : {service_type}\nAdresse : {addr_line1}\ncode postal:{postal}\nmessage:{initial_message}"`
4. **Idempotency**:
   - Resubmitting the same form updates the existing record without creating duplicate requests or duplicate notifications.

### 6.4 Application Mapping
- **Endpoint**: `POST /api/webhooks/jotform/submission`
- **Service**: `JotFormIntakeService`
- **Database Models**: `ServiceRequest`, `Contact`, `NotificationJob`, `WebhookEvent`

---

## Summary Matrix of Endpoints & Models

| Workflow | Make.com File | HTTP Route | Method | Tenant | Primary DB Models |
|---|---|---|---|---|---|
| **A. VIP Lookup** | `Client_VIP.json` | `/api/webhooks/vapi/tools/client-vip` | `POST` | Multi-tenant | `CallerAllowlist`, `Contact`, `Appointment`, `ServiceRequest` |
| **B. Calendar Availability** | `integration-webhooks-google-calendar.json` | `/api/webhooks/vapi/tools/calendar-availability` | `POST` | Cabinet Michelle | `Business`, `AssistantConfig` |
| **C. Patient Intake** | `patient-info.json` | `/api/webhooks/vapi/patient-intake` | `POST` | Cabinet Michelle | `Patient`, `Contact`, `Appointment`, `CallRecord` |
| **D. Appointment Confirmation** | `confirmation_de_rdv.json` | `/api/webhooks/twilio/inbound-sms` | `POST` | Cabinet Michelle | `Appointment`, `NotificationJob`, `WebhookEvent` |
| **E. Dani Bâtiment CRM** | `links-v3-vapi-crm-sms-dani-batiment.json` | `/api/webhooks/vapi/dani-batiment` | `POST` | Dani Bâtiment | `ServiceRequest`, `Contact`, `CallRecord`, `NotificationJob` |
| **F. JotForm CRM by Call ID** | `integration-google-forms-v2-jotform-crm-by-call-id.json` | `/api/webhooks/jotform/submission` | `POST` | Dani Bâtiment | `ServiceRequest`, `Contact`, `NotificationJob` |
