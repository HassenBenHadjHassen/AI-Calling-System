import { io, type Socket } from "socket.io-client";

class SocketService {
	private socket: Socket | null = null;

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
}

export const socketService = new SocketService();
