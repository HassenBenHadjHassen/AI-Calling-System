import { Request, Response } from "express";
import { CampaignService } from "../services/campaignService";
import { ResponseUtils } from "../utils/responseUtils";
import { CampaignStatus } from "@prisma/client";

export class CampaignController {
	private campaignService: CampaignService;

	constructor() {
		this.campaignService = new CampaignService();
	}

	async createCampaign(req: Request, res: Response): Promise<void> {
		try {
			const { name } = req.body;

			if (!name) {
				ResponseUtils.badRequest(res, "Campaign name is required");
				return;
			}

			const campaign = await this.campaignService.createCampaign(name);

			ResponseUtils.success(
				res,
				campaign,
				"Campaign created successfully",
				201
			);
		} catch (error: any) {
			console.error("Error creating campaign:", error);
			ResponseUtils.error(res, "Failed to create campaign");
		}
	}

	async getCampaigns(req: Request, res: Response): Promise<void> {
		try {
			const status = req.query.status as CampaignStatus;
			const campaigns = status
				? await this.campaignService.getCampaignsByStatus(status)
				: await this.campaignService.getAllCampaigns();

			ResponseUtils.success(res, campaigns);
		} catch (error: any) {
			console.error("Error fetching campaigns:", error);
			ResponseUtils.error(res, "Failed to fetch campaigns");
		}
	}

	async getCampaignById(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const campaign = await this.campaignService.getCampaignById(id);

			if (!campaign) {
				ResponseUtils.notFound(res, "Campaign not found");
				return;
			}

			ResponseUtils.success(res, campaign);
		} catch (error: any) {
			console.error("Error fetching campaign:", error);
			ResponseUtils.error(res, "Failed to fetch campaign");
		}
	}

	async startCampaign(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const campaign = await this.campaignService.startCampaign(id);

			ResponseUtils.success(res, campaign, "Campaign started successfully");
		} catch (error: any) {
			console.error("Error starting campaign:", error);
			ResponseUtils.error(res, "Failed to start campaign");
		}
	}

	async stopCampaign(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const campaign = await this.campaignService.stopCampaign(id);

			ResponseUtils.success(res, campaign, "Campaign stopped successfully");
		} catch (error: any) {
			console.error("Error stopping campaign:", error);
			ResponseUtils.error(res, "Failed to stop campaign");
		}
	}

	async completeCampaign(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const campaign = await this.campaignService.completeCampaign(id);

			ResponseUtils.success(res, campaign, "Campaign completed successfully");
		} catch (error: any) {
			console.error("Error completing campaign:", error);
			ResponseUtils.error(res, "Failed to complete campaign");
		}
	}

	async deleteCampaign(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			await this.campaignService.deleteCampaign(id);

			ResponseUtils.success(res, null, "Campaign deleted successfully");
		} catch (error: any) {
			console.error("Error deleting campaign:", error);
			ResponseUtils.error(res, "Failed to delete campaign");
		}
	}

	async addLeadsToCampaign(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const { leadIds } = req.body;

			if (!leadIds || !Array.isArray(leadIds)) {
				ResponseUtils.badRequest(res, "Lead IDs array is required");
				return;
			}

			const campaign = await this.campaignService.addLeadsToCampaign(
				id,
				leadIds
			);

			ResponseUtils.success(
				res,
				campaign,
				"Leads added to campaign successfully"
			);
		} catch (error: any) {
			console.error("Error adding leads to campaign:", error);
			ResponseUtils.error(res, "Failed to add leads to campaign");
		}
	}

	async removeLeadFromCampaign(req: Request, res: Response): Promise<void> {
		try {
			const { id, leadId } = req.params;
			const campaign = await this.campaignService.removeLeadFromCampaign(
				id,
				leadId
			);

			ResponseUtils.success(
				res,
				campaign,
				"Lead removed from campaign successfully"
			);
		} catch (error: any) {
			console.error("Error removing lead from campaign:", error);
			ResponseUtils.error(res, "Failed to remove lead from campaign");
		}
	}

	async getActiveCampaign(req: Request, res: Response): Promise<void> {
		try {
			const campaign = await this.campaignService.getActiveCampaign();

			ResponseUtils.success(res, campaign);
		} catch (error: any) {
			console.error("Error fetching active campaign:", error);
			ResponseUtils.error(res, "Failed to fetch active campaign");
		}
	}

	async getNextCampaignToProcess(req: Request, res: Response): Promise<void> {
		try {
			const campaign = await this.campaignService.getNextCampaignToProcess();

			ResponseUtils.success(res, campaign);
		} catch (error: any) {
			console.error("Error fetching next campaign to process:", error);
			ResponseUtils.error(res, "Failed to fetch next campaign to process");
		}
	}

	async getCampaignStats(req: Request, res: Response): Promise<void> {
		try {
			const stats = await this.campaignService.getCampaignStats();

			ResponseUtils.success(res, stats);
		} catch (error: any) {
			console.error("Error fetching campaign stats:", error);
			ResponseUtils.error(res, "Failed to fetch campaign stats");
		}
	}
}
