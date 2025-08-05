import { Router } from "express";
import { CampaignController } from "../controllers/campaignController";
// import { authenticateToken } from "../middleware/auth"; // Commented out for testing

const router = Router();
const campaignController = new CampaignController();

// Campaign management routes
router.post(
	"/",
	// authenticateToken, // Commented out for testing
	campaignController.createCampaign.bind(campaignController)
);
router.get(
	"/",
	// authenticateToken, // Commented out for testing
	campaignController.getCampaigns.bind(campaignController)
);

// Campaign status and processing - these must come before /:id routes
router.get(
	"/active/current",
	// authenticateToken, // Commented out for testing
	campaignController.getActiveCampaign.bind(campaignController)
);
router.get(
	"/next/process",
	// authenticateToken, // Commented out for testing
	campaignController.getNextCampaignToProcess.bind(campaignController)
);
router.get(
	"/stats/overview",
	// authenticateToken, // Commented out for testing
	campaignController.getCampaignStats.bind(campaignController)
);

// Parameterized routes - these must come after specific routes
router.get(
	"/:id",
	// authenticateToken, // Commented out for testing
	campaignController.getCampaignById.bind(campaignController)
);
router.post(
	"/:id/start",
	// authenticateToken, // Commented out for testing
	campaignController.startCampaign.bind(campaignController)
);
router.post(
	"/:id/stop",
	// authenticateToken, // Commented out for testing
	campaignController.stopCampaign.bind(campaignController)
);
router.post(
	"/:id/complete",
	// authenticateToken, // Commented out for testing
	campaignController.completeCampaign.bind(campaignController)
);
router.delete(
	"/:id",
	// authenticateToken, // Commented out for testing
	campaignController.deleteCampaign.bind(campaignController)
);

// Lead management within campaigns
router.post(
	"/:id/leads",
	// authenticateToken, // Commented out for testing
	campaignController.addLeadsToCampaign.bind(campaignController)
);
router.delete(
	"/:id/leads/:leadId",
	// authenticateToken, // Commented out for testing
	campaignController.removeLeadFromCampaign.bind(campaignController)
);

// Clean all campaigns
router.delete(
	"/clean/all",
	// authenticateToken, // Commented out for testing
	campaignController.cleanAllCampaigns.bind(campaignController)
);

export default router;
