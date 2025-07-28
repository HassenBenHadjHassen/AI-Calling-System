import { PrismaClient, CallHistory, CallStatus } from "@prisma/client";

export class CallRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(callData: {
    leadId: string;
    campaignId?: string;
    callStatus: CallStatus;
    vapiCallId?: string;
    notes?: string;
  }): Promise<CallHistory> {
    return this.prisma.callHistory.create({
      data: callData,
      include: {
        lead: true,
      },
    });
  }

  async findById(id: string): Promise<CallHistory | null> {
    return this.prisma.callHistory.findUnique({
      where: { id },
      include: {
        lead: true,
      },
    });
  }

  async findByVapiCallId(vapiCallId: string): Promise<CallHistory | null> {
    return this.prisma.callHistory.findFirst({
      where: { vapiCallId },
      include: {
        lead: true,
      },
    });
  }

  async findByLeadId(leadId: string): Promise<CallHistory[]> {
    return this.prisma.callHistory.findMany({
      where: { leadId },
      include: {
        lead: true,
      },
      orderBy: {
        callTime: "desc",
      },
    });
  }

  async findByCampaignId(campaignId: string): Promise<CallHistory[]> {
    return this.prisma.callHistory.findMany({
      where: { campaignId },
      include: {
        lead: true,
      },
      orderBy: {
        callTime: "desc",
      },
    });
  }

  async updateStatus(id: string, status: CallStatus): Promise<CallHistory> {
    return this.prisma.callHistory.update({
      where: { id },
      data: { callStatus: status },
      include: {
        lead: true,
      },
    });
  }

  async updateTransfer(
    id: string,
    transferred: boolean,
    transferTo?: string
  ): Promise<CallHistory> {
    return this.prisma.callHistory.update({
      where: { id },
      data: {
        transferred,
        transferTo,
        callStatus: CallStatus.TRANSFERRED,
      },
      include: {
        lead: true,
      },
    });
  }

  async updateDuration(id: string, duration: number): Promise<CallHistory> {
    return this.prisma.callHistory.update({
      where: { id },
      data: { duration },
      include: {
        lead: true,
      },
    });
  }

  async updateNotes(id: string, notes: string): Promise<CallHistory> {
    return this.prisma.callHistory.update({
      where: { id },
      data: { notes },
      include: {
        lead: true,
      },
    });
  }

  async findByStatus(status: CallStatus): Promise<CallHistory[]> {
    return this.prisma.callHistory.findMany({
      where: { callStatus: status },
      include: {
        lead: true,
      },
      orderBy: {
        callTime: "desc",
      },
    });
  }

  async findTransferredCalls(): Promise<CallHistory[]> {
    return this.prisma.callHistory.findMany({
      where: { transferred: true },
      include: {
        lead: true,
      },
      orderBy: {
        callTime: "desc",
      },
    });
  }

  async findCompletedCalls(): Promise<CallHistory[]> {
    return this.prisma.callHistory.findMany({
      where: { callStatus: CallStatus.COMPLETED },
      include: {
        lead: true,
      },
      orderBy: {
        callTime: "desc",
      },
    });
  }

  async findFailedCalls(): Promise<CallHistory[]> {
    return this.prisma.callHistory.findMany({
      where: { callStatus: CallStatus.FAILED },
      include: {
        lead: true,
      },
      orderBy: {
        callTime: "desc",
      },
    });
  }

  async findAll(): Promise<CallHistory[]> {
    return this.prisma.callHistory.findMany({
      include: {
        lead: true,
      },
      orderBy: {
        callTime: "desc",
      },
    });
  }

  async getCallStats(): Promise<{
    total: number;
    completed: number;
    transferred: number;
    failed: number;
    scheduled: number;
  }> {
    const [total, completed, transferred, failed, scheduled] =
      await Promise.all([
        this.prisma.callHistory.count(),
        this.prisma.callHistory.count({
          where: { callStatus: CallStatus.COMPLETED },
        }),
        this.prisma.callHistory.count({ where: { transferred: true } }),
        this.prisma.callHistory.count({
          where: { callStatus: CallStatus.FAILED },
        }),
        this.prisma.callHistory.count({
          where: { callStatus: CallStatus.SCHEDULED },
        }),
      ]);

    return {
      total,
      completed,
      transferred,
      failed,
      scheduled,
    };
  }
}
