import { Request, Response } from "express";
import {
  startCampaignService,
  stopCampaignService,
  listCampaignsService,
} from "../services/campaignService";

export const startCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await startCampaignService(id);
    res.json({ message: "Campaign started", result });
  } catch (err) {
    res.status(500).json({ error: "Failed to start campaign" });
  }
};

export const stopCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await stopCampaignService(id);
    res.json({ message: "Campaign stopped", result });
  } catch (err) {
    res.status(500).json({ error: "Failed to stop campaign" });
  }
};

export const listCampaigns = async (req: Request, res: Response) => {
  try {
    const campaigns = await listCampaignsService();
    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
};
