import { Request, Response } from "express";
import {
  startCampaignService,
  stopCampaignService,
  listCampaignsService,
  startBatchCallingService,
  getCampaignStatsService,
} from "../services/campaignService";
import { LeadStatus } from "../generated/prisma";

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

// New batch calling functionality
export const startBatchCalling = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      maxConcurrentCalls = 3,
      delayBetweenCalls = 2000,
      filterByStatus
    } = req.body;

    // Validate filterByStatus if provided
    const validStatuses = filterByStatus ? 
      filterByStatus.filter((status: string) => Object.values(LeadStatus).includes(status as LeadStatus)) :
      undefined;

    const result = await startBatchCallingService(id, {
      maxConcurrentCalls,
      delayBetweenCalls,
      filterByStatus: validStatuses
    });

    res.json({
      ...result
    });
  } catch (err) {
    console.error('Error starting batch calling:', err);
    res.status(500).json({ 
      error: "Failed to start batch calling",
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
};

// Get campaign statistics
export const getCampaignStats = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getCampaignStatsService(id);
    res.json(result);
  } catch (err) {
    console.error('Error getting campaign stats:', err);
    res.status(500).json({ 
      error: "Failed to get campaign statistics",
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
};
