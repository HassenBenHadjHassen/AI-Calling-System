import { Router } from "express";
import { CallController } from "../controllers/callController";
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

// Webhook handling (no auth required for webhooks)
router.post("/webhook", callController.handleWebhook.bind(callController));

// Call statistics and reporting
router.get(
  "/stats",
  authenticateToken,
  callController.getCallStats.bind(callController)
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

// Call history and details
router.get(
  "/:id",
  authenticateToken,
  callController.getCallById.bind(callController)
);
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
router.patch(
  "/:id/notes",
  authenticateToken,
  callController.updateCallNotes.bind(callController)
);

export default router;
