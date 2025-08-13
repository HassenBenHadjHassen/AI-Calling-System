import { Router } from "express";
import { LeadController } from "../controllers/leadController";
// import { authenticateToken } from "../middleware/auth"; // Commented out for testing
import { uploadMiddleware } from "../middleware/upload";

const router = Router();
const leadController = new LeadController();

// Lead management routes - Specific routes first
router.post(
	"/manual",
	// authenticateToken, // Commented out for testing
	leadController.manualLeads.bind(leadController)
);
router.post(
	"/upload",
	// authenticateToken, // Commented out for testing
	uploadMiddleware.single("file"),
	leadController.uploadLeads.bind(leadController)
);

// Scheduled calls routes
router.get(
	"/scheduled/calls",
	// authenticateToken, // Commented out for testing
	leadController.getScheduledCalls.bind(leadController)
);
router.get(
	"/scheduled/due",
	// authenticateToken, // Commented out for testing
	leadController.getDueScheduledCalls.bind(leadController)
);

// Available leads for campaigns
router.get(
	"/available/campaign",
	// authenticateToken, // Commented out for testing
	leadController.getAvailableLeads.bind(leadController)
);

// Cleanup orphaned leads
router.post(
	"/cleanup/orphaned",
	// authenticateToken, // Commented out for testing
	leadController.cleanupOrphanedLeads.bind(leadController)
);

// Get lead statistics
router.get(
	"/statistics",
	// authenticateToken, // Commented out for testing
	leadController.getLeadStatistics.bind(leadController)
);

// Reset leads for testing
router.post(
	"/reset/testing",
	// authenticateToken, // Commented out for testing
	leadController.resetLeadsForTesting.bind(leadController)
);

// Debug lead availability
router.get(
	"/debug/availability",
	// authenticateToken, // Commented out for testing
	leadController.debugLeadAvailability.bind(leadController)
);

// General routes
router.get(
	"/",
	// authenticateToken, // Commented out for testing
	leadController.getLeads.bind(leadController)
);

// Parameterized routes - Must come last
router.get(
	"/:id",
	// authenticateToken, // Commented out for testing
	leadController.getLeadById.bind(leadController)
);
router.patch(
	"/:id/status",
	// authenticateToken, // Commented out for testing
	leadController.updateLeadStatus.bind(leadController)
);
router.put(
	"/:id",
	// authenticateToken, // Commented out for testing
	leadController.updateLead.bind(leadController)
);
router.delete(
	"/:id",
	// authenticateToken, // Commented out for testing
	leadController.deleteLead.bind(leadController)
);
router.post(
	"/delete/batch",
	// authenticateToken, // Commented out for testing
	leadController.deleteLeads.bind(leadController)
);
router.post("/schedule", leadController.scheduleCall.bind(leadController));
router.post("/blacklist", leadController.blacklistLead.bind(leadController));
router.post(
	"/interested",
	leadController.userIsInterested.bind(leadController)
);

// Clean all leads
router.delete(
	"/clean/all",
	// authenticateToken, // Commented out for testing
	leadController.cleanAllLeads.bind(leadController)
);

// Orphaned scheduled calls routes
router.get(
	"/orphaned-scheduled-calls",
	// authenticateToken, // Commented out for testing
	leadController.getOrphanedScheduledCalls.bind(leadController)
);

router.post(
	"/reassign-orphaned-call",
	// authenticateToken, // Commented out for testing
	leadController.reassignOrphanedScheduledCall.bind(leadController)
);

router.get(
	"/orphaned-scheduled-calls/count",
	// authenticateToken, // Commented out for testing
	leadController.getOrphanedScheduledCallsCount.bind(leadController)
);

export default router;
