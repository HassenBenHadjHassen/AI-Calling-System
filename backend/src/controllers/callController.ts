import { Request, Response } from "express";
import { CallService } from "../services/callService";

export class CallController {
  private callService: CallService;

  constructor() {
    this.callService = new CallService();
  }

  async triggerCall(req: Request, res: Response): Promise<void> {
    try {
      const { leadId, title } = req.params;
      const result = await this.callService.triggerCall(leadId, title);

      res.status(200).json({
        message: "Call triggered successfully",
        data: result,
      });
    } catch (error: any) {
      console.error("Error triggering call:", error);
      res.status(500).json({
        error: "Failed to trigger call",
        message: error.message,
      });
    }
  }

  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const webhookData = req.body;
      await this.callService.handleWebhook(webhookData);

      res.status(200).json({
        message: "Webhook processed successfully",
      });
    } catch (error: any) {
      console.error("Error processing webhook:", error);
      res.status(500).json({
        error: "Failed to process webhook",
        message: error.message,
      });
    }
  }

  async triggerScheduledCalls(req: Request, res: Response): Promise<void> {
    try {
      const { title } = req.params;
      const triggeredCalls = await this.callService.triggerScheduledCalls(
        title
      );

      res.status(200).json({
        message: "Scheduled calls triggered successfully",
        data: {
          triggeredCount: triggeredCalls.length,
          calls: triggeredCalls,
        },
      });
    } catch (error: any) {
      console.error("Error triggering scheduled calls:", error);
      res.status(500).json({
        error: "Failed to trigger scheduled calls",
        message: error.message,
      });
    }
  }

  async triggerCampaignCalls(req: Request, res: Response): Promise<void> {
    try {
      const { campaignId, title } = req.params;
      const triggeredCalls = await this.callService.triggerCampaignCalls(
        campaignId,
        title
      );

      res.status(200).json({
        message: "Campaign calls triggered successfully",
        data: {
          triggeredCount: triggeredCalls.length,
          calls: triggeredCalls,
        },
      });
    } catch (error: any) {
      console.error("Error triggering campaign calls:", error);
      res.status(500).json({
        error: "Failed to trigger campaign calls",
        message: error.message,
      });
    }
  }

  async getCallStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.callService.getCallStats();

      res.status(200).json({
        data: stats,
      });
    } catch (error: any) {
      console.error("Error fetching call stats:", error);
      res.status(500).json({
        error: "Failed to fetch call stats",
        message: error.message,
      });
    }
  }

  async getCallsByLead(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;
      const calls = await this.callService.getCallsByLead(leadId);

      res.status(200).json({
        data: calls,
      });
    } catch (error: any) {
      console.error("Error fetching calls by lead:", error);
      res.status(500).json({
        error: "Failed to fetch calls by lead",
        message: error.message,
      });
    }
  }

  async getCallsByCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { campaignId } = req.params;
      const calls = await this.callService.getCallsByCampaign(campaignId);

      res.status(200).json({
        data: calls,
      });
    } catch (error: any) {
      console.error("Error fetching calls by campaign:", error);
      res.status(500).json({
        error: "Failed to fetch calls by campaign",
        message: error.message,
      });
    }
  }

  async getTransferredCalls(req: Request, res: Response): Promise<void> {
    try {
      const calls = await this.callService.getTransferredCalls();

      res.status(200).json({
        data: calls,
      });
    } catch (error: any) {
      console.error("Error fetching transferred calls:", error);
      res.status(500).json({
        error: "Failed to fetch transferred calls",
        message: error.message,
      });
    }
  }

  async getCompletedCalls(req: Request, res: Response): Promise<void> {
    try {
      const calls = await this.callService.getCompletedCalls();

      res.status(200).json({
        data: calls,
      });
    } catch (error: any) {
      console.error("Error fetching completed calls:", error);
      res.status(500).json({
        error: "Failed to fetch completed calls",
        message: error.message,
      });
    }
  }

  async getFailedCalls(req: Request, res: Response): Promise<void> {
    try {
      const calls = await this.callService.getFailedCalls();

      res.status(200).json({
        data: calls,
      });
    } catch (error: any) {
      console.error("Error fetching failed calls:", error);
      res.status(500).json({
        error: "Failed to fetch failed calls",
        message: error.message,
      });
    }
  }

  async updateCallNotes(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      if (!notes) {
        res.status(400).json({ error: "Notes are required" });
        return;
      }

      const call = await this.callService.updateCallNotes(id, notes);

      res.status(200).json({
        message: "Call notes updated successfully",
        data: call,
      });
    } catch (error: any) {
      console.error("Error updating call notes:", error);
      res.status(500).json({
        error: "Failed to update call notes",
        message: error.message,
      });
    }
  }

  async getCallById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const call = await this.callService.getCallById(id);

      if (!call) {
        res.status(404).json({ error: "Call not found" });
        return;
      }

      res.status(200).json({
        data: call,
      });
    } catch (error: any) {
      console.error("Error fetching call:", error);
      res.status(500).json({
        error: "Failed to fetch call",
        message: error.message,
      });
    }
  }
}
