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
		try {
			return await this.prisma.campaign.create({
				data: campaignData,
				include: {
					leads: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to create campaign: ${error.message}`);
		}
	}

	async findById(id: string): Promise<Campaign | null> {
		try {
			return await this.prisma.campaign.findUnique({
				where: { id },
				include: {
					leads: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find campaign by ID: ${error.message}`);
		}
	}

	async findActive(): Promise<Campaign | null> {
		try {
			return await this.prisma.campaign.findFirst({
				where: { status: CampaignStatus.ACTIVE },
				include: {
					leads: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find active campaign: ${error.message}`);
		}
	}

	async findAllActive(): Promise<Campaign[]> {
		try {
			return await this.prisma.campaign.findMany({
				where: { status: CampaignStatus.ACTIVE },
				include: {
					leads: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find active campaigns: ${error.message}`);
		}
	}

	async findNextAvailable(): Promise<Campaign | null> {
		try {
			return await this.prisma.campaign.findFirst({
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
		} catch (error: any) {
			throw new Error(
				`Failed to find next available campaign: ${error.message}`
			);
		}
	}

	async start(id: string): Promise<Campaign> {
		try {
			return await this.prisma.campaign.update({
				where: { id },
				data: {
					status: CampaignStatus.ACTIVE,
					startedAt: new Date(),
				},
				include: {
					leads: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to start campaign: ${error.message}`);
		}
	}

	async stop(id: string): Promise<Campaign> {
		try {
			return await this.prisma.campaign.update({
				where: { id },
				data: {
					status: CampaignStatus.STOPPED,
					stoppedAt: new Date(),
				},
				include: {
					leads: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to stop campaign: ${error.message}`);
		}
	}

	async complete(id: string): Promise<Campaign> {
		try {
			return await this.prisma.campaign.update({
				where: { id },
				data: {
					status: CampaignStatus.COMPLETED,
					stoppedAt: new Date(),
				},
				include: {
					leads: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to complete campaign: ${error.message}`);
		}
	}

	async addLeads(campaignId: string, leadIds: string[]): Promise<Campaign> {
		try {
			// Update leads to assign them to this campaign
			await this.prisma.lead.updateMany({
				where: { id: { in: leadIds } },
				data: { campaignId },
			});

			const campaign = await this.prisma.campaign.findUnique({
				where: { id: campaignId },
				include: {
					leads: true,
				},
			});
			if (!campaign) {
				throw new Error("Campaign not found");
			}
			return campaign;
		} catch (error: any) {
			throw new Error(`Failed to add leads to campaign: ${error.message}`);
		}
	}

	async removeLead(campaignId: string, leadId: string): Promise<Campaign> {
		try {
			await this.prisma.lead.update({
				where: { id: leadId },
				data: { campaignId: null },
			});

			const campaign = await this.prisma.campaign.findUnique({
				where: { id: campaignId },
				include: {
					leads: true,
				},
			});
			if (!campaign) {
				throw new Error("Campaign not found");
			}
			return campaign;
		} catch (error: any) {
			throw new Error(`Failed to remove lead from campaign: ${error.message}`);
		}
	}

	async removeLeadByPhone(
		campaignId: string,
		phone: string
	): Promise<Campaign> {
		try {
			await this.prisma.lead.updateMany({
				where: {
					campaignId,
					OR: [{ phone1: phone }, { phone2: phone }],
				},
				data: { campaignId: null },
			});

			const campaign = await this.prisma.campaign.findUnique({
				where: { id: campaignId },
				include: {
					leads: true,
				},
			});
			if (!campaign) {
				throw new Error("Campaign not found");
			}
			return campaign;
		} catch (error: any) {
			throw new Error(
				`Failed to remove lead by phone from campaign: ${error.message}`
			);
		}
	}

	async findByStatus(status: CampaignStatus): Promise<Campaign[]> {
		try {
			return await this.prisma.campaign.findMany({
				where: { status },
				include: {
					leads: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find campaigns by status: ${error.message}`);
		}
	}

	async findAll(): Promise<Campaign[]> {
		try {
			return await this.prisma.campaign.findMany({
				include: {
					leads: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find all campaigns: ${error.message}`);
		}
	}

	async delete(id: string): Promise<void> {
		try {
			// Remove all leads from this campaign first
			await this.prisma.lead.updateMany({
				where: { campaignId: id },
				data: { campaignId: null },
			});

			await this.prisma.campaign.delete({
				where: { id },
			});
		} catch (error: any) {
			throw new Error(`Failed to delete campaign: ${error.message}`);
		}
	}

	async deleteAll(): Promise<number> {
		try {
			// First, remove all leads from campaigns
			await this.prisma.lead.updateMany({
				where: { campaignId: { not: null } },
				data: { campaignId: null },
			});

			// Then delete all campaigns
			const result = await this.prisma.campaign.deleteMany({});
			return result.count;
		} catch (error: any) {
			throw new Error(`Failed to delete all campaigns: ${error.message}`);
		}
	}

	async countRecent(): Promise<number> {
		try {
			// Count campaigns created in the last 24 hours
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);

			return await this.prisma.campaign.count({
				where: {
					createdAt: {
						gte: yesterday,
					},
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to count recent campaigns: ${error.message}`);
		}
	}
}
