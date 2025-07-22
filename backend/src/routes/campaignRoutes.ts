import { Router } from "express";
import {
  startCampaign,
  stopCampaign,
  listCampaigns,
  startBatchCalling,
  getCampaignStats,
} from "../controllers/campaignController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Campaign management
router.post("/:id/start", authenticateToken, startCampaign);
router.post("/:id/stop", authenticateToken, stopCampaign);
router.get("/", authenticateToken, listCampaigns);

// Batch calling functionality
router.post("/:id/batch-call", authenticateToken, startBatchCalling);
router.get("/:id/stats", authenticateToken, getCampaignStats);

export default router;
