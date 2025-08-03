import { PrismaClient, Campaign, CampaignStatus } from "@prisma/client";

export class CampaignRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(campaignData: {
    name: string;
    status?: CampaignStatus;
  }): Promise<Campaign> {
    return this.prisma.campaign.create({
      data: campaignData,
      include: {
        leads: true,
      },
    });
  }

  async findById(id: string): Promise<Campaign | null> {
    return this.prisma.campaign.findUnique({
      where: { id },
      include: {
        leads: true,
      },
    });
  }

  async findActive(): Promise<Campaign | null> {
    return this.prisma.campaign.findFirst({
      where: { status: CampaignStatus.ACTIVE },
      include: {
        leads: true,
      },
    });
  }

  async findNextAvailable(): Promise<Campaign | null> {
    return this.prisma.campaign.findFirst({
      where: {
        status: CampaignStatus.ACTIVE,
        leads: {
          none: {}, // Campaign with no leads
        },
      },
      include: {
        leads: true,
      },
    });
  }

  async start(id: string): Promise<Campaign> {
    // Stop any other active campaign first
    await this.prisma.campaign.updateMany({
      where: { status: CampaignStatus.ACTIVE },
      data: { status: CampaignStatus.STOPPED },
    });

    return this.prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.ACTIVE,
        startedAt: new Date(),
      },
      include: {
        leads: true,
      },
    });
  }

  async stop(id: string): Promise<Campaign> {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.STOPPED,
        stoppedAt: new Date(),
      },
      include: {
        leads: true,
      },
    });
  }

  async complete(id: string): Promise<Campaign> {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.COMPLETED,
        stoppedAt: new Date(),
      },
      include: {
        leads: true,
      },
    });
  }

  async addLeads(campaignId: string, leadIds: string[]): Promise<Campaign> {
    // Update leads to assign them to this campaign
    await this.prisma.lead.updateMany({
      where: { id: { in: leadIds } },
      data: { campaignId },
    });

    return this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        leads: true,
      },
    }) as Promise<Campaign>;
  }

  async removeLead(campaignId: string, leadId: string): Promise<Campaign> {
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { campaignId: null },
    });

    return this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        leads: true,
      },
    }) as Promise<Campaign>;
  }

  async removeLeadByPhone(campaignId: string, phone: string): Promise<Campaign> {
    await this.prisma.lead.updateMany({
      where: {
        campaignId,
        OR: [{ phone1: phone }, { phone2: phone }],
      },
      data: { campaignId: null },
    });

    return this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        leads: true,
      },
    }) as Promise<Campaign>;
  }

  async findByStatus(status: CampaignStatus): Promise<Campaign[]> {
    return this.prisma.campaign.findMany({
      where: { status },
      include: {
        leads: true,
      },
    });
  }

  async findAll(): Promise<Campaign[]> {
    return this.prisma.campaign.findMany({
      include: {
        leads: true,
      },
    });
  }

  async delete(id: string): Promise<void> {
    // Remove all leads from this campaign first
    await this.prisma.lead.updateMany({
      where: { campaignId: id },
      data: { campaignId: null },
    });

    await this.prisma.campaign.delete({
      where: { id },
    });
  }
}
