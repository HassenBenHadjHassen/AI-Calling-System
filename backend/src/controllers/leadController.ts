import { Request, Response } from "express";
import { LeadService } from "../services/leadService";
import { ResponseUtils } from "../utils/responseUtils";

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

	async scheduleCall(req: Request, res: Response): Promise<void> {
		try {
			const { phoneNumber } = req.params;
			const { scheduledCallAt, note } = req.body;

			if (!scheduledCallAt) {
				ResponseUtils.badRequest(res, "Scheduled call time is required");
				return;
			}

			// Validate that scheduledCallAt is in the future
			const scheduledTime = new Date(scheduledCallAt);
			if (scheduledTime <= new Date()) {
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

			ResponseUtils.success(res, lead, "Call scheduled successfully");
		} catch (error: any) {
			console.error("Error scheduling call:", error);
			ResponseUtils.error(res, error.message || "Failed to schedule call", 400);
		}
	}

	async blacklistLead(req: Request, res: Response): Promise<void> {
		try {
			const { phoneNumber } = req.params;

			const lead = await this.leadService.blacklistLead(phoneNumber);

			ResponseUtils.success(res, lead, "Lead blacklisted successfully");
		} catch (error: any) {
			console.error("Error blacklisting lead:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to blacklist lead",
				400
			);
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
}
