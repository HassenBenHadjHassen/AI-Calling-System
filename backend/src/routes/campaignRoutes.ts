import { Router } from "express";
import { CampaignController } from "../controllers/campaignController";
import { authenticateToken } from "../middleware/auth";

const router = Router();
const campaignController = new CampaignController();

// Campaign management routes
router.post(
  "/",
  authenticateToken,
  campaignController.createCampaign.bind(campaignController)
);
router.get(
  "/",
  authenticateToken,
  campaignController.getCampaigns.bind(campaignController)
);
router.get(
  "/:id",
  authenticateToken,
  campaignController.getCampaignById.bind(campaignController)
);
router.post(
  "/:id/start",
  authenticateToken,
  campaignController.startCampaign.bind(campaignController)
);
router.post(
  "/:id/stop",
  authenticateToken,
  campaignController.stopCampaign.bind(campaignController)
);
router.post(
  "/:id/complete",
  authenticateToken,
  campaignController.completeCampaign.bind(campaignController)
);
router.delete(
  "/:id",
  authenticateToken,
  campaignController.deleteCampaign.bind(campaignController)
);

// Lead management within campaigns
router.post(
  "/:id/leads",
  authenticateToken,
  campaignController.addLeadsToCampaign.bind(campaignController)
);
router.delete(
  "/:id/leads/:leadId",
  authenticateToken,
  campaignController.removeLeadFromCampaign.bind(campaignController)
);

// Campaign status and processing
router.get(
  "/active/current",
  authenticateToken,
  campaignController.getActiveCampaign.bind(campaignController)
);
router.get(
  "/next/process",
  authenticateToken,
  campaignController.getNextCampaignToProcess.bind(campaignController)
);
router.get(
  "/stats/overview",
  authenticateToken,
  campaignController.getCampaignStats.bind(campaignController)
);

export default router;
