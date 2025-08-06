import { io, type Socket } from "socket.io-client";

class SocketService {
	private socket: Socket | null = null;
	private globalListeners: Map<string, ((...args: any[]) => void)[]> =
		new Map();

	connect() {
		if (!this.socket) {
			this.socket = io(
				import.meta.env.VITE_SOCKET_URL || "ws://localhost:6942",
				{
					auth: {
						token: localStorage.getItem("authToken"),
					},
				}
			);
		}
		return this.socket;
	}

	disconnect() {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}
	}

	getSocket() {
		return this.socket;
	}

	// Add global event listener
	addGlobalListener(event: string, callback: (...args: any[]) => void) {
		if (!this.globalListeners.has(event)) {
			this.globalListeners.set(event, []);
		}
		this.globalListeners.get(event)!.push(callback);

		// Set up socket listener if socket is connected
		if (this.socket) {
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
		if (!this.socket) return;

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
				// Invalidate campaign-related queries
				queryClient.invalidateQueries({ queryKey: ["campaigns"] });
				queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
				queryClient.invalidateQueries({ queryKey: ["campaigns-overview"] });
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
