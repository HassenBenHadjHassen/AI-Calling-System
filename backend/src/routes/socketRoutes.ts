import { Router } from "express";
import { socketService } from "../services/socketService";
import { ResponseUtils } from "../utils/responseUtils";

const router = Router();

// Get connected clients
router.get("/clients", (req, res) => {
	const clients = socketService.getConnectedClients();
	ResponseUtils.success(res, {
		connectedClients: clients,
		totalClients: clients.length,
	});
});

// Get participants in a specific call
router.get("/call/:callId/participants", (req, res) => {
	const { callId } = req.params;
	const participants = socketService.getCallParticipants(callId);

	ResponseUtils.success(res, {
		callId,
		participants,
		participantCount: participants.length,
	});
});

// Test endpoint to emit a message to a specific call
router.post("/call/:callId/emit", (req, res) => {
	const { callId } = req.params;
	const { event, data } = req.body;

	if (!event || !data) {
		return ResponseUtils.badRequest(res, "Event and data are required");
	}

	socketService.emitToCall(callId, event, data);

	ResponseUtils.success(res, {
		message: `Event '${event}' emitted to call ${callId}`,
		callId,
		event,
		data,
	});
});

// Test endpoint to broadcast to all clients
router.post("/broadcast", (req, res) => {
	const { event, data } = req.body;

	if (!event || !data) {
		return ResponseUtils.badRequest(res, "Event and data are required");
	}

	socketService.emitToAll(event, data);

	ResponseUtils.success(res, {
		message: `Event '${event}' broadcasted to all clients`,
		event,
		data,
	});
});

export default router;
