import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { env } from "../config/env";

export class SocketService {
	private io: SocketIOServer | null = null;

	initialize(server: HTTPServer) {
		this.io = new SocketIOServer(server, {
			cors: {
				origin:
					env.NODE_ENV === "production"
						? ["https://your-frontend-domain.com"] // Update with your frontend URL
						: ["http://localhost:5173"], // Vite default ports
				methods: ["GET", "POST"],
				credentials: true,
			},
			transports: ["websocket", "polling"],
		});

		this.setupEventHandlers();
		console.log("🔌 Socket.IO server initialized");
	}

	private setupEventHandlers() {
		if (!this.io) return;

		this.io.on("connection", (socket) => {
			console.log(`🔗 Client connected: ${socket.id}`);

			// Join a call room
			socket.on("join-call", (callId: string) => {
				socket.join(`call-${callId}`);
				console.log(`📞 Client ${socket.id} joined call room: ${callId}`);

				// Notify others in the room
				socket.to(`call-${callId}`).emit("user-joined-call", {
					userId: socket.id,
					timestamp: new Date().toISOString(),
				});
			});

			// Leave a call room
			socket.on("leave-call", (callId: string) => {
				socket.leave(`call-${callId}`);
				console.log(`📞 Client ${socket.id} left call room: ${callId}`);

				// Notify others in the room
				socket.to(`call-${callId}`).emit("user-left-call", {
					userId: socket.id,
					timestamp: new Date().toISOString(),
				});
			});

			// Handle real-time transcript updates
			socket.on(
				"transcript-update",
				(data: {
					callId: string;
					transcript: string;
					speaker: "user" | "agent";
					timestamp: string;
				}) => {
					console.log(
						`📝 Transcript update for call ${data.callId}: ${data.transcript}`
					);

					// Broadcast to all clients in the call room
					this.io?.to(`call-${data.callId}`).emit("transcript-updated", {
						...data,
						timestamp: new Date().toISOString(),
					});
				}
			);

			// Handle voice activity detection
			socket.on(
				"voice-activity",
				(data: {
					callId: string;
					isSpeaking: boolean;
					speaker: "user" | "agent";
					audioLevel?: number;
				}) => {
					console.log(
						`🎤 Voice activity for call ${data.callId}: ${data.speaker} ${
							data.isSpeaking ? "speaking" : "silent"
						}`
					);

					// Broadcast to all clients in the call room
					this.io?.to(`call-${data.callId}`).emit("voice-activity-detected", {
						...data,
						timestamp: new Date().toISOString(),
					});
				}
			);

			// Handle call status updates
			socket.on(
				"call-status-update",
				(data: {
					callId: string;
					status: "connecting" | "connected" | "disconnected" | "failed";
					duration?: number;
					metadata?: any;
				}) => {
					console.log(
						`📞 Call status update for ${data.callId}: ${data.status}`
					);

					// Broadcast to all clients in the call room
					this.io?.to(`call-${data.callId}`).emit("call-status-changed", {
						...data,
						timestamp: new Date().toISOString(),
					});
				}
			);

			// Handle disconnection
			socket.on("disconnect", (reason) => {
				console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
			});
		});
	}

	// Public methods for emitting events from other parts of the application
	emitToCall(callId: string, event: string, data: any) {
		this.io?.to(`call-${callId}`).emit(event, {
			...data,
			timestamp: new Date().toISOString(),
		});
	}

	emitToUser(userId: string, event: string, data: any) {
		this.io?.to(userId).emit(event, {
			...data,
			timestamp: new Date().toISOString(),
		});
	}

	broadcastToAll(event: string, data: any) {
		this.io?.emit(event, {
			...data,
			timestamp: new Date().toISOString(),
		});
	}

	getConnectedClients() {
		if (!this.io) return [];
		return Array.from(this.io.sockets.sockets.keys());
	}

	getCallParticipants(callId: string) {
		if (!this.io) return [];
		const room = this.io.sockets.adapter.rooms.get(`call-${callId}`);
		return room ? Array.from(room) : [];
	}
}

// Export singleton instance
export const socketService = new SocketService();
