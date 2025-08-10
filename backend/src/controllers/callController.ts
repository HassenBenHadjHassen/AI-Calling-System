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
			const { leadId } = req.params;
			const { title } = req.body;
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

	// Webhook handling removed - replaced with enhanced polling system

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

	async getCallManagementStats(req: Request, res: Response): Promise<void> {
		try {
			const stats = await this.callService.getCallManagementStats();

			ResponseUtils.success(
				res,
				stats,
				"Call management statistics retrieved successfully"
			);
		} catch (error: any) {
			console.error("Error getting call management stats:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to get call management statistics",
				400
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

	// ===== LIVE CALL CONTROL ENDPOINTS =====

	/**
	 * Make the assistant say a specific message during a live call
	 */
	async sayMessage(req: Request, res: Response): Promise<void> {
		try {
			const { vapiCallId } = req.params;
			const { message, endCallAfterSpoken = false } = req.body;

			if (!message) {
				ResponseUtils.badRequest(res, "Message is required");
				return;
			}

			await this.callService.sayMessage(
				vapiCallId,
				message,
				endCallAfterSpoken
			);

			ResponseUtils.success(res, null, "Message sent successfully");
		} catch (error: any) {
			console.error("Error saying message:", error);
			ResponseUtils.error(res, error.message || "Failed to say message", 400);
		}
	}

	/**
	 * Add a message to the conversation history
	 */
	async addMessageToConversation(req: Request, res: Response): Promise<void> {
		try {
			const { vapiCallId } = req.params;
			const { message, triggerResponse = true } = req.body;

			if (!message || !message.role || !message.content) {
				ResponseUtils.badRequest(
					res,
					"Message with role and content is required"
				);
				return;
			}

			await this.callService.addMessageToConversation(
				vapiCallId,
				message,
				triggerResponse
			);

			ResponseUtils.success(
				res,
				null,
				"Message added to conversation successfully"
			);
		} catch (error: any) {
			console.error("Error adding message to conversation:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to add message to conversation",
				400
			);
		}
	}

	/**
	 * Control assistant behavior (mute/unmute)
	 */
	async controlAssistant(req: Request, res: Response): Promise<void> {
		try {
			const { vapiCallId } = req.params;
			const { control } = req.body;

			if (
				!control ||
				!["mute-assistant", "unmute-assistant", "say-first-message"].includes(
					control
				)
			) {
				ResponseUtils.badRequest(res, "Valid control action is required");
				return;
			}

			await this.callService.controlAssistant(vapiCallId, control);

			ResponseUtils.success(res, null, "Assistant controlled successfully");
		} catch (error: any) {
			console.error("Error controlling assistant:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to control assistant",
				400
			);
		}
	}

	/**
	 * End the call programmatically
	 */
	async endCall(req: Request, res: Response): Promise<void> {
		try {
			const { vapiCallId } = req.params;

			await this.callService.endCall(vapiCallId);

			ResponseUtils.success(res, null, "Call ended successfully");
		} catch (error: any) {
			console.error("Error ending call:", error);
			ResponseUtils.error(res, error.message || "Failed to end call", 400);
		}
	}

	/**
	 * Transfer the call to another number
	 */
	async transferCall(req: Request, res: Response): Promise<void> {
		try {
			const { vapiCallId } = req.params;
			const { destinationNumber, transferMessage } = req.body;

			if (!destinationNumber) {
				ResponseUtils.badRequest(res, "Destination number is required");
				return;
			}

			await this.callService.transferCall(
				vapiCallId,
				destinationNumber,
				transferMessage
			);

			ResponseUtils.success(res, null, "Call transferred successfully");
		} catch (error: any) {
			console.error("Error transferring call:", error);
			ResponseUtils.error(res, error.message || "Failed to transfer call", 400);
		}
	}

	/**
	 * Get call monitoring URLs for real-time control and audio streaming
	 */
	async getCallMonitoringUrls(req: Request, res: Response): Promise<void> {
		try {
			const { vapiCallId } = req.params;

			const urls = await this.callService.getCallMonitoringUrls(vapiCallId);

			ResponseUtils.success(
				res,
				urls,
				"Call monitoring URLs retrieved successfully"
			);
		} catch (error: any) {
			console.error("Error getting call monitoring URLs:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to get call monitoring URLs",
				400
			);
		}
	}
}
