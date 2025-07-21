# AI Calling System Backend (MVP)

## Features
- Lead management (upload, list, update status)
- Campaign control (start, stop, list)
- Call handling (trigger, webhook, status update) with Twilio and Vapi.ai integration
- Basic stats/reporting
- MongoDB with Prisma ORM

## Setup

1. **Install dependencies**
   ```sh
   pnpm install
   ```

2. **Configure environment**
   - Copy `.env.example` to `.env` and set your MongoDB and integration credentials:
     ```sh
     cp .env.example .env
     # Edit .env to set DATABASE_URL and the following:
     # Twilio
     TWILIO_ACCOUNT_SID=your_twilio_account_sid
     TWILIO_AUTH_TOKEN=your_twilio_auth_token
     TWILIO_FROM_NUMBER=+33xxxxxxxxx
     TWILIO_TWIML_URL=https://your-server.com/api/calls/twiml
     # Vapi.ai
     VAPI_API_KEY=your_vapi_api_key
     VAPI_DEFAULT_SCRIPT=your_vapi_script_or_scenario_id
     ```

3. **Generate Prisma client**
   ```sh
   npx prisma db push
   ```

4. **Run the server**
   ```sh
   pnpm dev
   ```

## API Endpoints

- `POST /api/leads/upload` — Upload leads (array of `{ phone, name? }`)
- `GET /api/leads` — List all leads
- `PATCH /api/leads/:id/status` — Update lead status
- `POST /api/campaigns/:id/start` — Start campaign
- `POST /api/campaigns/:id/stop` — Stop campaign
- `GET /api/campaigns` — List campaigns
- `POST /api/calls/trigger` — Trigger a call (Twilio + Vapi.ai integration)
- `POST /api/calls/webhook` — Webhook for call status updates
- `GET /api/stats` — Get call statistics
- `GET /api/health` — Health check

## Call Flow
- When a call is triggered, the backend:
  1. Places a call using Twilio (from a +33 number)
  2. Initiates the AI agent via Vapi.ai, passing the Twilio call SID
  3. Logs the call as INITIATED in the database
  4. Handles status updates via webhook endpoints

## Project Structure
- `src/controllers/` — API request handlers
- `src/services/` — Business logic (including Twilio/Vapi.ai integration)
- `src/repositories/` — Database logic
- `src/routes/` — Express routes

## Notes
- Make sure your Twilio number is a valid +33 (France) number.
- Integrate your own Vapi.ai script/scenario as needed.
- Add authentication and GDPR/opt-out logic as required. 