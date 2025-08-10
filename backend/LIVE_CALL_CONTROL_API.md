# Live Call Control API Documentation

This document describes the new live call control features implemented in the AI Calling System, based on [Vapi's Call Control documentation](https://docs.vapi.ai/calls/call-features).

## Overview

The system now supports real-time control of active calls through Vapi's call control and monitoring features:

1. **Call Control**: Inject conversation elements dynamically during ongoing calls
2. **Call Listen**: Real-time audio data streaming using WebSocket connections

## API Endpoints

### Base URL

```
http://localhost:3000/api/calls
```

### Authentication

All endpoints require authentication (currently disabled for testing):

```
Authorization: Bearer YOUR_JWT_TOKEN
```

## Call Control Endpoints

### 1. Say Message

Make the assistant say a specific message during the call.

**Endpoint:** `POST /control/:vapiCallId/say`

**Parameters:**

- `vapiCallId` (path): The Vapi call ID
- `message` (body): The message to say
- `endCallAfterSpoken` (body, optional): Whether to end the call after speaking (default: false)

**Request Body:**

```json
{
	"message": "Welcome to Vapi, this message was injected during the call.",
	"endCallAfterSpoken": false
}
```

**Response:**

```json
{
	"success": true,
	"message": "Message sent successfully",
	"data": null
}
```

### 2. Add Message to Conversation

Add a message to the conversation history and optionally trigger a response.

**Endpoint:** `POST /control/:vapiCallId/conversation`

**Parameters:**

- `vapiCallId` (path): The Vapi call ID
- `message` (body): The message object with role and content
- `triggerResponse` (body, optional): Whether to trigger a response (default: true)

**Request Body:**

```json
{
	"message": {
		"role": "system",
		"content": "New message added to conversation"
	},
	"triggerResponse": true
}
```

**Response:**

```json
{
	"success": true,
	"message": "Message added to conversation successfully",
	"data": null
}
```

### 3. Control Assistant

Control the assistant's behavior during the call.

**Endpoint:** `POST /control/:vapiCallId/assistant`

**Parameters:**

- `vapiCallId` (path): The Vapi call ID
- `control` (body): The control action

**Request Body:**

```json
{
	"control": "mute-assistant"
}
```

**Control Options:**

- `"mute-assistant"`: Mute the assistant
- `"unmute-assistant"`: Unmute the assistant
- `"say-first-message"`: Trigger the assistant's first message

**Response:**

```json
{
	"success": true,
	"message": "Assistant controlled successfully",
	"data": null
}
```

### 4. End Call

Programmatically end the ongoing call.

**Endpoint:** `POST /control/:vapiCallId/end`

**Parameters:**

- `vapiCallId` (path): The Vapi call ID

**Response:**

```json
{
	"success": true,
	"message": "Call ended successfully",
	"data": null
}
```

### 5. Transfer Call

Transfer the call to a different destination.

**Endpoint:** `POST /control/:vapiCallId/transfer`

**Parameters:**

- `vapiCallId` (path): The Vapi call ID
- `destinationNumber` (body): The destination phone number
- `transferMessage` (body, optional): Message to say before transfer

**Request Body:**

```json
{
	"destinationNumber": "+1234567890",
	"transferMessage": "Transferring your call now"
}
```

**Response:**

```json
{
	"success": true,
	"message": "Call transferred successfully",
	"data": null
}
```

### 6. Get Call Monitoring URLs

Get the URLs needed for real-time control and audio streaming.

**Endpoint:** `GET /control/:vapiCallId/monitoring-urls`

**Parameters:**

- `vapiCallId` (path): The Vapi call ID

**Response:**

```json
{
	"success": true,
	"message": "Call monitoring URLs retrieved successfully",
	"data": {
		"listenUrl": "wss://aws-us-west-2-production1-phone-call-websocket.vapi.ai/7420f27a-30fd-4f49-a995-5549ae7cc00d/transport",
		"controlUrl": "https://aws-us-west-2-production1-phone-call-websocket.vapi.ai/7420f27a-30fd-4f49-a995-5549ae7cc00d/control"
	}
}
```

## WebSocket Events

### Connection

```javascript
const socket = io("http://localhost:3000");

// Join a call room
socket.emit("join-call", "vapi-call-id");

// Start listening to call audio
socket.emit("start-call-listening", "vapi-call-id");
```

### Call Control Events

#### Message Sent

```javascript
socket.on("message-sent", (data) => {
	console.log("Message sent:", data.message);
	console.log("Call ID:", data.callId);
	console.log("Timestamp:", data.timestamp);
});
```

#### Conversation Message Added

```javascript
socket.on("conversation-message-added", (data) => {
	console.log("Message added to conversation:", data.message);
	console.log("Role:", data.message.role);
	console.log("Content:", data.message.content);
});
```

#### Assistant Controlled

```javascript
socket.on("assistant-controlled", (data) => {
	console.log("Assistant control:", data.control);
	console.log("Call ID:", data.callId);
});
```

#### Call Ended

```javascript
socket.on("call-ended", (data) => {
	console.log("Call ended:", data.reason);
	console.log("Call ID:", data.callId);
});
```

#### Call Transferred

```javascript
socket.on("call-transferred", (data) => {
	console.log("Call transferred to:", data.destinationNumber);
	console.log("Transfer message:", data.transferMessage);
});
```

### Call Listening Events

#### Audio Data

```javascript
socket.on("call-audio-data", (data) => {
	console.log("Audio data received");
	console.log("Data size:", data.audioData.length);
	console.log("Timestamp:", data.timestamp);

	// Convert base64 to audio buffer
	const audioBuffer = Buffer.from(data.audioData, "base64");

	// Process audio data (play, save, analyze, etc.)
});
```

#### Call Message

```javascript
socket.on("call-message", (data) => {
	console.log("Call message:", data.message);
	console.log("Call ID:", data.callId);
});
```

#### Listening Status

```javascript
socket.on("call-listening-started", (data) => {
	console.log("Started listening to call:", data.callId);
});

socket.on("call-listening-stopped", (data) => {
	console.log("Stopped listening to call:", data.callId);
});

socket.on("call-listening-error", (data) => {
	console.error("Listening error:", data.error);
});
```

## Example Usage

### Frontend JavaScript Example

```javascript
// Connect to Socket.IO
const socket = io("http://localhost:3000");

// Join a call room
socket.emit("join-call", "vapi-call-id");

// Start listening to audio
socket.emit("start-call-listening", "vapi-call-id");

// Send a message to the call
async function sendMessage() {
	const response = await fetch("/api/calls/control/vapi-call-id/say", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: "Bearer YOUR_TOKEN",
		},
		body: JSON.stringify({
			message: "Hello from the control panel!",
			endCallAfterSpoken: false,
		}),
	});

	const result = await response.json();
	console.log("Message sent:", result);
}

// Mute the assistant
async function muteAssistant() {
	const response = await fetch("/api/calls/control/vapi-call-id/assistant", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: "Bearer YOUR_TOKEN",
		},
		body: JSON.stringify({
			control: "mute-assistant",
		}),
	});

	const result = await response.json();
	console.log("Assistant muted:", result);
}

// End the call
async function endCall() {
	const response = await fetch("/api/calls/control/vapi-call-id/end", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: "Bearer YOUR_TOKEN",
		},
	});

	const result = await response.json();
	console.log("Call ended:", result);
}

// Listen for real-time updates
socket.on("message-sent", (data) => {
	console.log("Message was sent to the call");
});

socket.on("call-audio-data", (data) => {
	// Handle real-time audio data
	console.log("Received audio data");
});
```

### Node.js Client Example

```javascript
const io = require("socket.io-client");

const socket = io("http://localhost:3000");

socket.on("connect", () => {
	console.log("Connected to server");

	// Join call room
	socket.emit("join-call", "vapi-call-id");

	// Start listening to audio
	socket.emit("start-call-listening", "vapi-call-id");
});

// Listen for audio data
socket.on("call-audio-data", (data) => {
	console.log("Received audio data:", data.audioData.length, "bytes");

	// Save audio to file
	const fs = require("fs");
	const audioBuffer = Buffer.from(data.audioData, "base64");
	fs.appendFileSync("call-audio.pcm", audioBuffer);
});

// Listen for call control events
socket.on("message-sent", (data) => {
	console.log("Message sent to call:", data.message);
});

socket.on("call-ended", (data) => {
	console.log("Call ended:", data.reason);
});
```

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (invalid token)
- `404`: Not Found (call not found)
- `500`: Internal Server Error

Error responses include a message describing the issue:

```json
{
	"success": false,
	"message": "Call control URL not available - call may not be active",
	"error": "CALL_CONTROL_ERROR"
}
```

## Security Considerations

1. **Authentication**: All endpoints should be protected with JWT authentication
2. **Authorization**: Ensure users can only control calls they have access to
3. **Rate Limiting**: Implement rate limiting to prevent abuse
4. **Input Validation**: All input parameters are validated
5. **Error Logging**: Errors are logged for debugging and monitoring

## Testing

Use the provided socket client example to test the features:

```bash
cd backend
node socket-client-example.js
```

This will connect to the server and demonstrate the real-time features.

## Integration with Vapi

This implementation is based on [Vapi's Call Control documentation](https://docs.vapi.ai/calls/call-features) and provides:

1. **Call Control**: Direct integration with Vapi's control endpoints
2. **Call Listen**: Real-time audio streaming from Vapi's WebSocket endpoints
3. **Real-time Updates**: Socket.IO integration for live updates
4. **Error Handling**: Comprehensive error handling and logging
5. **Documentation**: Complete API documentation and examples

The system maintains compatibility with Vapi's API while providing a clean, RESTful interface for your application.
