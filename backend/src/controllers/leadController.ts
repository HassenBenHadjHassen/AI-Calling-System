import { Request, Response } from "express";
import {
  uploadLeadsService,
  listLeadsService,
  updateLeadStatusService,
} from "../services/leadService";
import { ExcelService } from "../services/excelService";
import { LeadStatus } from "../generated/prisma";
import { AuthRequest } from "../middleware/auth";

export const uploadLeads = async (req: Request, res: Response) => {
  try {
    const leads = req.body.leads;
    if (!Array.isArray(leads)) {
      return res.status(400).json({ error: "Leads must be an array" });
    }
    const result = await uploadLeadsService(leads);
    res.json({ message: "Leads uploaded", result });
  } catch (err) {
    console.error('Error uploading leads:', err);
    res.status(500).json({ error: "Failed to upload leads" });
  }
};

export const uploadLeadsFromFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const fileExtension = req.file.originalname.toLowerCase();
    
    let leads;
    if (fileExtension.endsWith('.csv')) {
      leads = await ExcelService.parseCSVFile(filePath);
    } else {
      leads = await ExcelService.parseExcelFile(filePath);
    }

    if (leads.length === 0) {
      return res.status(400).json({ error: "No valid leads found in file" });
    }

    const result = await uploadLeadsService(leads);
    
    res.json({ 
      message: "Leads uploaded successfully from file", 
      count: leads.length,
      result 
    });
  } catch (err) {
    console.error('Error uploading leads from file:', err);
    res.status(500).json({ 
      error: err instanceof Error ? err.message : "Failed to upload leads from file" 
    });
  }
};

export const listLeads = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    const leads = await listLeadsService({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as LeadStatus,
      search: search as string
    });
    res.json({ leads });
  } catch (err) {
    console.error('Error fetching leads:', err);
    res.status(500).json({ error: "Failed to fetch leads" });
  }
};

export const updateLeadStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!Object.values(LeadStatus).includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const result = await updateLeadStatusService(id, status);
    res.json({ message: "Lead status updated", result });
  } catch (err) {
    console.error('Error updating lead status:', err);
    res.status(500).json({ error: "Failed to update lead status" });
  }
};

export const getLeadStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await listLeadsService({ getStats: true });
    res.json({ stats });
  } catch (err) {
    console.error('Error fetching lead stats:', err);
    res.status(500).json({ error: "Failed to fetch lead statistics" });
  }
};
