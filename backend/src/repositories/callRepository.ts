import { PrismaClient, CallStatus } from "../generated/prisma";

const prisma = new PrismaClient();

interface CreateCallHistoryData {
  leadId: string;
  campaignId?: string;
  status: CallStatus;
  startedAt: Date;
  vapiCallId?: string;
}

export const createCallHistory = async (callData: CreateCallHistoryData) => {
  return prisma.callHistory.create({ data: callData });
};

export const updateCallHistory = async (callId: string, updateData: any) => {
  return prisma.callHistory.update({ 
    where: { id: callId }, 
    data: updateData 
  });
};

// Legacy function for backward compatibility
export const logCall = async (callData: any) => {
  return prisma.callHistory.create({ data: callData });
};

// Legacy function for backward compatibility
export const updateCallStatus = async (callId: string, status: CallStatus) => {
  return prisma.callHistory.update({ where: { id: callId }, data: { status } });
};

export const getCallHistory = async (callId: string) => {
  return prisma.callHistory.findUnique({ where: { id: callId } });
};

export const getCallHistoryByLead = async (leadId: string) => {
  return prisma.callHistory.findMany({ 
    where: { leadId },
    orderBy: { createdAt: 'desc' }
  });
};
