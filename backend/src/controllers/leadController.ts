import { Request, Response } from "express";
import { LeadService } from "../services/leadService";
import { LeadStatus } from "@prisma/client";

export class LeadController {
  private leadService: LeadService;

  constructor() {
    this.leadService = new LeadService();
  }

  async manualLeads(req: Request, res: Response): Promise<void> {
    try {
      const { name, phone1, phone2, address, postalCode, city } = req.body;

      if (!name || !phone1) {
        res.status(400).json({ error: "Name and phone1 are required" });
        return;
      }

      const lead = await this.leadService.createManualLead(
        name,
        phone1,
        phone2,
        address,
        postalCode,
        city
      );

      res.status(201).json({
        message: "Lead created successfully",
        data: lead,
      });
    } catch (error: any) {
      console.error("Error creating manual lead:", error);
      res.status(500).json({
        error: "Failed to create lead",
        message: error.message,
      });
    }
  }

  async uploadLeads(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const result = await this.leadService.uploadLeadsFromFile(req.file.path);

      res.status(200).json({
        message: "Leads uploaded successfully",
        data: result,
      });
    } catch (error: any) {
      console.error("Error uploading leads:", error);
      res.status(500).json({
        error: "Failed to upload leads",
        message: error.message,
      });
    }
  }

  async getLeads(req: Request, res: Response): Promise<void> {
    try {
      const status = req.query.status as LeadStatus;
      const leads = await this.leadService.getLeadsByStatus(status);

      res.status(200).json({
        data: leads,
      });
    } catch (error: any) {
      console.error("Error fetching leads:", error);
      res.status(500).json({
        error: "Failed to fetch leads",
        message: error.message,
      });
    }
  }

  async getLeadById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const lead = await this.leadService.getLeadById(id);

      if (!lead) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }

      res.status(200).json({
        data: lead,
      });
    } catch (error: any) {
      console.error("Error fetching lead:", error);
      res.status(500).json({
        error: "Failed to fetch lead",
        message: error.message,
      });
    }
  }

  async updateLeadStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !Object.values(LeadStatus).includes(status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }

      const lead = await this.leadService.updateLeadStatus(id, status);

      res.status(200).json({
        message: "Lead status updated successfully",
        data: lead,
      });
    } catch (error: any) {
      console.error("Error updating lead status:", error);
      res.status(500).json({
        error: "Failed to update lead status",
        message: error.message,
      });
    }
  }

  async scheduleCall(req: Request, res: Response): Promise<void> {
    try {
      const { leadId, scheduledCallAt, note } = req.body;

      console.log(leadId, scheduledCallAt, note);

      if (!scheduledCallAt) {
        res.status(400).json({ error: "Scheduled call time is required" });
        return;
      }

      const scheduledDate = new Date(scheduledCallAt);
      if (isNaN(scheduledDate.getTime())) {
        res.status(400).json({ error: "Invalid date format" });
        return;
      }

      const lead = await this.leadService.scheduleCall(
        leadId,
        scheduledDate,
        note
      );

      res.status(200).json({
        message: "Call scheduled successfully",
        data: lead,
      });
    } catch (error: any) {
      console.error("Error scheduling call:", error);
      res.status(500).json({
        error: "Failed to schedule call",
        message: error.message,
      });
    }
  }

  async blacklistLead(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.body;
      const lead = await this.leadService.blacklistLead(leadId);

      res.status(200).json({
        message: "Lead blacklisted successfully",
        data: lead,
      });
    } catch (error: any) {
      console.error("Error blacklisting lead:", error);
      res.status(500).json({
        error: "Failed to blacklist lead",
        message: error.message,
      });
    }
  }

  async getScheduledCalls(req: Request, res: Response): Promise<void> {
    try {
      const scheduledCalls = await this.leadService.getScheduledCalls();

      res.status(200).json({
        data: scheduledCalls,
      });
    } catch (error: any) {
      console.error("Error fetching scheduled calls:", error);
      res.status(500).json({
        error: "Failed to fetch scheduled calls",
        message: error.message,
      });
    }
  }

  async getDueScheduledCalls(req: Request, res: Response): Promise<void> {
    try {
      const dueCalls = await this.leadService.getDueScheduledCalls();

      res.status(200).json({
        data: dueCalls,
      });
    } catch (error: any) {
      console.error("Error fetching due scheduled calls:", error);
      res.status(500).json({
        error: "Failed to fetch due scheduled calls",
        message: error.message,
      });
    }
  }

  async getAvailableLeads(req: Request, res: Response): Promise<void> {
    try {
      const availableLeads =
        await this.leadService.getAvailableLeadsForCampaign();

      res.status(200).json({
        data: availableLeads,
      });
    } catch (error: any) {
      console.error("Error fetching available leads:", error);
      res.status(500).json({
        error: "Failed to fetch available leads",
        message: error.message,
      });
    }
  }
}
