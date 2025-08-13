import { Router } from "express";
import { CallController } from "../controllers/callController";
import { callService } from "../services/callService";
import { authenticateToken } from "../middleware/auth";

const router = Router();
const callController = new CallController();

// Call triggering routes
router.post(
	"/trigger/:leadId",
	authenticateToken,
	callController.triggerCall.bind(callController)
);
router.post(
	"/trigger/scheduled",
	authenticateToken,
	callController.triggerScheduledCalls.bind(callController)
);
router.post(
	"/trigger/campaign/:campaignId",
	authenticateToken,
	callController.triggerCampaignCalls.bind(callController)
);
router.post(
	"/trigger/overdue",
	authenticateToken,
	callController.handleOverdueRescheduledCalls.bind(callController)
);

// Call statistics and reporting - these must come BEFORE parameterized routes
router.get(
	"/stats",
	authenticateToken,
	callController.getCallStats.bind(callController)
);
router.get(
	"/management-stats",
	authenticateToken,
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
	authenticateToken,
	callController.getTransferredCalls.bind(callController)
);
router.get(
	"/completed",
	authenticateToken,
	callController.getCompletedCalls.bind(callController)
);
router.get(
	"/failed",
	authenticateToken,
	callController.getFailedCalls.bind(callController)
);
router.get(
	"/recent",
	authenticateToken,
	callController.getRecentCalls.bind(callController)
);

// ===== LIVE CALL CONTROL ROUTES =====
// These routes allow real-time control of active calls

// Make the assistant say a specific message during a live call
router.post(
	"/control/:vapiCallId/say",
	authenticateToken,
	callController.sayMessage.bind(callController)
);

// Add a message to the conversation history
router.post(
	"/control/:vapiCallId/conversation",
	authenticateToken,
	callController.addMessageToConversation.bind(callController)
);

// Control assistant behavior (mute/unmute)
router.post(
	"/control/:vapiCallId/assistant",
	authenticateToken,
	callController.controlAssistant.bind(callController)
);

// End the call programmatically
router.post(
	"/control/:vapiCallId/end",
	authenticateToken,
	callController.endCall.bind(callController)
);

// Transfer the call to another number
router.post(
	"/control/:vapiCallId/transfer",
	authenticateToken,
	callController.transferCall.bind(callController)
);

// Get call monitoring URLs for real-time control and audio streaming
router.get(
	"/control/:vapiCallId/monitoring-urls",
	authenticateToken,
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
	authenticateToken,
	callController.getCallsByLead.bind(callController)
);
router.get(
	"/campaign/:campaignId",
	authenticateToken,
	callController.getCallsByCampaign.bind(callController)
);
router.get(
	"/:id",
	authenticateToken,
	callController.getCallById.bind(callController)
);
router.patch(
	"/:id/notes",
	authenticateToken,
	callController.updateCallNotes.bind(callController)
);

export default router;
