import { io, type Socket } from "socket.io-client";

class SocketService {
	private socket: Socket | null = null;
	private globalListeners: Map<string, ((...args: any[]) => void)[]> =
		new Map();
	private isConnected = false;

	connect() {
		if (typeof window === "undefined") return null;
		if (!this.socket) {
			this.socket = io(
				(import.meta as any).env?.VITE_SOCKET_URL || "ws://localhost:6942",
				{
					auth: {
						token:
							typeof window !== "undefined"
								? localStorage.getItem("authToken")
								: undefined,
					},
					// Add connection options for better performance
					transports: ["websocket", "polling"],
					upgrade: true,
					rememberUpgrade: true,
					timeout: 20000,
					forceNew: false,
				}
			);

			// Set up connection event handlers
			this.socket.on("connect", () => {
				this.isConnected = true;
				console.log("Socket connected");
			});

			this.socket.on("disconnect", () => {
				this.isConnected = false;
				console.log("Socket disconnected");
			});

			this.socket.on("connect_error", (error) => {
				console.error("Socket connection error:", error);
			});
		}
		return this.socket;
	}

	// ===== Per-call helpers =====
	joinCallRoom(callId: string) {
		if (!this.socket || !this.isConnected) return;
		this.socket.emit("join-call", callId);
	}

	startCallListening(callId: string) {
		if (!this.socket || !this.isConnected) return;
		this.socket.emit("start-call-listening", callId);
	}

	stopCallListening(callId: string) {
		if (!this.socket || !this.isConnected) return;
		this.socket.emit("stop-call-listening", callId);
	}

	disconnect() {
		if (this.socket) {
			// Remove all listeners before disconnecting
			this.socket.removeAllListeners();
			this.socket.disconnect();
			this.socket = null;
			this.isConnected = false;
			// Clear global listeners
			this.globalListeners.clear();
		}
	}

	getSocket() {
		return this.socket;
	}

	isSocketConnected() {
		return this.isConnected;
	}

	// Add global event listener
	addGlobalListener(event: string, callback: (...args: any[]) => void) {
		if (!this.globalListeners.has(event)) {
			this.globalListeners.set(event, []);
		}
		this.globalListeners.get(event)!.push(callback);

		// Set up socket listener if socket is connected
		if (this.socket && this.isConnected) {
			this.socket.on(event, callback);
		}
	}

	// Remove global event listener
	removeGlobalListener(event: string, callback: (...args: any[]) => void) {
		const listeners = this.globalListeners.get(event);
		if (listeners) {
			const index = listeners.indexOf(callback);
			if (index > -1) {
				listeners.splice(index, 1);
			}
		}

		if (this.socket) {
			this.socket.off(event, callback);
		}
	}

	// Set up global listeners for campaign and call updates
	setupGlobalListeners(queryClient: any) {
		if (!this.socket || !this.isConnected) return;

		// Campaign events
		const campaignEvents = [
			"campaign-created",
			"campaign-started",
			"campaign-stopped",
			"campaign-completed",
			"campaign-deleted",
			"campaign-leads-added",
			"campaign-lead-removed",
			"campaigns-cleaned",
		];

		campaignEvents.forEach((event) => {
			this.socket!.on(event, (data) => {
				console.log(`${event}:`, data);
				// Invalidate all campaign-related queries
				queryClient.invalidateQueries({ queryKey: ["campaigns"] });
				queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
				queryClient.invalidateQueries({ queryKey: ["campaigns-overview"] });
				queryClient.invalidateQueries({ queryKey: ["active-campaign"] });
				queryClient.invalidateQueries({
					queryKey: ["active-campaigns-overview"],
				});

				// Also invalidate individual campaign queries if campaign ID is available
				if (data.campaign?.id) {
					console.log(
						`Invalidating individual campaign queries for ID: ${data.campaign.id}`
					);
					queryClient.invalidateQueries({
						queryKey: ["campaign", data.campaign.id],
					});
					queryClient.invalidateQueries({
						queryKey: ["campaign-calls", data.campaign.id],
					});
					queryClient.invalidateQueries({
						queryKey: ["campaign-stats", data.campaign.id],
					});
				}

				// For campaign-deleted event, invalidate all campaign queries since we don't have the specific ID
				if (event === "campaign-deleted" && data.campaignId) {
					console.log(
						`Invalidating individual campaign queries for deleted ID: ${data.campaignId}`
					);
					queryClient.invalidateQueries({
						queryKey: ["campaign", data.campaignId],
					});
					queryClient.invalidateQueries({
						queryKey: ["campaign-calls", data.campaignId],
					});
					queryClient.invalidateQueries({
						queryKey: ["campaign-stats", data.campaignId],
					});
				}
			});
		});

		// Call events
		const callEvents = [
			"call-status-updated",
			"call-triggered",
			"webhook-received",
		];

		callEvents.forEach((event) => {
			this.socket!.on(event, (data) => {
				console.log(`${event}:`, data);
				// Invalidate call-related queries
				queryClient.invalidateQueries({ queryKey: ["call-history"] });
				queryClient.invalidateQueries({ queryKey: ["recent-calls"] });
				queryClient.invalidateQueries({ queryKey: ["call-stats"] });
			});
		});

		// Lead events (affect campaigns)
		const leadEvents = [
			"leads-uploaded",
			"lead-status-updated",
			"lead-deleted",
			"leads-cleaned",
		];

		leadEvents.forEach((event) => {
			this.socket!.on(event, (data) => {
				console.log(`${event}:`, data);
				// Invalidate lead and campaign-related queries
				queryClient.invalidateQueries({ queryKey: ["leads"] });
				queryClient.invalidateQueries({ queryKey: ["campaigns"] });
				queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
			});
		});
	}
}

export const socketService = new SocketService();
