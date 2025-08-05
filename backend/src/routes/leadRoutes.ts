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
router.post("/schedule", leadController.scheduleCall.bind(leadController));
router.post("/blacklist", leadController.blacklistLead.bind(leadController));

// Clean all leads
router.delete(
	"/clean/all",
	// authenticateToken, // Commented out for testing
	leadController.cleanAllLeads.bind(leadController)
);

export default router;
