import { PrismaClient, LeadStatus } from "../generated/prisma";

const prisma = new PrismaClient();

export const createLeads = async (
  leads: { phone: string; name?: string }[]
) => {
  return prisma.lead.createMany({ data: leads });
};

export const getLeads = async () => {
  return prisma.lead.findMany();
};

export const setLeadStatus = async (leadId: string, status: LeadStatus) => {
  return prisma.lead.update({ where: { id: leadId }, data: { status } });
};
