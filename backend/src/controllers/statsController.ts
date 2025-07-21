import { Request, Response } from "express";
import { PrismaClient, CallStatus } from "../generated/prisma";

const prisma = new PrismaClient();

export const getStats = async (req: Request, res: Response) => {
  try {
    const totalCalls = await prisma.callHistory.count();
    const successful = await prisma.callHistory.count({
      where: { status: CallStatus.COMPLETED },
    });
    const transfers = await prisma.callHistory.count({
      where: { status: CallStatus.TRANSFERRED },
    });
    const conversionRate = totalCalls > 0 ? (transfers / totalCalls) * 100 : 0;
    res.json({ calls: totalCalls, successful, transfers, conversionRate });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};
