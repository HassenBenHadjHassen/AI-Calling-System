import { Request, Response } from "express";
import { LeadService } from "../services/leadService";
import { ResponseUtils } from "../utils/responseUtils";
import { socketService } from "../services/socketService";

enum LeadStatus {
	NEW = "NEW",
	CALLED = "CALLED",
	INTERESTED = "INTERESTED",
	TRANSFERRED = "TRANSFERRED",
	FAILED = "FAILED",
	BLACKLISTED = "BLACKLISTED",
	SCHEDULED = "SCHEDULED",
}

export class LeadController {
	private leadService: LeadService;

	constructor() {
		this.leadService = new LeadService();
	}

	private getPhoneNumberFromVapi(req: Request): string {
		return (
			req.body.message.toolCalls[0].function.arguments.phoneNumber ||
			req.body.message.toolCalls[0].function.arguments.phoneNumber.number ||
			req.body.phoneNumber
		);
	}

	async manualLeads(req: Request, res: Response): Promise<void> {
		try {
			const { name, phone1, phone2, address, postalCode, city } = req.body;

			if (!name || !phone1) {
				ResponseUtils.badRequest(res, "Name and phone1 are required");
				return;
			}

			const lead = await this.leadService.createManualLead(
				name,
				phone1,
				phone2,
				address,
				postalCode,
				city
			);

			ResponseUtils.success(res, lead, "Lead created successfully", 201);
		} catch (error: any) {
			console.error("Error creating manual lead:", error);
			ResponseUtils.error(res, error.message || "Failed to create lead", 400);
		}
	}

	async uploadLeads(req: Request, res: Response): Promise<void> {
		try {
			if (!req.file) {
				ResponseUtils.badRequest(res, "No file uploaded");
				return;
			}

			// Check file size to determine processing method
			const fileSizeInMB = req.file.size / (1024 * 1024);
			const isLargeFile = fileSizeInMB > 5; // Consider files larger than 5MB as large files

			let result;
			if (isLargeFile) {
				console.log(
					`Processing large file: ${
						req.file.originalname
					} (${fileSizeInMB.toFixed(2)}MB)`
				);
				result = await this.leadService.uploadLeadsFromLargeFile(req.file.path);
			} else {
				result = await this.leadService.uploadLeadsFromFile(req.file.path);
			}

			// Emit real-time update to all connected clients
			socketService.emitToAll("leads-uploaded", {
				result,
				timestamp: new Date().toISOString(),
			});

			ResponseUtils.success(res, result, "Leads uploaded successfully");
		} catch (error: any) {
			console.error("Error uploading leads:", error);
			ResponseUtils.error(res, error.message || "Failed to upload leads", 400);
		}
	}

	async getLeads(req: Request, res: Response): Promise<void> {
		try {
			const status = req.query.status as LeadStatus;
			const leads = await this.leadService.getLeadsByStatus(status);

			ResponseUtils.success(res, leads);
		} catch (error: any) {
			console.error("Error fetching leads:", error);
			ResponseUtils.error(res, error.message || "Failed to fetch leads", 500);
		}
	}

	async getLeadById(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const lead = await this.leadService.getLeadById(id);

			if (!lead) {
				ResponseUtils.notFound(res, "Lead not found");
				return;
			}

			ResponseUtils.success(res, lead);
		} catch (error: any) {
			console.error("Error fetching lead:", error);
			ResponseUtils.error(res, error.message || "Failed to fetch lead", 500);
		}
	}

	async updateLeadStatus(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const { status } = req.body;

			if (!status) {
				ResponseUtils.badRequest(res, "Status is required");
				return;
			}

			const lead = await this.leadService.updateLeadStatus(id, status);

			// Emit real-time update to all connected clients
			socketService.emitToAll("lead-status-updated", {
				leadId: id,
				status,
				lead,
				timestamp: new Date().toISOString(),
			});

			ResponseUtils.success(res, lead, "Lead status updated successfully");
		} catch (error: any) {
			console.error("Error updating lead status:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to update lead status",
				400
			);
		}
	}

	async updateLead(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const { name, address, postalCode, city, phone1, phone2 } = req.body;

			if (!name && !address && !postalCode && !city && !phone1 && !phone2) {
				ResponseUtils.badRequest(
					res,
					"At least one field must be provided for update"
				);
				return;
			}

			const lead = await this.leadService.updateLead(id, {
				name,
				address,
				postalCode,
				city,
				phone1,
				phone2,
			});

			ResponseUtils.success(res, lead, "Lead updated successfully");
		} catch (error: any) {
			console.error("Error updating lead:", error);
			ResponseUtils.error(res, error.message || "Failed to update lead", 400);
		}
	}

	async scheduleCall(req: Request, res: Response): Promise<void> {
		try {
			// VAPI custom tools send data in req.body.function.arguments
			const { scheduledCallAt, note } =
				req.body.message.toolCalls[0].function.arguments || req.body;

			const phoneNumber = this.getPhoneNumberFromVapi(req);

			console.log("phoneNumber", phoneNumber);
			console.log("scheduledCallAt", scheduledCallAt);
			console.log("note", note);

			if (!phoneNumber) {
				console.log("Customer phone number is required");
				ResponseUtils.badRequest(res, "Customer phone number is required");
				return;
			}

			if (!scheduledCallAt) {
				console.log("Scheduled call time is required");
				ResponseUtils.badRequest(res, "Scheduled call time is required");
				return;
			}

			// Validate that scheduledCallAt is in the future
			const scheduledTime = new Date(scheduledCallAt);
			if (scheduledTime <= new Date()) {
				console.log("Scheduled call time must be in the future");
				ResponseUtils.badRequest(
					res,
					"Scheduled call time must be in the future"
				);
				return;
			}

			const lead = await this.leadService.scheduleCall(
				phoneNumber,
				scheduledTime,
				note
			);

			console.log("Call scheduled successfully");
			console.log(
				`📅 Lead ${lead.id} is now protected from status changes for 1 minute`
			);
			ResponseUtils.success(res, lead, "Call scheduled successfully");
		} catch (error: any) {
			console.error("Error scheduling call:", error);

			// Handle specific error types
			if (error.message.includes("Lead not found")) {
				ResponseUtils.notFound(res, error.message);
			} else if (
				error.message.includes("Cannot schedule call for blacklisted lead")
			) {
				ResponseUtils.forbidden(res, error.message);
			} else if (error.message.includes("Call is already scheduled")) {
				ResponseUtils.conflict(res, error.message);
			} else if (error.message.includes("Failed to schedule call")) {
				ResponseUtils.error(res, error.message, 500);
			} else {
				ResponseUtils.error(res, "Failed to schedule call", 500);
			}
		}
	}

	async blacklistLead(req: Request, res: Response): Promise<void> {
		try {
			// VAPI custom tools send data in req.body.function.arguments
			const phoneNumber = this.getPhoneNumberFromVapi(req);

			if (!phoneNumber) {
				ResponseUtils.badRequest(res, "Customer phone number is required");
				return;
			}

			const lead = await this.leadService.blacklistLead(phoneNumber);

			ResponseUtils.success(res, lead, "Lead blacklisted successfully");
		} catch (error: any) {
			console.error("Error blacklisting lead:", error);

			// Handle specific error types
			if (error.message.includes("Lead not found")) {
				ResponseUtils.notFound(res, error.message);
			} else if (error.message.includes("Lead is already blacklisted")) {
				ResponseUtils.conflict(res, error.message);
			} else if (error.message.includes("Failed to blacklist lead")) {
				ResponseUtils.error(res, error.message, 500);
			} else {
				ResponseUtils.error(res, "Failed to blacklist lead", 500);
			}
		}
	}

	async userIsInterested(req: Request, res: Response): Promise<void> {
		try {
			const phoneNumber = this.getPhoneNumberFromVapi(req);

			if (!phoneNumber) {
				ResponseUtils.badRequest(res, "Phone number is required");
				return;
			}

			console.log("phoneNumber", phoneNumber);

			// First find the lead by phone number
			const existingLead = await this.leadService.getLeadByPhone(phoneNumber);
			if (!existingLead) {
				ResponseUtils.notFound(res, "Lead not found with this phone number");
				return;
			}

			// Update the lead status using the lead ID
			const lead = await this.leadService.updateLeadStatus(
				existingLead.id,
				LeadStatus.INTERESTED
			);

			console.log("Lead updated successfully");

			ResponseUtils.success(res, lead, "Lead updated successfully");
		} catch (error: any) {
			console.error("Error checking if user is interested:", error);

			// Handle specific error types
			if (error.message.includes("Lead not found")) {
				ResponseUtils.notFound(res, error.message);
			} else if (error.message.includes("Failed to update lead status")) {
				ResponseUtils.error(res, error.message, 500);
			} else {
				ResponseUtils.error(res, "Failed to check if user is interested", 500);
			}
		}
	}

	async getScheduledCalls(req: Request, res: Response): Promise<void> {
		try {
			const calls = await this.leadService.getScheduledCalls();

			ResponseUtils.success(res, calls);
		} catch (error: any) {
			console.error("Error fetching scheduled calls:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to fetch scheduled calls",
				500
			);
		}
	}

	async getDueScheduledCalls(req: Request, res: Response): Promise<void> {
		try {
			const calls = await this.leadService.getDueScheduledCalls();

			ResponseUtils.success(res, calls);
		} catch (error: any) {
			console.error("Error fetching due scheduled calls:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to fetch due scheduled calls",
				500
			);
		}
	}

	async getAvailableLeads(req: Request, res: Response): Promise<void> {
		try {
			const leads = await this.leadService.getAvailableLeadsForCampaign();

			ResponseUtils.success(res, leads);
		} catch (error: any) {
			console.error("Error fetching available leads:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to fetch available leads",
				500
			);
		}
	}

	async cleanupOrphanedLeads(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.leadService.cleanupOrphanedLeads();

			ResponseUtils.success(
				res,
				result,
				`Orphaned leads cleaned. Cleaned ${result.cleanedCount} leads.`
			);
		} catch (error: any) {
			console.error("Error cleaning orphaned leads:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to cleanup orphaned leads",
				500
			);
		}
	}

	async cleanAllLeads(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.leadService.cleanAllLeads();

			// Emit real-time update to all connected clients
			socketService.emitToAll("leads-cleaned", {
				deletedCount: result.deletedCount,
				timestamp: new Date().toISOString(),
			});

			ResponseUtils.success(
				res,
				result,
				`All leads cleaned. Deleted ${result.deletedCount} leads.`
			);
		} catch (error: any) {
			console.error("Error cleaning all leads:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to clean all leads",
				500
			);
		}
	}

	async deleteLead(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			await this.leadService.deleteLead(id);

			// Emit real-time update to all connected clients
			socketService.emitToAll("lead-deleted", {
				leadId: id,
				timestamp: new Date().toISOString(),
			});

			ResponseUtils.success(res, null, "Lead deleted successfully");
		} catch (error: any) {
			console.error("Error deleting lead:", error);
			ResponseUtils.error(res, error.message || "Failed to delete lead", 400);
		}
	}

	async deleteLeads(req: Request, res: Response): Promise<void> {
		try {
			const { leadIds } = req.body;

			if (!Array.isArray(leadIds) || leadIds.length === 0) {
				ResponseUtils.badRequest(
					res,
					"leadIds array is required and must not be empty"
				);
				return;
			}

			const result = await this.leadService.deleteLeads(leadIds);
			ResponseUtils.success(
				res,
				result,
				`${result.deletedCount} leads deleted successfully`
			);
		} catch (error: any) {
			console.error("Error deleting leads:", error);
			ResponseUtils.error(res, error.message || "Failed to delete leads", 500);
		}
	}

	async getLeadStatistics(req: Request, res: Response): Promise<void> {
		try {
			const stats = await this.leadService.getLeadStatistics();
			ResponseUtils.success(res, stats);
		} catch (error: any) {
			console.error("Error fetching lead statistics:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to fetch lead statistics",
				500
			);
		}
	}

	async resetLeadsForTesting(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.leadService.resetLeadsForTesting();
			ResponseUtils.success(
				res,
				result,
				`${result.resetCount} leads reset for testing`
			);
		} catch (error: any) {
			console.error("Error resetting leads for testing:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to reset leads for testing",
				500
			);
		}
	}

	async debugLeadAvailability(req: Request, res: Response): Promise<void> {
		try {
			const debugInfo = await this.leadService.debugLeadAvailability();
			ResponseUtils.success(res, debugInfo);
		} catch (error: any) {
			console.error("Error debugging lead availability:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to debug lead availability",
				500
			);
		}
	}

	async getOrphanedScheduledCalls(req: Request, res: Response): Promise<void> {
		try {
			const orphanedCalls = await this.leadService.getOrphanedScheduledCalls();
			ResponseUtils.success(res, orphanedCalls);
		} catch (error: any) {
			console.error("Error getting orphaned scheduled calls:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to get orphaned scheduled calls",
				400
			);
		}
	}

	async reassignOrphanedScheduledCall(
		req: Request,
		res: Response
	): Promise<void> {
		try {
			const { leadId, campaignId } = req.body;

			if (!leadId || !campaignId) {
				ResponseUtils.error(res, "Lead ID and Campaign ID are required", 400);
				return;
			}

			const reassignedLead =
				await this.leadService.reassignOrphanedScheduledCall(
					leadId,
					campaignId
				);

			// Emit real-time update
			socketService.emitToAll("orphaned-call-reassigned", {
				leadId,
				campaignId,
				timestamp: new Date().toISOString(),
			});

			ResponseUtils.success(res, reassignedLead);
		} catch (error: any) {
			console.error("Error reassigning orphaned scheduled call:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to reassign orphaned scheduled call",
				400
			);
		}
	}

	async getOrphanedScheduledCallsCount(
		req: Request,
		res: Response
	): Promise<void> {
		try {
			const count = await this.leadService.getOrphanedScheduledCallsCount();
			ResponseUtils.success(res, { count });
		} catch (error: any) {
			console.error("Error getting orphaned scheduled calls count:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to get orphaned scheduled calls count",
				400
			);
		}
	}
}
