import { CampaignRepository } from "../repositories/campaignRepository";
import { LeadRepository } from "../repositories/leadRepository";
import { callService } from "./callService";
import { CampaignStatus, LeadStatus, Campaign, Lead } from "@prisma/client";

// Define a type for Campaign with leads included
type CampaignWithLeads = Campaign & {
	leads: Lead[];
};

export class CampaignService {
	private campaignRepository = new CampaignRepository();
	private leadRepository = new LeadRepository();
	private callService = callService;

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

			// Start the campaign
			const startedCampaign = await this.campaignRepository.start(campaignId);

			// Automatically trigger calls for the campaign leads
			try {
				const triggeredCalls = await this.callService.triggerCampaignCalls(
					campaignId,
					`Campaign: ${campaign.name}`
				);

				console.log(
					`🚀 Campaign "${campaign.name}" started and triggered ${triggeredCalls.length} calls`
				);

				return {
					...startedCampaign,
					triggeredCalls: triggeredCalls.length,
					message: `Campaign started successfully. Triggered ${triggeredCalls.length} calls.`,
				};
			} catch (callError: any) {
				console.error(
					`Failed to trigger calls for campaign ${campaignId}:`,
					callError
				);
				// Return the started campaign even if calls failed
				return {
					...startedCampaign,
					triggeredCalls: 0,
					message: `Campaign started successfully but failed to trigger calls: ${callError.message}`,
				};
			}
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

			// If campaign is already stopped or completed, return success without doing anything
			if (
				campaign.status === CampaignStatus.STOPPED ||
				campaign.status === CampaignStatus.COMPLETED
			) {
				return {
					...campaign,
					nextCampaignStarted: false,
					hangUpResults: {
						totalCalls: 0,
						successfulHangUps: 0,
						failedHangUps: 0,
						errors: [],
					},
					message: `Campaign is already ${campaign.status.toLowerCase()}.`,
				};
			}

			if (campaign.status !== CampaignStatus.ACTIVE) {
				throw new Error("Campaign is not active");
			}

			// Hang up on all active calls for this campaign
			console.log(
				`🛑 Stopping campaign "${campaign.name}" and hanging up on all active calls...`
			);
			const hangUpResults = await this.callService.hangUpAllCampaignCalls(
				campaignId
			);

			// Stop the campaign
			const stoppedCampaign = await this.campaignRepository.stop(campaignId);

			return {
				...stoppedCampaign,
				nextCampaignStarted: false,
				hangUpResults,
				message: `Campaign stopped successfully. ${hangUpResults.successfulHangUps}/${hangUpResults.totalCalls} active calls were hung up.`,
			};
		} catch (error: any) {
			throw new Error(`Failed to stop campaign: ${error.message}`);
		}
	}

	async startNextAvailableCampaign(): Promise<any | null> {
		try {
			// Find campaigns that are stopped and have leads
			const campaigns = await this.campaignRepository.findByStatus(
				CampaignStatus.STOPPED
			);

			for (const campaign of campaigns) {
				const campaignWithLeads = campaign as CampaignWithLeads;
				if (campaignWithLeads.leads && campaignWithLeads.leads.length > 0) {
					console.log(
						`🔄 Automatically starting next available campaign: "${campaignWithLeads.name}"`
					);
					return await this.startCampaign(campaignWithLeads.id);
				}
			}

			console.log("📭 No available campaigns to start automatically");
			return null;
		} catch (error: any) {
			console.error("Failed to start next available campaign:", error);
			return null;
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

			const completedCampaign = await this.campaignRepository.complete(
				campaignId
			);

			// Automatically start the next available campaign
			try {
				const nextCampaign = await this.startNextAvailableCampaign();
				if (nextCampaign) {
					return {
						...completedCampaign,
						nextCampaignStarted: true,
						nextCampaign: nextCampaign,
						message: `Campaign completed successfully. Next campaign "${nextCampaign.name}" started automatically.`,
					};
				}
			} catch (nextCampaignError: any) {
				console.error("Failed to start next campaign:", nextCampaignError);
			}

			return {
				...completedCampaign,
				nextCampaignStarted: false,
				message: "Campaign completed successfully.",
			};
		} catch (error: any) {
			throw new Error(`Failed to complete campaign: ${error.message}`);
		}
	}

	async autoStartFirstCampaign(): Promise<any | null> {
		try {
			// Find the first available campaign with leads
			const campaigns = await this.campaignRepository.findByStatus(
				CampaignStatus.STOPPED
			);

			for (const campaign of campaigns) {
				const campaignWithLeads = campaign as CampaignWithLeads;
				if (campaignWithLeads.leads && campaignWithLeads.leads.length > 0) {
					console.log(
						`🚀 Auto-starting first available campaign: "${campaignWithLeads.name}"`
					);
					return await this.startCampaign(campaignWithLeads.id);
				}
			}

			console.log("📭 No campaigns available for auto-start");
			return null;
		} catch (error: any) {
			console.error("Failed to auto-start first campaign:", error);
			return null;
		}
	}

	async getActiveCampaign(): Promise<any> {
		try {
			return await this.campaignRepository.findActive();
		} catch (error: any) {
			throw new Error(`Failed to get active campaign: ${error.message}`);
		}
	}

	async getAllActiveCampaigns(): Promise<any[]> {
		try {
			return await this.campaignRepository.findAllActive();
		} catch (error: any) {
			throw new Error(`Failed to get active campaigns: ${error.message}`);
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
			// Check if it's a duplicate name error
			if (
				error.message.includes("Unique constraint failed") ||
				error.message.includes("duplicate key") ||
				error.message.includes("E11000")
			) {
				throw new Error(`Campaign with name "${name}" already exists`);
			}
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

	async hangUpAllCampaignCalls(campaignId: string): Promise<{
		totalCalls: number;
		successfulHangUps: number;
		failedHangUps: number;
		errors: string[];
	}> {
		try {
			return await this.callService.hangUpAllCampaignCalls(campaignId);
		} catch (error: any) {
			throw new Error(`Failed to hang up campaign calls: ${error.message}`);
		}
	}
}
