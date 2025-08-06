import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { createServer } from "http";
import { env } from "./config/env";
import callRoutes from "./routes/callRoutes";
import authRoutes from "./routes/authRoutes";
import leadRoutes from "./routes/leadRoutes";
import campaignRoutes from "./routes/campaignRoutes";
import socketRoutes from "./routes/socketRoutes";
import { ResponseUtils } from "./utils/responseUtils";
import { socketService } from "./services/socketService";
import { CampaignService } from "./services/campaignService";
import { CallService } from "./services/callService";

const app = express();
const server = createServer(app);

// Initialize services
const campaignService = new CampaignService();
const callService = new CallService();

// Middleware
app.use(
	cors({
		origin: "*",
		credentials: true,
	})
);
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files for uploaded files (with authentication in production)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/socket", socketRoutes);

// Health check
app.get("/api/health", (req, res) => {
	ResponseUtils.success(res, {
		status: "ok",
		timestamp: new Date().toISOString(),
		environment: env.NODE_ENV,
		version: "1.0.0",
	});
});

// 404 handler
app.use((req, res) => {
	ResponseUtils.notFound(res, `Route not found: ${req.originalUrl}`);
});

// Global error handling
app.use(
	(
		err: any,
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		console.error("Global error handler:", err);

		// Handle specific error types
		if (err.name === "ValidationError") {
			return ResponseUtils.badRequest(res, err.message);
		}

		if (err.name === "UnauthorizedError") {
			return ResponseUtils.unauthorized(res);
		}

		if (err.code === "LIMIT_FILE_SIZE") {
			return ResponseUtils.error(res, "File too large", 413);
		}

		// Default error response
		const message =
			env.NODE_ENV === "production"
				? "Internal Server Error"
				: err.message || "Internal Server Error";

		ResponseUtils.error(res, message);
	}
);

// Graceful shutdown
process.on("SIGTERM", () => {
	console.log("SIGTERM received, shutting down gracefully");
	clearInterval(scheduledCallsInterval);
	process.exit(0);
});

process.on("SIGINT", () => {
	console.log("SIGINT received, shutting down gracefully");
	clearInterval(scheduledCallsInterval);
	process.exit(0);
});

const PORT = env.PORT;

// Initialize Socket.IO server
socketService.initialize(server);

// Scheduled job to process due scheduled calls
const processScheduledCalls = async () => {
	try {
		const triggeredCalls = await callService.triggerScheduledCalls(
			"Scheduled Call"
		);
		if (triggeredCalls.length > 0) {
			console.log(`📞 Triggered ${triggeredCalls.length} scheduled calls`);
		}
	} catch (error) {
		console.error("❌ Error processing scheduled calls:", error);
	}
};

// Start scheduled job to check for due scheduled calls every minute
const scheduledCallsInterval = setInterval(processScheduledCalls, 60000); // 60 seconds

// Initial run after 10 seconds to allow server to fully start
setTimeout(processScheduledCalls, 10000);

server.listen(PORT, async () => {
	console.log(`🚀 Server running on port ${PORT}`);
	console.log(`📊 Environment: ${env.NODE_ENV}`);
	console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
	console.log(`🔌 Socket.IO server ready for real-time communication`);
	console.log(`⏰ Scheduled calls processor started (runs every minute)`);
});
