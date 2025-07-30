import { Router } from "express";
import { LeadController } from "../controllers/leadController";
import { authenticateToken } from "../middleware/auth";
import { uploadMiddleware } from "../middleware/upload";

const router = Router();
const leadController = new LeadController();

// Lead management routes - Specific routes first
router.post(
  "/manual",
  authenticateToken,
  leadController.manualLeads.bind(leadController)
);
router.post(
  "/upload",
  authenticateToken,
  uploadMiddleware.single("file"),
  leadController.uploadLeads.bind(leadController)
);

// Scheduled calls routes
router.get(
  "/scheduled/calls",
  authenticateToken,
  leadController.getScheduledCalls.bind(leadController)
);
router.get(
  "/scheduled/due",
  authenticateToken,
  leadController.getDueScheduledCalls.bind(leadController)
);

// Available leads for campaigns
router.get(
  "/available/campaign",
  authenticateToken,
  leadController.getAvailableLeads.bind(leadController)
);

// General routes
router.get(
  "/",
  authenticateToken,
  leadController.getLeads.bind(leadController)
);

// Parameterized routes - Must come last
router.get(
  "/:id",
  authenticateToken,
  leadController.getLeadById.bind(leadController)
);
router.patch(
  "/:id/status",
  authenticateToken,
  leadController.updateLeadStatus.bind(leadController)
);
router.post("/schedule", leadController.scheduleCall.bind(leadController));
router.post("/blacklist", leadController.blacklistLead.bind(leadController));

export default router;
