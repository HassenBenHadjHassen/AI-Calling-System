import { Request, Response } from "express";
import { CampaignService } from "../services/campaignService";
import { CampaignStatus } from "@prisma/client";

export class CampaignController {
  private campaignService: CampaignService;

  constructor() {
    this.campaignService = new CampaignService();
  }

  async createCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.body;

      if (!name) {
        res.status(400).json({ error: "Campaign name is required" });
        return;
      }

      const campaign = await this.campaignService.createCampaign(name);

      res.status(201).json({
        message: "Campaign created successfully",
        data: campaign,
      });
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      res.status(500).json({
        error: "Failed to create campaign",
        message: error.message,
      });
    }
  }

  async getCampaigns(req: Request, res: Response): Promise<void> {
    try {
      const status = req.query.status as CampaignStatus;
      const campaigns = status
        ? await this.campaignService.getCampaignsByStatus(status)
        : await this.campaignService.getAllCampaigns();

      res.status(200).json({
        data: campaigns,
      });
    } catch (error: any) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({
        error: "Failed to fetch campaigns",
        message: error.message,
      });
    }
  }

  async getCampaignById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const campaign = await this.campaignService.getCampaignById(id);

      if (!campaign) {
        res.status(404).json({ error: "Campaign not found" });
        return;
      }

      res.status(200).json({
        data: campaign,
      });
    } catch (error: any) {
      console.error("Error fetching campaign:", error);
      res.status(500).json({
        error: "Failed to fetch campaign",
        message: error.message,
      });
    }
  }

  async startCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const campaign = await this.campaignService.startCampaign(id);

      res.status(200).json({
        message: "Campaign started successfully",
        data: campaign,
      });
    } catch (error: any) {
      console.error("Error starting campaign:", error);
      res.status(500).json({
        error: "Failed to start campaign",
        message: error.message,
      });
    }
  }

  async stopCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const campaign = await this.campaignService.stopCampaign(id);

      res.status(200).json({
        message: "Campaign stopped successfully",
        data: campaign,
      });
    } catch (error: any) {
      console.error("Error stopping campaign:", error);
      res.status(500).json({
        error: "Failed to stop campaign",
        message: error.message,
      });
    }
  }

  async completeCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const campaign = await this.campaignService.completeCampaign(id);

      res.status(200).json({
        message: "Campaign completed successfully",
        data: campaign,
      });
    } catch (error: any) {
      console.error("Error completing campaign:", error);
      res.status(500).json({
        error: "Failed to complete campaign",
        message: error.message,
      });
    }
  }

  async deleteCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.campaignService.deleteCampaign(id);

      res.status(200).json({
        message: "Campaign deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({
        error: "Failed to delete campaign",
        message: error.message,
      });
    }
  }

  async addLeadsToCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { leadIds } = req.body;

      if (!leadIds || !Array.isArray(leadIds)) {
        res.status(400).json({ error: "Lead IDs array is required" });
        return;
      }

      const campaign = await this.campaignService.addLeadsToCampaign(
        id,
        leadIds
      );

      res.status(200).json({
        message: "Leads added to campaign successfully",
        data: campaign,
      });
    } catch (error: any) {
      console.error("Error adding leads to campaign:", error);
      res.status(500).json({
        error: "Failed to add leads to campaign",
        message: error.message,
      });
    }
  }

  async removeLeadFromCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id, leadId } = req.params;
      const campaign = await this.campaignService.removeLeadFromCampaign(
        id,
        leadId
      );

      res.status(200).json({
        message: "Lead removed from campaign successfully",
        data: campaign,
      });
    } catch (error: any) {
      console.error("Error removing lead from campaign:", error);
      res.status(500).json({
        error: "Failed to remove lead from campaign",
        message: error.message,
      });
    }
  }

  async getActiveCampaign(req: Request, res: Response): Promise<void> {
    try {
      const campaign = await this.campaignService.getActiveCampaign();

      res.status(200).json({
        data: campaign,
      });
    } catch (error: any) {
      console.error("Error fetching active campaign:", error);
      res.status(500).json({
        error: "Failed to fetch active campaign",
        message: error.message,
      });
    }
  }

  async getNextCampaignToProcess(req: Request, res: Response): Promise<void> {
    try {
      const campaign = await this.campaignService.getNextCampaignToProcess();

      res.status(200).json({
        data: campaign,
      });
    } catch (error: any) {
      console.error("Error fetching next campaign to process:", error);
      res.status(500).json({
        error: "Failed to fetch next campaign to process",
        message: error.message,
      });
    }
  }

  async getCampaignStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.campaignService.getCampaignStats();

      res.status(200).json({
        data: stats,
      });
    } catch (error: any) {
      console.error("Error fetching campaign stats:", error);
      res.status(500).json({
        error: "Failed to fetch campaign stats",
        message: error.message,
      });
    }
  }
}
