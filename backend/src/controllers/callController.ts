import { Request, Response } from "express";
import { CallService } from "../services/callService";
import { ResponseUtils } from "../utils/responseUtils";
import { socketService } from "../services/socketService";

export class CallController {
	private callService: CallService;

	constructor() {
		this.callService = new CallService();
	}

	async triggerCall(req: Request, res: Response): Promise<void> {
		try {
			const { leadId, title } = req.params;
			const result = await this.callService.triggerCall(leadId, title);

			// Emit real-time update to connected clients
			socketService.emitToCall(result.callId, "call-triggered", {
				callId: result.callId,
				leadId,
				title,
				status: "triggered",
				metadata: result,
			});

			ResponseUtils.success(res, result, "Call triggered successfully");
		} catch (error: any) {
			console.error("Error triggering call:", error);
			ResponseUtils.error(res, error.message || "Failed to trigger call", 400);
		}
	}

	async handleWebhook(req: Request, res: Response): Promise<void> {
		try {
			const webhookData = req.body;
			await this.callService.handleWebhook(webhookData);

			// Emit real-time updates based on webhook data
			if (webhookData.callId) {
				socketService.emitToCall(webhookData.callId, "webhook-received", {
					callId: webhookData.callId,
					webhookType: webhookData.type || "unknown",
					data: webhookData,
					timestamp: new Date().toISOString(),
				});

				// Handle specific webhook types
				if (webhookData.type === "transcript") {
					socketService.emitToCall(webhookData.callId, "transcript-updated", {
						callId: webhookData.callId,
						transcript: webhookData.transcript,
						speaker: webhookData.speaker || "unknown",
						timestamp: new Date().toISOString(),
					});
				}

				if (webhookData.type === "voice-activity") {
					socketService.emitToCall(
						webhookData.callId,
						"voice-activity-detected",
						{
							callId: webhookData.callId,
							isSpeaking: webhookData.isSpeaking,
							speaker: webhookData.speaker || "unknown",
							audioLevel: webhookData.audioLevel,
							timestamp: new Date().toISOString(),
						}
					);
				}
			}

			ResponseUtils.success(res, null, "Webhook processed successfully");
		} catch (error: any) {
			console.error("Error processing webhook:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to process webhook",
				400
			);
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
			ResponseUtils.error(
				res,
				error.message || "Failed to trigger scheduled calls",
				400
			);
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
			ResponseUtils.error(
				res,
				error.message || "Failed to trigger campaign calls",
				400
			);
		}
	}

	async handleOverdueRescheduledCalls(
		req: Request,
		res: Response
	): Promise<void> {
		try {
			const processedCount =
				await this.callService.handleOverdueRescheduledCalls();

			ResponseUtils.success(
				res,
				{
					processedCount,
					message: `Processed ${processedCount} overdue rescheduled calls`,
				},
				"Overdue rescheduled calls processed successfully"
			);
		} catch (error: any) {
			console.error("Error handling overdue rescheduled calls:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to handle overdue rescheduled calls",
				400
			);
		}
	}

	async getCallStats(req: Request, res: Response): Promise<void> {
		try {
			const stats = await this.callService.getCallStats();

			ResponseUtils.success(res, stats);
		} catch (error: any) {
			console.error("Error fetching call stats:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to fetch call stats",
				500
			);
		}
	}

	async getCallsByLead(req: Request, res: Response): Promise<void> {
		try {
			const { leadId } = req.params;
			const calls = await this.callService.getCallsByLead(leadId);

			ResponseUtils.success(res, calls);
		} catch (error: any) {
			console.error("Error fetching calls by lead:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to fetch calls by lead",
				500
			);
		}
	}

	async getCallsByCampaign(req: Request, res: Response): Promise<void> {
		try {
			const { campaignId } = req.params;
			const calls = await this.callService.getCallsByCampaign(campaignId);

			ResponseUtils.success(res, calls);
		} catch (error: any) {
			console.error("Error fetching calls by campaign:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to fetch calls by campaign",
				500
			);
		}
	}

	async getTransferredCalls(req: Request, res: Response): Promise<void> {
		try {
			const calls = await this.callService.getTransferredCalls();

			ResponseUtils.success(res, calls);
		} catch (error: any) {
			console.error("Error fetching transferred calls:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to fetch transferred calls",
				500
			);
		}
	}

	async getCompletedCalls(req: Request, res: Response): Promise<void> {
		try {
			const calls = await this.callService.getCompletedCalls();

			ResponseUtils.success(res, calls);
		} catch (error: any) {
			console.error("Error fetching completed calls:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to fetch completed calls",
				500
			);
		}
	}

	async getFailedCalls(req: Request, res: Response): Promise<void> {
		try {
			const calls = await this.callService.getFailedCalls();

			ResponseUtils.success(res, calls);
		} catch (error: any) {
			console.error("Error fetching failed calls:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to fetch failed calls",
				500
			);
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
			ResponseUtils.error(
				res,
				error.message || "Failed to update call notes",
				400
			);
		}
	}

	async getRecentCalls(req: Request, res: Response): Promise<void> {
		try {
			const { limit = "50" } = req.query;
			const calls = await this.callService.getRecentCalls(
				parseInt(limit as string)
			);

			ResponseUtils.success(res, calls);
		} catch (error: any) {
			console.error("Error fetching recent calls:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to fetch recent calls",
				500
			);
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
			ResponseUtils.error(res, error.message || "Failed to fetch call", 500);
		}
	}
}
