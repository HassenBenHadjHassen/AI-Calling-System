# Real-Time Updates Implementation

## Problem

The frontend required manual refresh to see new campaigns or activity updates because:

1. **Missing Socket Events**: Backend wasn't emitting real-time events for campaign/lead updates
2. **No Query Invalidation**: Frontend wasn't listening for real-time updates to invalidate cached data
3. **Limited Event Coverage**: Only call-related events were being emitted

## Solution Implemented

### Backend Changes

#### 1. Campaign Controller (`backend/src/controllers/campaignController.ts`)

- Added socket service import
- Emit real-time events for all campaign operations:
  - `campaign-created`
  - `campaign-started`
  - `campaign-stopped`
  - `campaign-completed`
  - `campaign-deleted`
  - `campaign-leads-added`
  - `campaign-lead-removed`
  - `campaigns-cleaned`

#### 2. Call Service (`backend/src/services/callService.ts`)

- Added socket service import
- Emit `call-status-updated` event when webhooks are processed
- Includes call status, duration, transfer info, and lead/campaign IDs

#### 3. Lead Controller (`backend/src/controllers/leadController.ts`)

- Added socket service import
- Emit real-time events for lead operations:
  - `leads-uploaded`
  - `lead-status-updated`
  - `lead-deleted`
  - `leads-cleaned`

### Frontend Changes

#### 1. Socket Service (`frontend/app/lib/socket.ts`)

- Added global event listener management
- Added `setupGlobalListeners()` method to handle all real-time events
- Automatically invalidates relevant queries when events are received

#### 2. Query Client (`frontend/app/lib/query-client.ts`)

- Reduced stale time from 5 minutes to 30 seconds for more responsive updates

#### 3. Campaign Page (`frontend/app/routes/dashboard/campaign.tsx`)

- Added socket event listeners for campaign updates
- Automatically invalidates campaign queries when events are received

#### 4. Activity Page (`frontend/app/routes/dashboard/activity.tsx`)

- Added socket event listeners for call status updates
- Automatically invalidates call-related queries when events are received

#### 5. Dashboard Layout (`frontend/app/routes/dashboard.tsx`)

- Added global socket listeners hook
- Sets up real-time updates across all dashboard pages

#### 6. Auth Hook (`frontend/app/hooks/use-auth.ts`)

- Added `useGlobalSocketListeners()` hook for centralized real-time management

## Events Emitted

### Campaign Events

- `campaign-created`: When a new campaign is created
- `campaign-started`: When a campaign is started
- `campaign-stopped`: When a campaign is stopped
- `campaign-completed`: When a campaign is completed
- `campaign-deleted`: When a campaign is deleted
- `campaign-leads-added`: When leads are added to a campaign
- `campaign-lead-removed`: When a lead is removed from a campaign
- `campaigns-cleaned`: When all campaigns are cleaned

### Call Events

- `call-status-updated`: When a call status is updated via webhook
- `call-triggered`: When a call is triggered
- `webhook-received`: When a webhook is received

### Lead Events

- `leads-uploaded`: When leads are uploaded
- `lead-status-updated`: When a lead status is updated
- `lead-deleted`: When a lead is deleted
- `leads-cleaned`: When all leads are cleaned

## Query Invalidation

The system automatically invalidates relevant queries when events are received:

- **Campaign events**: Invalidates `["campaigns"]`, `["active-campaigns"]`, `["campaigns-overview"]`
- **Call events**: Invalidates `["call-history"]`, `["recent-calls"]`, `["call-stats"]`
- **Lead events**: Invalidates `["leads"]`, `["campaigns"]`, `["active-campaigns"]`

## Testing

### To Test Real-Time Updates:

1. **Open multiple browser tabs** with the dashboard
2. **Create a new campaign** in one tab
3. **Verify** the campaign appears automatically in other tabs
4. **Start/stop campaigns** and verify status updates across tabs
5. **Upload leads** and verify they appear in campaigns across tabs
6. **Trigger calls** and verify activity updates across tabs

### Expected Behavior:

- No manual refresh required
- Updates appear within 1-2 seconds
- All dashboard pages stay in sync
- Console logs show real-time events being received

## Benefits

1. **No Manual Refresh**: Users see updates immediately
2. **Cross-Tab Sync**: Multiple browser tabs stay synchronized
3. **Real-Time Activity**: Live call status and activity updates
4. **Better UX**: Seamless real-time experience
5. **Scalable**: Global event system handles all updates

## Technical Notes

- Uses Socket.IO for real-time communication
- React Query for efficient caching and invalidation
- Global event listeners prevent duplicate setup
- Automatic cleanup prevents memory leaks
- Reduced stale time for more responsive updates
