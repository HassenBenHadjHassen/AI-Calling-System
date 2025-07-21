import { Router } from "express";
import {
  startCampaign,
  stopCampaign,
  listCampaigns,
} from "../controllers/campaignController";

const router = Router();

router.post("/:id/start", startCampaign);
router.post("/:id/stop", stopCampaign);
router.get("/", listCampaigns);

export default router;
