# Overdue Rescheduled Calls Feature

## Overview

This feature automatically handles rescheduled calls that have passed their scheduled time without being called. When a call is rescheduled and the scheduled time has gone by without the call being made, the system will automatically update the lead status to "CALLED" and clear the scheduled call data.

## How It Works

### Automatic Processing

- The system runs a scheduled job every minute that checks for overdue rescheduled calls
- When an overdue call is found, the system:
  1. Updates the lead status from `SCHEDULED` to `CALLED`
  2. Clears the scheduled call data (`scheduledCallAt`, `scheduledCallNote`, `scheduledCallStatus`)
  3. Resets the retry count to 0
  4. Logs the action for monitoring

### Manual Processing

- A new API endpoint is available to manually trigger the overdue call processing
- Endpoint: `POST /api/calls/trigger/overdue`
- Returns the number of processed calls and a success message

## Implementation Details

### Backend Changes

#### 1. CallService (`backend/src/services/callService.ts`)

- Added `handleOverdueRescheduledCalls()` method
- Processes leads with `scheduledCallAt` in the past and `status = SCHEDULED`
- Updates status to `CALLED` and clears scheduled call data

#### 2. LeadRepository (`backend/src/repositories/leadRepository.ts`)

- Added `findOverdueScheduledCalls()` method
- Finds leads with scheduled call times in the past that are still in `SCHEDULED` status

#### 3. CallController (`backend/src/controllers/callController.ts`)

- Added `handleOverdueRescheduledCalls()` endpoint handler
- Provides REST API access to the overdue call processing functionality

#### 4. App.ts (`backend/src/app.ts`)

- Updated the scheduled job to include overdue call processing
- Runs every minute along with the existing scheduled call processing

#### 5. Routes (`backend/src/routes/callRoutes.ts`)

- Added `POST /api/calls/trigger/overdue` route

### Frontend Changes

#### 1. API Service (`frontend/app/services/api.ts`)

- Added `handleOverdueRescheduledCalls()` method to the `callAPI` object
- Provides frontend access to the overdue call processing endpoint

## Database Schema

The feature uses the existing database schema:

- `Lead.scheduledCallAt`: DateTime when the call was scheduled
- `Lead.status`: LeadStatus enum (SCHEDULED, CALLED, etc.)
- `Lead.scheduledCallStatus`: ScheduledCallStatus enum (PENDING, COMPLETED, etc.)
- `Lead.retryCount`: Number of retry attempts

## Usage

### Automatic Processing

The feature runs automatically every minute. No manual intervention is required.

### Manual Processing

```javascript
// Frontend
import { callAPI } from "./services/api";

const result = await callAPI.handleOverdueRescheduledCalls();
console.log(`Processed ${result.data.processedCount} overdue calls`);

// Backend (direct API call)
const response = await fetch("/api/calls/trigger/overdue", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
});
const result = await response.json();
```

### Testing

A test script is provided at `backend/test-overdue-calls.js` to verify the functionality:

```bash
cd backend
node test-overdue-calls.js
```

## Logging

The system logs all overdue call processing activities:

```
📅 Updated overdue rescheduled call for lead 123 (John Doe) - scheduled for 1/1/2024, 10:00:00 AM but not called
📅 Processed 5 overdue rescheduled calls
```

## Error Handling

- Individual lead processing errors are logged but don't stop the overall process
- Database connection errors are properly handled and logged
- API endpoint errors return appropriate HTTP status codes

## Monitoring

Monitor the following for system health:

- Console logs showing overdue call processing
- Database queries for leads with past scheduled times
- API endpoint response times and success rates

## Future Enhancements

Potential improvements:

1. Configurable grace period (e.g., 15 minutes after scheduled time)
2. Email notifications for overdue calls
3. Dashboard showing overdue call statistics
4. Bulk processing options for large datasets
5. Integration with external calendar systems
