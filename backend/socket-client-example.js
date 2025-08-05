// Example Socket.IO client connection
// This can be used in your frontend to connect to the real-time server

import { io } from "socket.io-client";

// Connect to the Socket.IO server
const socket = io("http://localhost:3000", {
	transports: ["websocket", "polling"],
	autoConnect: true,
});

// Connection events
socket.on("connect", () => {
	console.log("🔗 Connected to Socket.IO server");
	console.log("Socket ID:", socket.id);
});

socket.on("disconnect", (reason) => {
	console.log("🔌 Disconnected from Socket.IO server:", reason);
});

// Join a call room
function joinCall(callId) {
	socket.emit("join-call", callId);
	console.log(`📞 Joined call room: ${callId}`);
}

// Leave a call room
function leaveCall(callId) {
	socket.emit("leave-call", callId);
	console.log(`📞 Left call room: ${callId}`);
}

// Listen for real-time updates
socket.on("transcript-updated", (data) => {
	console.log("📝 Transcript updated:", data);
	// Update your UI with the new transcript
	updateTranscriptUI(data);
});

socket.on("voice-activity-detected", (data) => {
	console.log("🎤 Voice activity:", data);
	// Update your UI to show who is speaking
	updateVoiceActivityUI(data);
});

socket.on("call-status-changed", (data) => {
	console.log("📞 Call status changed:", data);
	// Update your UI with the new call status
	updateCallStatusUI(data);
});

socket.on("user-joined-call", (data) => {
	console.log("👤 User joined call:", data);
	// Update your UI to show who joined
	updateParticipantsUI(data);
});

socket.on("user-left-call", (data) => {
	console.log("👤 User left call:", data);
	// Update your UI to show who left
	updateParticipantsUI(data);
});

// Example UI update functions (implement these in your frontend)
function updateTranscriptUI(data) {
	// Add the new transcript to your UI
	const transcriptContainer = document.getElementById("transcript-container");
	if (transcriptContainer) {
		const transcriptElement = document.createElement("div");
		transcriptElement.className = `transcript-line ${data.speaker}`;
		transcriptElement.innerHTML = `
      <span class="speaker">${data.speaker}:</span>
      <span class="text">${data.transcript}</span>
      <span class="time">${new Date(data.timestamp).toLocaleTimeString()}</span>
    `;
		transcriptContainer.appendChild(transcriptElement);
		transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
	}
}

function updateVoiceActivityUI(data) {
	// Update voice activity indicators
	const speakerIndicator = document.getElementById(`${data.speaker}-speaking`);
	if (speakerIndicator) {
		if (data.isSpeaking) {
			speakerIndicator.classList.add("speaking");
			speakerIndicator.style.opacity = data.audioLevel || 1;
		} else {
			speakerIndicator.classList.remove("speaking");
			speakerIndicator.style.opacity = 0.3;
		}
	}
}

function updateCallStatusUI(data) {
	// Update call status display
	const statusElement = document.getElementById("call-status");
	if (statusElement) {
		statusElement.textContent = data.status;
		statusElement.className = `status-${data.status}`;
	}
}

function updateParticipantsUI(data) {
	// Update participants list
	console.log("Participants updated:", data);
	// Implement your participants UI update logic
}

// Example usage:
// joinCall('call-123');
// leaveCall('call-123');

export { socket, joinCall, leaveCall };
