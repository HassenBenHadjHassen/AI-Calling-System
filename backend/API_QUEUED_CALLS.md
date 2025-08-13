# Queued Calls API Endpoint

## Overview

The queued calls API endpoint provides detailed information about calls that are currently waiting in the call queue to be processed.

## Endpoint

```
GET /api/calls/queue/list
```

## Authentication

Requires Bearer token authentication.

## Response Format

The endpoint returns a JSON array of queued calls with the following structure:

```json
{
  "success": true,
  "data": [
    {
      "leadId": "string",
      "title": "string",
      "isScheduled": boolean,
      "priority": number,
      "timestamp": "2024-01-15T10:30:00.000Z",
      "queuePosition": number,
      "estimatedWaitTime": number,
      "lead": {
        "id": "string",
        "name": "string",
        "phone1": "string",
        "phone2": "string",
        "address": "string",
        "postalCode": "string",
        "city": "string",
        "status": "string",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    }
  ],
  "message": "Queued calls retrieved successfully"
}
```

## Response Fields

| Field               | Type    | Description                                           |
| ------------------- | ------- | ----------------------------------------------------- |
| `leadId`            | string  | Unique identifier of the lead                         |
| `title`             | string  | Title/description of the call                         |
| `isScheduled`       | boolean | Whether this is a scheduled call (higher priority)    |
| `priority`          | number  | Priority level (2 for scheduled, 1 for regular calls) |
| `timestamp`         | string  | When the call was added to the queue                  |
| `queuePosition`     | number  | Current position in the queue (1-based)               |
| `estimatedWaitTime` | number  | Estimated wait time in minutes (optional)             |
| `lead`              | object  | Lead information including contact details            |

## Priority System

- **Priority 2**: Scheduled calls (higher priority)
- **Priority 1**: Regular campaign calls (lower priority)

Calls are processed in order of priority, then by timestamp (oldest first).

## Example Usage

### cURL

```bash
curl -X GET \
  http://localhost:3000/api/calls/queue/list \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE'
```

### JavaScript/Fetch

```javascript
const response = await fetch("/api/calls/queue/list", {
	method: "GET",
	headers: {
		Authorization: "Bearer YOUR_TOKEN_HERE",
	},
});

const data = await response.json();
console.log("Queued calls:", data.data);
```

## Error Responses

### 401 Unauthorized

```json
{
	"success": false,
	"error": "Unauthorized"
}
```

### 500 Internal Server Error

```json
{
	"success": false,
	"error": "Failed to get queued calls"
}
```

## Related Endpoints

- `GET /api/calls/management-stats` - Get call queue statistics
- `GET /api/calls/stats` - Get general call statistics
- `POST /api/calls/trigger/:leadId` - Trigger a new call (adds to queue if at capacity)

## Notes

- The queue is processed automatically when capacity becomes available
- Estimated wait times are calculated based on an average call duration of 5 minutes
- Lead information is included when available, but may be null if the lead cannot be found
