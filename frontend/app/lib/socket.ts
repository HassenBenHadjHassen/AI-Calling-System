import { io, type Socket } from "socket.io-client"

class SocketService {
  private socket: Socket | null = null

  connect() {
    if (!this.socket) {
      this.socket = io(import.meta.env.VITE_SOCKET_URL || "ws://localhost:6942", {
        auth: {
          token: localStorage.getItem("authToken"),
        },
      })
    }
    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  getSocket() {
    return this.socket
  }

  // Simulate live activity for demo purposes
  simulateActivity() {
    if (!this.socket) return

    const mockActivities = [
      { phone: "+1-555-0123", status: "COMPLETED", lead: "John Doe" },
      { phone: "+1-555-0124", status: "TRANSFERRED", lead: "Jane Smith" },
      { phone: "+1-555-0125", status: "FAILED", lead: "Bob Johnson" },
      { phone: "+1-555-0126", status: "INITIATED", lead: "Alice Brown" },
    ]

    setInterval(() => {
      const activity = mockActivities[Math.floor(Math.random() * mockActivities.length)]
      this.socket?.emit("mock-activity", {
        ...activity,
        timestamp: new Date().toISOString(),
        id: Math.random().toString(36).substr(2, 9),
      })
    }, 3000)
  }
}

export const socketService = new SocketService()
