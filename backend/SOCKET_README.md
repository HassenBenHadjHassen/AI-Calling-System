# Socket.IO Real-Time Server

This document describes the Socket.IO implementation for real-time communication in the AI Calling System.

## Overview

The Socket.IO server provides real-time communication capabilities for:

- Live call transcripts
- Voice activity detection
- Call status updates
- Participant management
- Real-time notifications

## Features

### 🎯 Real-Time Events

1. **Call Management**

   - `join-call`: Join a specific call room
   - `leave-call`: Leave a call room
   - `user-joined-call`: Notify when someone joins
   - `user-left-call`: Notify when someone leaves

2. **Transcript Updates**

   - `transcript-update`: Send transcript updates
   - `transcript-updated`: Receive transcript updates
   - Supports speaker identification (user/agent)

3. **Voice Activity**

   - `voice-activity`: Send voice activity data
   - `voice-activity-detected`: Receive voice activity updates
   - Includes audio level and speaker identification

4. **Call Status**
   - `call-status-update`: Send call status changes
   - `call-status-changed`: Receive call status updates
   - Supports: connecting, connected, disconnected, failed

## Server Setup

The Socket.IO server is integrated with the Express server in `src/app.ts`:

```typescript
import { socketService } from "./services/socketService";

const server = createServer(app);
socketService.initialize(server);
```

## API Endpoints

### Socket Management

- `GET /api/socket/clients` - Get connected clients
- `GET /api/socket/call/:callId/participants` - Get call participants
- `POST /api/socket/call/:callId/emit` - Emit event to specific call
- `POST /api/socket/broadcast` - Broadcast to all clients

## Client Connection

### Frontend Integration

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
	transports: ["websocket", "polling"],
	autoConnect: true,
});

// Join a call
socket.emit("join-call", "call-123");

// Listen for transcript updates
socket.on("transcript-updated", (data) => {
	console.log("New transcript:", data.transcript);
	// Update your UI
});

// Listen for voice activity
socket.on("voice-activity-detected", (data) => {
	console.log("Voice activity:", data.isSpeaking);
	// Update your UI
});
```

## Event Types

### Transcript Events

```typescript
interface TranscriptData {
	callId: string;
	transcript: string;
	speaker: "user" | "agent";
	timestamp: string;
}
```

### Voice Activity Events

```typescript
interface VoiceActivityData {
	callId: string;
	isSpeaking: boolean;
	speaker: "user" | "agent";
	audioLevel?: number;
	timestamp: string;
}
```

### Call Status Events

```typescript
interface CallStatusData {
	callId: string;
	status: "connecting" | "connected" | "disconnected" | "failed";
	duration?: number;
	metadata?: any;
	timestamp: string;
}
```

## Integration with Call Controller

The call controller has been enhanced to emit real-time updates:

```typescript
// In callController.ts
import { socketService } from "../services/socketService";

// Emit when call is triggered
socketService.emitToCall(result.callId, "call-triggered", {
	callId: result.callId,
	status: "triggered",
	metadata: result,
});

// Emit webhook updates
socketService.emitToCall(webhookData.callId, "webhook-received", {
	callId: webhookData.callId,
	webhookType: webhookData.type,
	data: webhookData,
});
```

## Webhook Integration

The system automatically handles webhook data and converts it to real-time events:

- **Transcript webhooks** → `transcript-updated` events
- **Voice activity webhooks** → `voice-activity-detected` events
- **Call status webhooks** → `call-status-changed` events

## Room Management

Calls are organized in rooms using the pattern `call-{callId}`:

- Clients can join/leave specific call rooms
- Events are broadcasted only to participants in the same call
- Room participants can be queried via API

## Security Considerations

1. **CORS Configuration**: Configured for development and production environments
2. **Origin Validation**: Restrict origins in production
3. **Authentication**: Can be extended with JWT authentication
4. **Rate Limiting**: Consider implementing rate limiting for production

## Production Deployment

### Environment Variables

```env
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
```

### CORS Configuration

Update the CORS origins in `socketService.ts`:

```typescript
origin: env.NODE_ENV === "production"
	? ["https://your-frontend-domain.com"]
	: ["http://localhost:3000", "http://localhost:5173"];
```

## Testing

### Test Socket Connection

```bash
# Start the server
pnpm dev

# Test with curl
curl http://localhost:3000/api/socket/clients
```

### Test Event Emission

```bash
curl -X POST http://localhost:3000/api/socket/call/test-call/emit \
  -H "Content-Type: application/json" \
  -d '{
    "event": "test-event",
    "data": {"message": "Hello from API"}
  }'
```

## Future Enhancements

1. **Authentication**: Add JWT-based socket authentication
2. **Presence**: Track user presence and availability
3. **File Transfer**: Support real-time file sharing
4. **Screen Sharing**: Enable screen sharing capabilities
5. **Recording**: Real-time call recording status
6. **Analytics**: Track socket usage and performance metrics

## Troubleshooting

### Common Issues

1. **Connection Failed**

   - Check if server is running
   - Verify CORS configuration
   - Check network connectivity

2. **Events Not Received**

   - Ensure client is in the correct room
   - Check event names match exactly
   - Verify data format

3. **Performance Issues**
   - Monitor memory usage
   - Implement connection pooling
   - Use Redis adapter for scaling

### Debug Mode

Enable debug logging:

```typescript
// In socketService.ts
this.io = new SocketIOServer(server, {
	cors: {
		/* ... */
	},
	transports: ["websocket", "polling"],
	debug: true, // Enable debug mode
});
```

## Dependencies

- `socket.io`: Real-time communication
- `@types/socket.io`: TypeScript definitions (deprecated, included in socket.io)

## License

This implementation is part of the AI Calling System project.
