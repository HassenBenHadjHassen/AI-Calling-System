import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { vapiService } from "./vapiService";

class SocketService {
	private io: SocketIOServer | null = null;
	private activeCallListeners: Map<string, any> = new Map(); // Store WebSocket connections for call listening

	initialize(server: HTTPServer) {
		this.io = new SocketIOServer(server, {
			cors: {
				origin: process.env.FRONTEND_URL || "http://localhost:5173",
				methods: ["GET", "POST"],
			},
		});

		this.io.on("connection", (socket) => {
			console.log("Client connected:", socket.id);

			// Join call room for real-time updates
			socket.on("join-call", (callId: string) => {
				socket.join(`call-${callId}`);
				console.log(`Client ${socket.id} joined call room: ${callId}`);
			});

			// Start listening to call audio
			socket.on("start-call-listening", async (callId: string) => {
				try {
					await this.startCallListening(callId, socket);
				} catch (error: any) {
					console.error("Error starting call listening:", error);
					socket.emit("call-listening-error", {
						callId,
						error: error.message,
					});
				}
			});

			// Stop listening to call audio
			socket.on("stop-call-listening", (callId: string) => {
				this.stopCallListening(callId);
				socket.emit("call-listening-stopped", { callId });
			});

			socket.on("disconnect", () => {
				console.log("Client disconnected:", socket.id);
				// Clean up any active listeners for this socket
				this.cleanupSocketListeners(socket.id);
			});
		});
	}

	/**
	 * Start listening to a call's audio stream
	 */
	private async startCallListening(callId: string, socket: any) {
		try {
			// Get the listen URL from Vapi
			const urls = await vapiService.getCallMonitoringUrls(callId);

			if (!urls.listenUrl) {
				throw new Error("Listen URL not available for this call");
			}

			// Create WebSocket connection to Vapi's listen URL
			const WebSocket = require("ws");
			const ws = new WebSocket(urls.listenUrl);

			ws.on("open", () => {
				console.log(`Started listening to call ${callId}`);
				socket.emit("call-listening-started", { callId });
			});

			ws.on("message", (data: Buffer, isBinary: boolean) => {
				if (isBinary) {
					// Audio data - emit to connected clients
					this.io?.to(`call-${callId}`).emit("call-audio-data", {
						callId,
						audioData: data.toString("base64"), // Convert to base64 for transmission
						timestamp: new Date().toISOString(),
					});
				} else {
					// Text message - parse and emit
					try {
						const message = JSON.parse(data.toString());
						this.io?.to(`call-${callId}`).emit("call-message", {
							callId,
							message,
							timestamp: new Date().toISOString(),
						});
					} catch (error) {
						console.error("Error parsing call message:", error);
					}
				}
			});

			ws.on("close", () => {
				console.log(`Stopped listening to call ${callId}`);
				this.io
					?.to(`call-${callId}`)
					.emit("call-listening-stopped", { callId });
				this.activeCallListeners.delete(callId);
			});

			ws.on("error", (error: any) => {
				console.error(`Error listening to call ${callId}:`, error);
				this.io?.to(`call-${callId}`).emit("call-listening-error", {
					callId,
					error: error.message,
				});
				this.activeCallListeners.delete(callId);
			});

			// Store the WebSocket connection
			this.activeCallListeners.set(callId, ws);
		} catch (error: any) {
			console.error("Error starting call listening:", error);
			throw error;
		}
	}

	/**
	 * Stop listening to a call's audio stream
	 */
	private stopCallListening(callId: string) {
		const ws = this.activeCallListeners.get(callId);
		if (ws) {
			ws.close();
			this.activeCallListeners.delete(callId);
			console.log(`Stopped listening to call ${callId}`);
		}
	}

	/**
	 * Clean up listeners when a socket disconnects
	 */
	private cleanupSocketListeners(socketId: string) {
		// This could be enhanced to track which socket started which listener
		// For now, we'll keep all active listeners running
	}

	/**
	 * Emit event to all clients in a specific call room
	 */
	emitToCall(callId: string, event: string, data: any) {
		this.io?.to(`call-${callId}`).emit(event, data);
	}

	/**
	 * Emit event to all connected clients
	 */
	emitToAll(event: string, data: any) {
		this.io?.emit(event, data);
	}

	/**
	 * Get active call listeners
	 */
	getActiveCallListeners(): string[] {
		return Array.from(this.activeCallListeners.keys());
	}

	/**
	 * Get all connected clients
	 */
	getConnectedClients(): any[] {
		if (!this.io) return [];
		const sockets = this.io.sockets.sockets;
		return Array.from(sockets.values()).map((socket: any) => ({
			id: socket.id,
			rooms: Array.from(socket.rooms),
			connectedAt: socket.handshake.time,
		}));
	}

	/**
	 * Get participants in a specific call
	 */
	getCallParticipants(callId: string): any[] {
		if (!this.io) return [];
		const room = this.io.sockets.adapter.rooms.get(`call-${callId}`);
		if (!room) return [];

		return Array.from(room).map((socketId: string) => {
			const socket = this.io!.sockets.sockets.get(socketId);
			return {
				id: socketId,
				connectedAt: socket?.handshake.time,
			};
		});
	}
}

export const socketService = new SocketService();
