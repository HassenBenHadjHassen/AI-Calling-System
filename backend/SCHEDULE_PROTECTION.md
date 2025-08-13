# Schedule Protection Mechanism

## Problem

When the schedule API is called to schedule a call for a lead, the lead status is set to `SCHEDULED`. However, if the call status poller processes the call and it reaches a terminal status (COMPLETED, FAILED, etc.), it would override the `SCHEDULED` status with the call outcome status, causing the scheduled call information to be lost.

## Solution

Implemented a protection mechanism that prevents lead status changes for 1 minute after a call is scheduled via the schedule API.

## Implementation Details

### 1. CallStatusPoller Enhancements

- Added `scheduledLeads` Map to track recently scheduled leads
- Added `SCHEDULE_PROTECTION_DURATION` constant (60 seconds)
- Added automatic cleanup of expired entries every 30 seconds

### 2. Key Methods Added

#### `trackScheduledLead(leadId: string)`

- Tracks a lead as recently scheduled
- Called when the schedule API is invoked
- Logs the protection activation

#### `isLeadStatusProtected(leadId: string): boolean`

- Checks if a lead is protected from status changes
- Returns true if the lead was scheduled within the last minute
- Logs remaining protection time for debugging

#### `cleanupExpiredScheduledLeads()`

- Removes expired scheduled lead entries
- Runs automatically every 30 seconds
- Prevents memory leaks

### 3. Integration Points

#### LeadService.scheduleCall()

- Calls `callStatusPoller.trackScheduledLead()` after successfully scheduling
- Ensures the lead is protected immediately after scheduling

#### CallStatusPoller.handleTerminalStatus()

- Checks `isLeadStatusProtected()` before updating lead status
- Skips status update if lead is protected
- Logs when protection prevents status change

### 4. Debugging Support

#### Enhanced Statistics

- `getPollingStats()` now includes `scheduledLeadsCount`
- Shows how many leads are currently protected

#### Protection Status Query

- `getScheduledLeadStatus(leadId)` returns protection details
- Useful for debugging and monitoring

## Usage Example

```typescript
// When a call is scheduled via API
const lead = await leadService.scheduleCall(phoneNumber, scheduledTime, note);
// Lead is automatically tracked and protected for 1 minute

// When call status poller tries to update lead status
if (callStatusPoller.isLeadStatusProtected(leadId)) {
	console.log("Skipping status update - lead is protected");
	return; // Status update is skipped
}
```

## Logging

The system provides comprehensive logging:

- `📅 Tracking scheduled lead {leadId} - status changes blocked for 1 minute`
- `📅 Lead {leadId} is protected from status changes ({time}s remaining)`
- `📅 Skipping lead status update for {leadId} - lead is protected due to recent scheduling`
- `📅 Cleaned up {count} expired scheduled lead entries`

## Configuration

- Protection duration: 60 seconds (configurable via `SCHEDULE_PROTECTION_DURATION`)
- Cleanup interval: 30 seconds (configurable in constructor)

## Benefits

1. **Prevents Status Override**: Scheduled calls maintain their `SCHEDULED` status
2. **Automatic Cleanup**: No memory leaks from tracking data
3. **Debugging Support**: Comprehensive logging and status queries
4. **Non-Intrusive**: Only affects status updates, doesn't interfere with other operations
5. **Configurable**: Protection duration can be adjusted if needed
