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

// Cleanup orphaned leads
router.post(
	"/cleanup/orphaned",
	authenticateToken,
	leadController.cleanupOrphanedLeads.bind(leadController)
);

// Get lead statistics
router.get(
	"/statistics",
	authenticateToken,
	leadController.getLeadStatistics.bind(leadController)
);

// Reset leads for testing
router.post(
	"/reset/testing",
	authenticateToken,
	leadController.resetLeadsForTesting.bind(leadController)
);

// Debug lead availability
router.get(
	"/debug/availability",
	authenticateToken,
	leadController.debugLeadAvailability.bind(leadController)
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
router.put(
	"/:id",
	authenticateToken,
	leadController.updateLead.bind(leadController)
);
router.delete(
	"/:id",
	authenticateToken,
	leadController.deleteLead.bind(leadController)
);
router.post(
	"/delete/batch",
	authenticateToken,
	leadController.deleteLeads.bind(leadController)
);
router.post("/schedule", leadController.scheduleCall.bind(leadController));
router.post("/blacklist", leadController.blacklistLead.bind(leadController));

// Clean all leads
router.delete(
	"/clean/all",
	authenticateToken,
	leadController.cleanAllLeads.bind(leadController)
);

// Orphaned scheduled calls routes
router.get(
	"/orphaned-scheduled-calls",
	authenticateToken,
	leadController.getOrphanedScheduledCalls.bind(leadController)
);

router.post(
	"/reassign-orphaned-call",
	authenticateToken,
	leadController.reassignOrphanedScheduledCall.bind(leadController)
);

router.get(
	"/orphaned-scheduled-calls/count",
	authenticateToken,
	leadController.getOrphanedScheduledCallsCount.bind(leadController)
);

export default router;
