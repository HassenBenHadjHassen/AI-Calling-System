import { CampaignRepository } from "../repositories/campaignRepository";
import { LeadRepository } from "../repositories/leadRepository";
import { CampaignStatus, LeadStatus, Campaign, Lead } from "@prisma/client";

// Define a type for Campaign with leads included
type CampaignWithLeads = Campaign & {
	leads: Lead[];
};

export class CampaignService {
	private campaignRepository: CampaignRepository;
	private leadRepository: LeadRepository;

	constructor() {
		this.campaignRepository = new CampaignRepository();
		this.leadRepository = new LeadRepository();
	}

	async startCampaign(campaignId: string): Promise<any> {
		try {
			const campaign = (await this.campaignRepository.findById(
				campaignId
			)) as CampaignWithLeads | null;
			if (!campaign) {
				throw new Error("Campaign not found");
			}

			if (campaign.status === CampaignStatus.ACTIVE) {
				throw new Error("Campaign is already active");
			}

			if (campaign.leads.length === 0) {
				throw new Error("Cannot start campaign with no leads");
			}

			// Start the campaign (this will automatically stop any other active campaign)
			return await this.campaignRepository.start(campaignId);
		} catch (error: any) {
			throw new Error(`Failed to start campaign: ${error.message}`);
		}
	}

	async stopCampaign(campaignId: string): Promise<any> {
		try {
			const campaign = (await this.campaignRepository.findById(
				campaignId
			)) as CampaignWithLeads | null;
			if (!campaign) {
				throw new Error("Campaign not found");
			}

			if (campaign.status !== CampaignStatus.ACTIVE) {
				throw new Error("Campaign is not active");
			}

			return await this.campaignRepository.stop(campaignId);
		} catch (error: any) {
			throw new Error(`Failed to stop campaign: ${error.message}`);
		}
	}

	async completeCampaign(campaignId: string): Promise<any> {
		try {
			const campaign = (await this.campaignRepository.findById(
				campaignId
			)) as CampaignWithLeads | null;
			if (!campaign) {
				throw new Error("Campaign not found");
			}

			return await this.campaignRepository.complete(campaignId);
		} catch (error: any) {
			throw new Error(`Failed to complete campaign: ${error.message}`);
		}
	}

	async getActiveCampaign(): Promise<any> {
		try {
			return await this.campaignRepository.findActive();
		} catch (error: any) {
			throw new Error(`Failed to get active campaign: ${error.message}`);
		}
	}

	async getNextAvailableCampaign(): Promise<any> {
		try {
			return await this.campaignRepository.findNextAvailable();
		} catch (error: any) {
			throw new Error(
				`Failed to get next available campaign: ${error.message}`
			);
		}
	}

	async getAllCampaigns(): Promise<any[]> {
		try {
			return await this.campaignRepository.findAll();
		} catch (error: any) {
			throw new Error(`Failed to get all campaigns: ${error.message}`);
		}
	}

	async getCampaignById(campaignId: string): Promise<any> {
		try {
			return await this.campaignRepository.findById(campaignId);
		} catch (error: any) {
			throw new Error(`Failed to get campaign by ID: ${error.message}`);
		}
	}

	async getCampaignsByStatus(status: CampaignStatus): Promise<any[]> {
		try {
			return await this.campaignRepository.findByStatus(status);
		} catch (error: any) {
			throw new Error(`Failed to get campaigns by status: ${error.message}`);
		}
	}

	async createCampaign(name: string): Promise<any> {
		try {
			return await this.campaignRepository.create({ name });
		} catch (error: any) {
			throw new Error(`Failed to create campaign: ${error.message}`);
		}
	}

	async deleteCampaign(campaignId: string): Promise<void> {
		try {
			const campaign = (await this.campaignRepository.findById(
				campaignId
			)) as CampaignWithLeads | null;
			if (!campaign) {
				throw new Error("Campaign not found");
			}

			if (campaign.status === CampaignStatus.ACTIVE) {
				throw new Error("Cannot delete active campaign");
			}

			return await this.campaignRepository.delete(campaignId);
		} catch (error: any) {
			throw new Error(`Failed to delete campaign: ${error.message}`);
		}
	}

	async addLeadsToCampaign(
		campaignId: string,
		leadIds: string[]
	): Promise<any> {
		try {
			const campaign = (await this.campaignRepository.findById(
				campaignId
			)) as CampaignWithLeads | null;
			if (!campaign) {
				throw new Error("Campaign not found");
			}

			if (campaign.status === CampaignStatus.COMPLETED) {
				throw new Error("Cannot add leads to completed campaign");
			}

			// Check if adding these leads would exceed the 5-lead limit
			const currentLeadCount = campaign.leads.length;
			if (currentLeadCount + leadIds.length > 5) {
				throw new Error(
					`Campaign can only have 5 leads. Current: ${currentLeadCount}, Adding: ${leadIds.length}`
				);
			}

			return await this.campaignRepository.addLeads(campaignId, leadIds);
		} catch (error: any) {
			throw new Error(`Failed to add leads to campaign: ${error.message}`);
		}
	}

	async removeLeadFromCampaign(
		campaignId: string,
		leadId: string
	): Promise<any> {
		try {
			const campaign = (await this.campaignRepository.findById(
				campaignId
			)) as CampaignWithLeads | null;
			if (!campaign) {
				throw new Error("Campaign not found");
			}

			const lead = campaign.leads.find((l: Lead) => l.id === leadId);
			if (!lead) {
				throw new Error("Lead not found in campaign");
			}

			return await this.campaignRepository.removeLead(campaignId, leadId);
		} catch (error: any) {
			throw new Error(`Failed to remove lead from campaign: ${error.message}`);
		}
	}

	async getCampaignStats(): Promise<{
		total: number;
		active: number;
		stopped: number;
		completed: number;
	}> {
		try {
			const campaigns = await this.campaignRepository.findAll();

			return {
				total: campaigns.length,
				active: campaigns.filter((c) => c.status === CampaignStatus.ACTIVE)
					.length,
				stopped: campaigns.filter((c) => c.status === CampaignStatus.STOPPED)
					.length,
				completed: campaigns.filter(
					(c) => c.status === CampaignStatus.COMPLETED
				).length,
			};
		} catch (error: any) {
			throw new Error(`Failed to get campaign statistics: ${error.message}`);
		}
	}

	async getNextCampaignToProcess(): Promise<any> {
		try {
			// First, check for campaigns with leads that are ready to be processed
			const campaigns = (await this.campaignRepository.findByStatus(
				CampaignStatus.ACTIVE
			)) as CampaignWithLeads[];

			for (const campaign of campaigns) {
				if (campaign.leads.length > 0) {
					return campaign;
				}
			}

			return null;
		} catch (error: any) {
			throw new Error(
				`Failed to get next campaign to process: ${error.message}`
			);
		}
	}

	async cleanAllCampaigns(): Promise<{ deletedCount: number }> {
		try {
			const deletedCount = await this.campaignRepository.deleteAll();
			return { deletedCount };
		} catch (error: any) {
			throw new Error(`Failed to clean all campaigns: ${error.message}`);
		}
	}
}
