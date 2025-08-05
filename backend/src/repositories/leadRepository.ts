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
		try {
			return await this.prisma.lead.create({
				data: leadData,
			});
		} catch (error: any) {
			throw new Error(`Failed to create lead: ${error.message}`);
		}
	}

	async createMany(
		leadsData: Array<{
			name: string;
			address?: string;
			postalCode?: string;
			city?: string;
			phone1: string;
			phone2?: string;
			campaignId?: string;
		}>
	): Promise<{ count: number }> {
		try {
			return await this.prisma.lead.createMany({
				data: leadsData,
			});
		} catch (error: any) {
			throw new Error(`Failed to create multiple leads: ${error.message}`);
		}
	}

	async findById(id: string): Promise<Lead | null> {
		try {
			return await this.prisma.lead.findUnique({
				where: { id },
				include: {
					callHistory: true,
					campaign: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find lead by ID: ${error.message}`);
		}
	}

	async findByPhone(phone: string): Promise<Lead | null> {
		try {
			return await this.prisma.lead.findFirst({
				where: {
					OR: [{ phone1: phone }, { phone2: phone }],
				},
				include: {
					callHistory: true,
					campaign: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find lead by phone: ${error.message}`);
		}
	}

	async findExistingLeads(phoneNumbers: string[]): Promise<Lead[]> {
		try {
			return await this.prisma.lead.findMany({
				where: {
					OR: [
						{ phone1: { in: phoneNumbers } },
						{ phone2: { in: phoneNumbers } },
					],
				},
				include: {
					callHistory: true,
					campaign: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find existing leads: ${error.message}`);
		}
	}

	async findExistingLeadsByPhone1(phoneNumbers: string[]): Promise<Lead[]> {
		try {
			return await this.prisma.lead.findMany({
				where: {
					phone1: { in: phoneNumbers },
				},
				include: {
					callHistory: true,
					campaign: true,
				},
			});
		} catch (error: any) {
			throw new Error(
				`Failed to find existing leads by phone1: ${error.message}`
			);
		}
	}

	async updateStatus(id: string, status: LeadStatus): Promise<Lead> {
		try {
			return await this.prisma.lead.update({
				where: { id },
				data: { status },
			});
		} catch (error: any) {
			throw new Error(`Failed to update lead status: ${error.message}`);
		}
	}

	async updateScheduledCall(
		id: string,
		scheduledCallAt: Date,
		note?: string
	): Promise<Lead> {
		try {
			return await this.prisma.lead.update({
				where: { id },
				data: {
					scheduledCallAt,
					scheduledCallNote: note,
					scheduledCallStatus: ScheduledCallStatus.PENDING,
					status: LeadStatus.SCHEDULED,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to update scheduled call: ${error.message}`);
		}
	}

	async updateScheduledCallByPhone(
		phone: string,
		scheduledCallAt: Date,
		note?: string
	): Promise<Lead> {
		try {
			const lead = await this.findByPhone(phone);
			if (!lead) {
				throw new Error("Lead not found");
			}

			return await this.prisma.lead.update({
				where: { id: lead.id },
				data: {
					scheduledCallAt,
					scheduledCallNote: note,
					scheduledCallStatus: ScheduledCallStatus.PENDING,
					status: LeadStatus.SCHEDULED,
				},
			});
		} catch (error: any) {
			throw new Error(
				`Failed to update scheduled call by phone: ${error.message}`
			);
		}
	}

	async blacklist(id: string): Promise<Lead> {
		try {
			return await this.prisma.lead.update({
				where: { id },
				data: {
					blacklisted: true,
					status: LeadStatus.BLACKLISTED,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to blacklist lead: ${error.message}`);
		}
	}

	async blacklistByPhone(phone: string): Promise<Lead> {
		try {
			const lead = await this.findByPhone(phone);
			if (!lead) {
				throw new Error("Lead not found");
			}

			return await this.prisma.lead.update({
				where: { id: lead.id },
				data: {
					blacklisted: true,
					status: LeadStatus.BLACKLISTED,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to blacklist lead by phone: ${error.message}`);
		}
	}

	async findByStatus(status: LeadStatus): Promise<Lead[]> {
		try {
			return await this.prisma.lead.findMany({
				where: { status },
				include: {
					callHistory: true,
					campaign: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find leads by status: ${error.message}`);
		}
	}

	async findScheduledCalls(): Promise<Lead[]> {
		try {
			return await this.prisma.lead.findMany({
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
		} catch (error: any) {
			throw new Error(`Failed to find scheduled calls: ${error.message}`);
		}
	}

	async findDueScheduledCalls(): Promise<Lead[]> {
		try {
			return await this.prisma.lead.findMany({
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
		} catch (error: any) {
			throw new Error(`Failed to find due scheduled calls: ${error.message}`);
		}
	}

	async findAvailableForCampaign(): Promise<Lead[]> {
		try {
			// First, cleanup any orphaned leads (leads with campaignId but no campaign)
			await this.cleanupOrphanedLeads();

			return await this.prisma.lead.findMany({
				where: {
					status: LeadStatus.NEW,
					blacklisted: false,
					scheduledCallAt: null,
					OR: [{ campaignId: null }, { campaign: null }],
				},
				include: {
					callHistory: true,
					campaign: true,
				},
			});
		} catch (error: any) {
			throw new Error(
				`Failed to find leads available for campaign: ${error.message}`
			);
		}
	}

	async updateCampaign(id: string, campaignId: string | null): Promise<Lead> {
		try {
			return await this.prisma.lead.update({
				where: { id },
				data: { campaignId },
			});
		} catch (error: any) {
			throw new Error(`Failed to update lead campaign: ${error.message}`);
		}
	}

	async findAll(): Promise<Lead[]> {
		try {
			return await this.prisma.lead.findMany({
				include: {
					callHistory: true,
					campaign: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find all leads: ${error.message}`);
		}
	}

	async deleteAll(): Promise<number> {
		try {
			// First, delete all call history records to avoid foreign key constraint violations
			await this.prisma.callHistory.deleteMany({});

			// Then delete all leads
			const result = await this.prisma.lead.deleteMany({});
			return result.count;
		} catch (error: any) {
			throw new Error(`Failed to delete all leads: ${error.message}`);
		}
	}

	async count(): Promise<number> {
		try {
			return await this.prisma.lead.count();
		} catch (error: any) {
			throw new Error(`Failed to count leads: ${error.message}`);
		}
	}

	async cleanupOrphanedLeads(): Promise<number> {
		try {
			// Find leads that have a campaignId but the campaign doesn't exist
			const orphanedLeads = await this.prisma.lead.findMany({
				where: {
					campaignId: { not: null },
					campaign: null,
				},
			});

			if (orphanedLeads.length > 0) {
				// Update orphaned leads to remove their campaignId
				await this.prisma.lead.updateMany({
					where: {
						campaignId: { not: null },
						campaign: null,
					},
					data: {
						campaignId: null,
					},
				});
			}

			return orphanedLeads.length;
		} catch (error: any) {
			throw new Error(`Failed to cleanup orphaned leads: ${error.message}`);
		}
	}
}
