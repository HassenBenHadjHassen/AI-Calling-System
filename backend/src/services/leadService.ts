import {
  createLeads,
  getLeads,
  setLeadStatus,
  getLeadsWithPagination,
  getLeadStats,
} from "../repositories/leadRepository";
import { LeadStatus } from "../generated/prisma";

interface ListLeadsOptions {
  page?: number;
  limit?: number;
  status?: LeadStatus;
  search?: string;
  getStats?: boolean;
}

export const uploadLeadsService = async (
  leads: { phone: string; name?: string; email?: string }[]
) => {
  // Validate and clean leads data
  const validLeads = leads.filter(lead => {
    // Basic phone number validation
    return lead.phone && lead.phone.trim().length > 0;
  }).map(lead => ({
    phone: lead.phone.trim(),
    name: lead.name?.trim() || null,
    email: lead.email?.trim() || null,
  }));

  if (validLeads.length === 0) {
    throw new Error('No valid leads provided');
  }

  return createLeads(validLeads);
};

export const listLeadsService = async (options: ListLeadsOptions = {}) => {
  if (options.getStats) {
    return getLeadStats();
  }

  if (options.page || options.limit || options.status || options.search) {
    return getLeadsWithPagination(options);
  }

  return getLeads();
};

export const updateLeadStatusService = async (
  leadId: string,
  status: LeadStatus
) => {
  return setLeadStatus(leadId, status);
};
