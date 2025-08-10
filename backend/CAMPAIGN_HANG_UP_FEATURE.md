# Campaign Hang Up Feature

This feature allows you to automatically hang up on all active calls for a campaign when the campaign is stopped, or manually hang up on campaign calls when needed.

## Overview

When a campaign is stopped, the system will automatically:

1. Find all active calls (INITIATED status) for that campaign
2. End each call using Vapi's live call control
3. Update call records and emit real-time updates
4. Provide detailed results of the hang up operation

## Automatic Hang Up on Campaign Stop

When you stop a campaign using the existing `/api/campaigns/:id/stop` endpoint, the system will now automatically hang up on all active calls for that campaign.

### Response Format

The stop campaign response now includes hang up results:

```json
{
	"id": "campaign_id",
	"name": "Campaign Name",
	"status": "STOPPED",
	"hangUpResults": {
		"totalCalls": 5,
		"successfulHangUps": 4,
		"failedHangUps": 1,
		"errors": ["Failed to hang up call vapi_call_id_123: Call not found"]
	},
	"message": "Campaign stopped successfully. 4/5 active calls were hung up."
}
```

## Manual Hang Up Endpoint

You can also manually hang up on all active calls for a campaign without stopping the campaign itself.

### Endpoint

```
POST /api/campaigns/:id/hang-up-calls
```

### Response

```json
{
	"success": true,
	"data": {
		"totalCalls": 3,
		"successfulHangUps": 3,
		"failedHangUps": 0,
		"errors": []
	},
	"message": "Successfully hung up 3/3 active calls for campaign"
}
```

## Real-time Updates

The system emits the following Socket.IO events:

- `campaign-stopped` - When a campaign is stopped (includes hang up results)
- `campaign-calls-hung-up` - When calls are manually hung up for a campaign

## Database Changes

### New Repository Method

Added `findActiveCallsByCampaign()` to `CallRepository`:

```typescript
async findActiveCallsByCampaign(campaignId: string): Promise<CallHistory[]>
```

This method finds all calls with:

- `campaignId` matching the specified campaign
- `callStatus` = `INITIATED` (active calls)
- `vapiCallId` is not null (has a Vapi call ID)

### New Service Methods

Added `hangUpAllCampaignCalls()` to `CallService`:

```typescript
async hangUpAllCampaignCalls(campaignId: string): Promise<{
  totalCalls: number;
  successfulHangUps: number;
  failedHangUps: number;
  errors: string[];
}>
```

Added `hangUpAllCampaignCalls()` to `CampaignService` as a wrapper.

## Error Handling

The system handles various error scenarios:

1. **Call not found in Vapi**: Logs error and continues with other calls
2. **Network issues**: Logs error and continues with other calls
3. **Invalid Vapi call ID**: Logs error and continues with other calls
4. **Campaign not found**: Returns appropriate error response

## Logging

The system provides detailed logging:

```
🛑 Stopping campaign "Test Campaign" and hanging up on all active calls...
📞 Successfully hung up call vapi_call_id_123 for campaign campaign_id
📞 Campaign campaign_id hang up results: 4/5 successful
```

## Testing

You can test this feature using the Postman collection:

1. **Stop Campaign with Hang Up**: Use the existing "Stop Campaign" request
2. **Manual Hang Up**: Use the new "Hang Up Campaign Calls" request

## Configuration

No additional configuration is required. The feature is automatically enabled when you stop a campaign.

## Security

The feature respects existing authentication and authorization middleware. All endpoints require proper authentication tokens.
