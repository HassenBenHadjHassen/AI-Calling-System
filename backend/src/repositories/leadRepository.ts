import {
	PrismaClient,
	Lead,
	LeadStatus,
	ScheduledCallStatus,
	CampaignStatus,
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

	async findByIds(ids: string[]): Promise<Lead[]> {
		try {
			return await this.prisma.lead.findMany({
				where: { id: { in: ids } },
				include: {
					callHistory: true,
					campaign: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find leads by IDs: ${error.message}`);
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
					retryCount: {
						increment: 1,
					},
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to update scheduled call: ${error.message}`);
		}
	}

	async clearScheduledCall(id: string): Promise<Lead> {
		try {
			return await this.prisma.lead.update({
				where: { id },
				data: {
					scheduledCallAt: null,
					scheduledCallNote: null,
					scheduledCallStatus: null,
					status: LeadStatus.CALLED, // Reset to CALLED status
					retryCount: 0, // Reset retry count
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to clear scheduled call: ${error.message}`);
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

	async findOverdueScheduledCalls(): Promise<Lead[]> {
		try {
			return await this.prisma.lead.findMany({
				where: {
					scheduledCallAt: { lte: new Date() },
					status: LeadStatus.SCHEDULED,
					blacklisted: false,
				},
				include: {
					callHistory: true,
					campaign: true,
				},
			});
		} catch (error: any) {
			throw new Error(
				`Failed to find overdue scheduled calls: ${error.message}`
			);
		}
	}

	async findAvailableForCampaign(): Promise<Lead[]> {
		try {
			// First, cleanup any orphaned leads (leads with campaignId but no campaign)
			await this.cleanupOrphanedLeads();

			return await this.prisma.lead.findMany({
				where: {
					// Include leads with various statuses that can be reassigned to campaigns
					status: {
						in: [
							LeadStatus.NEW,
							LeadStatus.CALLED,
							LeadStatus.FAILED,
							LeadStatus.TRANSFERRED,
						],
					},
					blacklisted: false,
					campaignId: null, // Simplified: just check that campaignId is null
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

	async update(
		id: string,
		data: {
			name?: string;
			address?: string;
			postalCode?: string;
			city?: string;
			phone1?: string;
			phone2?: string;
		}
	): Promise<Lead> {
		try {
			return await this.prisma.lead.update({
				where: { id },
				data,
			});
		} catch (error: any) {
			throw new Error(`Failed to update lead: ${error.message}`);
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

	async deleteById(id: string): Promise<Lead> {
		try {
			// First, delete all call history records for this lead to avoid foreign key constraint violations
			await this.prisma.callHistory.deleteMany({
				where: { leadId: id },
			});

			// Then delete the lead
			return await this.prisma.lead.delete({
				where: { id },
			});
		} catch (error: any) {
			throw new Error(`Failed to delete lead: ${error.message}`);
		}
	}

	async deleteByIds(ids: string[]): Promise<number> {
		try {
			// First, delete all call history records for these leads to avoid foreign key constraint violations
			await this.prisma.callHistory.deleteMany({
				where: { leadId: { in: ids } },
			});

			// Then delete all the leads
			const result = await this.prisma.lead.deleteMany({
				where: { id: { in: ids } },
			});
			return result.count;
		} catch (error: any) {
			throw new Error(`Failed to delete leads: ${error.message}`);
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
			let cleanedCount = 0;

			// 1. Find leads that have a campaignId but the campaign doesn't exist
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
				cleanedCount += orphanedLeads.length;
			}

			// 2. Reset leads with INTERESTED status that are not in active campaigns
			// These leads might have been marked as interested but the campaign ended
			const interestedLeadsNotInActiveCampaigns =
				await this.prisma.lead.findMany({
					where: {
						status: LeadStatus.INTERESTED,
						OR: [
							{ campaignId: null },
							{ campaign: null },
							{
								campaign: {
									status: {
										in: [CampaignStatus.STOPPED, CampaignStatus.COMPLETED],
									},
								},
							},
						],
					},
				});

			if (interestedLeadsNotInActiveCampaigns.length > 0) {
				await this.prisma.lead.updateMany({
					where: {
						status: LeadStatus.INTERESTED,
						OR: [
							{ campaignId: null },
							{ campaign: null },
							{
								campaign: {
									status: {
										in: [CampaignStatus.STOPPED, CampaignStatus.COMPLETED],
									},
								},
							},
						],
					},
					data: {
						status: LeadStatus.CALLED,
						campaignId: null,
					},
				});
				cleanedCount += interestedLeadsNotInActiveCampaigns.length;
			}

			// 3. Reset leads with SCHEDULED status that have no scheduled call time
			const invalidScheduledLeads = await this.prisma.lead.findMany({
				where: {
					status: LeadStatus.SCHEDULED,
					scheduledCallAt: null,
				},
			});

			if (invalidScheduledLeads.length > 0) {
				await this.prisma.lead.updateMany({
					where: {
						status: LeadStatus.SCHEDULED,
						scheduledCallAt: null,
					},
					data: {
						status: LeadStatus.CALLED,
						scheduledCallStatus: null,
						scheduledCallNote: null,
					},
				});
				cleanedCount += invalidScheduledLeads.length;
			}

			return cleanedCount;
		} catch (error: any) {
			throw new Error(`Failed to cleanup orphaned leads: ${error.message}`);
		}
	}

	async resetAllLeads(): Promise<{ count: number }> {
		try {
			// Reset all leads to NEW status and remove them from campaigns
			// This is useful for testing purposes
			const result = await this.prisma.lead.updateMany({
				where: {
					blacklisted: false, // Don't reset blacklisted leads
				},
				data: {
					status: LeadStatus.NEW,
					campaignId: null,
					scheduledCallAt: null,
					scheduledCallNote: null,
					scheduledCallStatus: null,
				},
			});
			return result;
		} catch (error: any) {
			throw new Error(`Failed to reset all leads: ${error.message}`);
		}
	}

	async debugLeadAvailability(): Promise<{
		totalLeads: number;
		leadsByStatus: Record<string, number>;
		leadsByCampaignId: Record<string, number>;
		blacklistedLeads: number;
		scheduledLeads: number;
		availableLeads: number;
	}> {
		try {
			const allLeads = await this.prisma.lead.findMany({
				include: {
					callHistory: true,
					campaign: true,
				},
			});

			// Count leads by status
			const leadsByStatus: Record<string, number> = {};
			const leadsByCampaignId: Record<string, number> = {};
			let blacklistedLeads = 0;
			let scheduledLeads = 0;

			allLeads.forEach((lead) => {
				leadsByStatus[lead.status] = (leadsByStatus[lead.status] || 0) + 1;

				if (lead.blacklisted) blacklistedLeads++;
				if (lead.scheduledCallAt) scheduledLeads++;

				const campaignId = lead.campaignId || "null";
				leadsByCampaignId[campaignId] =
					(leadsByCampaignId[campaignId] || 0) + 1;
			});

			// Get available leads using the current logic
			const availableLeads = await this.findAvailableForCampaign();

			return {
				totalLeads: allLeads.length,
				leadsByStatus,
				leadsByCampaignId,
				blacklistedLeads,
				scheduledLeads,
				availableLeads: availableLeads.length,
			};
		} catch (error: any) {
			throw new Error(`Failed to debug lead availability: ${error.message}`);
		}
	}
}
