import express from "express";
import cors from "cors";
import { config } from "dotenv";
import authRoutes from "./routes/authRoutes";
import leadRoutes from "./routes/leadRoutes";
import campaignRoutes from "./routes/campaignRoutes";
import callRoutes from "./routes/callRoutes";
import socketRoutes from "./routes/socketRoutes";
import schedulerRoutes from "./routes/schedulerRoutes";
import { socketService } from "./services/socketService";
import getScheduler from "./services/schedulerInstance";
import { callStatusPoller } from "./services/callStatusPoller";

config();

const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Initialize a single scheduled call scheduler instance
const scheduledCallScheduler = getScheduler();
scheduledCallScheduler.start();

// Initialize the enhanced call status polling system
callStatusPoller.startBatchReconciliation();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/socket", socketRoutes);
app.use("/api/scheduler", schedulerRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
	res.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		service: "AI Calling System API",
		version: process.env.npm_package_version,
		environment: process.env.NODE_ENV,
	});
});

// Note: Scheduler status/trigger endpoints are exposed via /api/scheduler routes

// Start server
const server = app.listen(PORT, () => {
	console.log(`🚀 Server running on port ${PORT}`);
	console.log(`📞 Scheduled Call Scheduler: ACTIVE`);
});

// Initialize socket service
socketService.initialize(server);

// Graceful shutdown
process.on("SIGTERM", () => {
	console.log("🛑 SIGTERM received, shutting down gracefully...");
	scheduledCallScheduler.stop();
	callStatusPoller.stopAllPolling();
	server.close(() => {
		console.log("✅ Server closed");
		process.exit(0);
	});
});

process.on("SIGINT", () => {
	console.log("🛑 SIGINT received, shutting down gracefully...");
	scheduledCallScheduler.stop();
	callStatusPoller.stopAllPolling();
	server.close(() => {
		console.log("✅ Server closed");
		process.exit(0);
	});
});
