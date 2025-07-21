import { Request, Response } from "express";
import {
  uploadLeadsService,
  listLeadsService,
  updateLeadStatusService,
} from "../services/leadService";
import { LeadStatus } from "../generated/prisma";

export const uploadLeads = async (req: Request, res: Response) => {
  try {
    const leads = req.body.leads;
    if (!Array.isArray(leads)) {
      return res.status(400).json({ error: "Leads must be an array" });
    }
    const result = await uploadLeadsService(leads);
    res.json({ message: "Leads uploaded", result });
  } catch (err) {
    res.status(500).json({ error: "Failed to upload leads" });
  }
};

export const listLeads = async (req: Request, res: Response) => {
  try {
    const leads = await listLeadsService();
    res.json({ leads });
  } catch (err) {
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
    res.status(500).json({ error: "Failed to update lead status" });
  }
};
