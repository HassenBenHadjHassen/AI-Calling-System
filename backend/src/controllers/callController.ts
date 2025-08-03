import { Request, Response } from "express";
import { CallService } from "../services/callService";
import { ResponseUtils } from "../utils/responseUtils";

export class CallController {
	private callService: CallService;

	constructor() {
		this.callService = new CallService();
	}

	async triggerCall(req: Request, res: Response): Promise<void> {
		try {
			const { leadId, title } = req.params;
			const result = await this.callService.triggerCall(leadId, title);

			ResponseUtils.success(res, result, "Call triggered successfully");
		} catch (error: any) {
			console.error("Error triggering call:", error);
			ResponseUtils.error(res, "Failed to trigger call");
		}
	}

	async handleWebhook(req: Request, res: Response): Promise<void> {
		try {
			const webhookData = req.body;
			await this.callService.handleWebhook(webhookData);

			ResponseUtils.success(res, null, "Webhook processed successfully");
		} catch (error: any) {
			console.error("Error processing webhook:", error);
			ResponseUtils.error(res, "Failed to process webhook");
		}
	}

	async triggerScheduledCalls(req: Request, res: Response): Promise<void> {
		try {
			const { title } = req.params;
			const triggeredCalls = await this.callService.triggerScheduledCalls(
				title
			);

			ResponseUtils.success(
				res,
				{
					triggeredCount: triggeredCalls.length,
					calls: triggeredCalls,
				},
				"Scheduled calls triggered successfully"
			);
		} catch (error: any) {
			console.error("Error triggering scheduled calls:", error);
			ResponseUtils.error(res, "Failed to trigger scheduled calls");
		}
	}

	async triggerCampaignCalls(req: Request, res: Response): Promise<void> {
		try {
			const { campaignId, title } = req.params;
			const triggeredCalls = await this.callService.triggerCampaignCalls(
				campaignId,
				title
			);

			ResponseUtils.success(
				res,
				{
					triggeredCount: triggeredCalls.length,
					calls: triggeredCalls,
				},
				"Campaign calls triggered successfully"
			);
		} catch (error: any) {
			console.error("Error triggering campaign calls:", error);
			ResponseUtils.error(res, "Failed to trigger campaign calls");
		}
	}

	async getCallStats(req: Request, res: Response): Promise<void> {
		try {
			const stats = await this.callService.getCallStats();

			ResponseUtils.success(res, stats);
		} catch (error: any) {
			console.error("Error fetching call stats:", error);
			ResponseUtils.error(res, "Failed to fetch call stats");
		}
	}

	async getCallsByLead(req: Request, res: Response): Promise<void> {
		try {
			const { leadId } = req.params;
			const calls = await this.callService.getCallsByLead(leadId);

			ResponseUtils.success(res, calls);
		} catch (error: any) {
			console.error("Error fetching calls by lead:", error);
			ResponseUtils.error(res, "Failed to fetch calls by lead");
		}
	}

	async getCallsByCampaign(req: Request, res: Response): Promise<void> {
		try {
			const { campaignId } = req.params;
			const calls = await this.callService.getCallsByCampaign(campaignId);

			ResponseUtils.success(res, calls);
		} catch (error: any) {
			console.error("Error fetching calls by campaign:", error);
			ResponseUtils.error(res, "Failed to fetch calls by campaign");
		}
	}

	async getTransferredCalls(req: Request, res: Response): Promise<void> {
		try {
			const calls = await this.callService.getTransferredCalls();

			ResponseUtils.success(res, calls);
		} catch (error: any) {
			console.error("Error fetching transferred calls:", error);
			ResponseUtils.error(res, "Failed to fetch transferred calls");
		}
	}

	async getCompletedCalls(req: Request, res: Response): Promise<void> {
		try {
			const calls = await this.callService.getCompletedCalls();

			ResponseUtils.success(res, calls);
		} catch (error: any) {
			console.error("Error fetching completed calls:", error);
			ResponseUtils.error(res, "Failed to fetch completed calls");
		}
	}

	async getFailedCalls(req: Request, res: Response): Promise<void> {
		try {
			const calls = await this.callService.getFailedCalls();

			ResponseUtils.success(res, calls);
		} catch (error: any) {
			console.error("Error fetching failed calls:", error);
			ResponseUtils.error(res, "Failed to fetch failed calls");
		}
	}

	async updateCallNotes(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const { notes } = req.body;

			if (!notes) {
				ResponseUtils.badRequest(res, "Notes are required");
				return;
			}

			const call = await this.callService.updateCallNotes(id, notes);

			ResponseUtils.success(res, call, "Call notes updated successfully");
		} catch (error: any) {
			console.error("Error updating call notes:", error);
			ResponseUtils.error(res, "Failed to update call notes");
		}
	}

	async getCallById(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const call = await this.callService.getCallById(id);

			if (!call) {
				ResponseUtils.notFound(res, "Call not found");
				return;
			}

			ResponseUtils.success(res, call);
		} catch (error: any) {
			console.error("Error fetching call:", error);
			ResponseUtils.error(res, "Failed to fetch call");
		}
	}
}
