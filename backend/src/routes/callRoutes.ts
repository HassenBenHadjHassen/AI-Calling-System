import { Router } from "express";
import { CallController } from "../controllers/callController";
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

// Webhook handling (no auth required for webhooks)
router.post("/webhook", callController.handleWebhook.bind(callController));

// Call statistics and reporting
router.get(
  "/stats",
  // authenticateToken, // Commented out for testing
  callController.getCallStats.bind(callController)
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

// Call history and details
router.get(
  "/:id",
  // authenticateToken, // Commented out for testing
  callController.getCallById.bind(callController)
);
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
router.patch(
  "/:id/notes",
  // authenticateToken, // Commented out for testing
  callController.updateCallNotes.bind(callController)
);

export default router;
