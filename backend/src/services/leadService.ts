import {
  createLeads,
  getLeads,
  setLeadStatus,
} from "../repositories/leadRepository";
import { LeadStatus } from "../generated/prisma";

export const uploadLeadsService = async (
  leads: { phone: string; name?: string }[]
) => {
  return createLeads(leads);
};

export const listLeadsService = async () => {
  return getLeads();
};

export const updateLeadStatusService = async (
  leadId: string,
  status: LeadStatus
) => {
  return setLeadStatus(leadId, status);
};
