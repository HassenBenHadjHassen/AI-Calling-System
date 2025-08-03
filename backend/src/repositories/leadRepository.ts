import {
  PrismaClient,
  Lead,
  LeadStatus,
  ScheduledCallStatus,
} from "@prisma/client";

export class LeadRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(leadData: {
    name: string;
    address?: string;
    postalCode?: string;
    city?: string;
    phone1: string;
    phone2?: string;
    campaignId?: string;
  }): Promise<Lead> {
    return this.prisma.lead.create({
      data: leadData,
    });
  }

  async findById(id: string): Promise<Lead | null> {
    return this.prisma.lead.findUnique({
      where: { id },
      include: {
        callHistory: true,
        campaign: true,
      },
    });
  }

  async findByPhone(phone: string): Promise<Lead | null> {
    return this.prisma.lead.findFirst({
      where: {
        OR: [{ phone1: phone }, { phone2: phone }],
      },
      include: {
        callHistory: true,
        campaign: true,
      },
    });
  }

  async updateStatus(id: string, status: LeadStatus): Promise<Lead> {
    return this.prisma.lead.update({
      where: { id },
      data: { status },
    });
  }

  async updateScheduledCall(
    id: string,
    scheduledCallAt: Date,
    note?: string
  ): Promise<Lead> {
    return this.prisma.lead.update({
      where: { id },
      data: {
        scheduledCallAt,
        scheduledCallNote: note,
        scheduledCallStatus: ScheduledCallStatus.PENDING,
        status: LeadStatus.SCHEDULED,
      },
    });
  }

  async updateScheduledCallByPhone(
    phone: string,
    scheduledCallAt: Date,
    note?: string
  ): Promise<Lead> {
    const lead = await this.findByPhone(phone);
    if (!lead) {
      throw new Error("Lead not found");
    }

    return this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        scheduledCallAt,
        scheduledCallNote: note,
        scheduledCallStatus: ScheduledCallStatus.PENDING,
        status: LeadStatus.SCHEDULED,
      },
    });
  }

  async blacklist(id: string): Promise<Lead> {
    return this.prisma.lead.update({
      where: { id },
      data: {
        blacklisted: true,
        status: LeadStatus.BLACKLISTED,
      },
    });
  }

  async blacklistByPhone(phone: string): Promise<Lead> {
    const lead = await this.findByPhone(phone);
    if (!lead) {
      throw new Error("Lead not found");
    }

    return this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        blacklisted: true,
        status: LeadStatus.BLACKLISTED,
      },
    });
  }

  async findByStatus(status: LeadStatus): Promise<Lead[]> {
    return this.prisma.lead.findMany({
      where: { status },
      include: {
        callHistory: true,
        campaign: true,
      },
    });
  }

  async findScheduledCalls(): Promise<Lead[]> {
    return this.prisma.lead.findMany({
      where: {
        scheduledCallAt: { not: null },
        scheduledCallStatus: ScheduledCallStatus.PENDING,
        blacklisted: false,
      },
      include: {
        callHistory: true,
        campaign: true,
      },
    });
  }

  async findDueScheduledCalls(): Promise<Lead[]> {
    return this.prisma.lead.findMany({
      where: {
        scheduledCallAt: { lte: new Date() },
        scheduledCallStatus: ScheduledCallStatus.PENDING,
        blacklisted: false,
      },
      include: {
        callHistory: true,
        campaign: true,
      },
    });
  }

  async findAvailableForCampaign(): Promise<Lead[]> {
    return this.prisma.lead.findMany({
      where: {
        status: LeadStatus.NEW,
        blacklisted: false,
        scheduledCallAt: null,
      },
      include: {
        callHistory: true,
        campaign: true,
      },
    });
  }

  async updateCampaign(id: string, campaignId: string | null): Promise<Lead> {
    return this.prisma.lead.update({
      where: { id },
      data: { campaignId },
    });
  }

  async findAll(): Promise<Lead[]> {
    return this.prisma.lead.findMany({
      include: {
        callHistory: true,
        campaign: true,
      },
    });
  }
}
