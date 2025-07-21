import { PrismaClient, CallStatus } from "../generated/prisma";

const prisma = new PrismaClient();

export const logCall = async (callData: any) => {
  return prisma.callHistory.create({ data: callData });
};

export const updateCallStatus = async (callId: string, status: CallStatus) => {
  return prisma.callHistory.update({ where: { id: callId }, data: { status } });
};
