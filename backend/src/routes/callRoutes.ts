import { Router } from "express";
import { CallController } from "../controllers/callController";
import { callService } from "../services/callService";
// import { authenticateToken } from "../middleware/auth"; // Commented out for testing

const router = Router();
const callController = new CallController();

// Call triggering routes
router.post(
	"/trigger/:leadId",
	// authenticateToken, // Commented out for testing
	callController.triggerCall.bind(callController)
);
router.post(
	"/trigger/scheduled",
	// authenticateToken, // Commented out for testing
	callController.triggerScheduledCalls.bind(callController)
);
router.post(
	"/trigger/campaign/:campaignId",
	// authenticateToken, // Commented out for testing
	callController.triggerCampaignCalls.bind(callController)
);
router.post(
	"/trigger/overdue",
	// authenticateToken, // Commented out for testing
	callController.handleOverdueRescheduledCalls.bind(callController)
);

// Call statistics and reporting - these must come BEFORE parameterized routes
router.get(
	"/stats",
	// authenticateToken, // Commented out for testing
	callController.getCallStats.bind(callController)
);
router.get(
	"/management-stats",
	// authenticateToken, // Commented out for testing
	callController.getCallManagementStats.bind(callController)
);

// Queue routes - must come before parameterized routes
router.get(
	"/queue",
	// authenticateToken,
	callController.getQueuedCalls.bind(callController)
);

router.get(
	"/transferred",
	// authenticateToken, // Commented out for testing
	callController.getTransferredCalls.bind(callController)
);
router.get(
	"/completed",
	// authenticateToken, // Commented out for testing
	callController.getCompletedCalls.bind(callController)
);
router.get(
	"/failed",
	// authenticateToken, // Commented out for testing
	callController.getFailedCalls.bind(callController)
);
router.get(
	"/recent",
	// authenticateToken, // Commented out for testing
	callController.getRecentCalls.bind(callController)
);

// ===== LIVE CALL CONTROL ROUTES =====
// These routes allow real-time control of active calls

// Make the assistant say a specific message during a live call
router.post(
	"/control/:vapiCallId/say",
	// authenticateToken, // Commented out for testing
	callController.sayMessage.bind(callController)
);

// Add a message to the conversation history
router.post(
	"/control/:vapiCallId/conversation",
	// authenticateToken, // Commented out for testing
	callController.addMessageToConversation.bind(callController)
);

// Control assistant behavior (mute/unmute)
router.post(
	"/control/:vapiCallId/assistant",
	// authenticateToken, // Commented out for testing
	callController.controlAssistant.bind(callController)
);

// End the call programmatically
router.post(
	"/control/:vapiCallId/end",
	// authenticateToken, // Commented out for testing
	callController.endCall.bind(callController)
);

// Transfer the call to another number
router.post(
	"/control/:vapiCallId/transfer",
	// authenticateToken, // Commented out for testing
	callController.transferCall.bind(callController)
);

// Get call monitoring URLs for real-time control and audio streaming
router.get(
	"/control/:vapiCallId/monitoring-urls",
	// authenticateToken, // Commented out for testing
	callController.getCallMonitoringUrls.bind(callController)
);

// Maintenance: reconcile stale calls (missed webhooks)
router.post("/reconcile/stale", async (req, res) => {
	try {
		const { lookbackMinutes = 60, batchSize = 100 } = req.body || {};
		const result = await callService.reconcileStaleInitiatedCalls(
			Number(lookbackMinutes),
			Number(batchSize)
		);
		res.json({ success: true, data: result });
	} catch (e: any) {
		res.status(500).json({ success: false, error: e.message });
	}
});

// Call history and details - parameterized routes must come AFTER specific routes
router.get(
	"/lead/:leadId",
	// authenticateToken, // Commented out for testing
	callController.getCallsByLead.bind(callController)
);
router.get(
	"/campaign/:campaignId",
	// authenticateToken, // Commented out for testing
	callController.getCallsByCampaign.bind(callController)
);
router.get(
	"/:id",
	// authenticateToken, // Commented out for testing
	callController.getCallById.bind(callController)
);
router.patch(
	"/:id/notes",
	// authenticateToken, // Commented out for testing
	callController.updateCallNotes.bind(callController)
);

export default router;
