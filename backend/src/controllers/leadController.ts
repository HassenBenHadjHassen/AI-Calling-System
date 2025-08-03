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
			ResponseUtils.error(res, "Failed to create lead");
		}
	}

	async uploadLeads(req: Request, res: Response): Promise<void> {
		try {
			if (!req.file) {
				ResponseUtils.badRequest(res, "No file uploaded");
				return;
			}

			const result = await this.leadService.uploadLeadsFromFile(req.file.path);

			ResponseUtils.success(res, result, "Leads uploaded successfully");
		} catch (error: any) {
			console.error("Error uploading leads:", error);
			ResponseUtils.error(res, "Failed to upload leads");
		}
	}

	async getLeads(req: Request, res: Response): Promise<void> {
		try {
			const status = req.query.status as LeadStatus;
			const leads = await this.leadService.getLeadsByStatus(status);

			ResponseUtils.success(res, leads);
		} catch (error: any) {
			console.error("Error fetching leads:", error);
			ResponseUtils.error(res, "Failed to fetch leads");
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
			ResponseUtils.error(res, "Failed to fetch lead");
		}
	}

	async updateLeadStatus(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const { status } = req.body;

			if (!status || !Object.values(LeadStatus).includes(status)) {
				ResponseUtils.badRequest(res, "Invalid status");
				return;
			}

			const lead = await this.leadService.updateLeadStatus(id, status);

			ResponseUtils.success(res, lead, "Lead status updated successfully");
		} catch (error: any) {
			console.error("Error updating lead status:", error);
			ResponseUtils.error(res, "Failed to update lead status");
		}
	}

	async scheduleCall(req: Request, res: Response): Promise<void> {
		const toolCall = req.body?.message?.toolCalls?.[0];
		const { note, scheduledCallAt, customerPhoneNumber } =
			toolCall?.arguments || req.body;

		if (!customerPhoneNumber) {
			ResponseUtils.badRequest(res, "Customer phone number is required");
			return;
		}

		try {
			if (!scheduledCallAt) {
				ResponseUtils.badRequest(res, "Scheduled call time is required");
				return;
			}

			const scheduledDate = new Date(scheduledCallAt);
			if (isNaN(scheduledDate.getTime())) {
				ResponseUtils.badRequest(res, "Invalid date format");
				return;
			}

			const lead = await this.leadService.scheduleCall(
				customerPhoneNumber,
				scheduledDate,
				note
			);

			ResponseUtils.success(res, lead, "Call scheduled successfully");
		} catch (error: any) {
			console.error("Error scheduling call:", error);
			ResponseUtils.error(res, "Failed to schedule call");
		}
	}

	async blacklistLead(req: Request, res: Response): Promise<void> {
		const toolCall = req.body?.message?.toolCalls?.[0];

		const { customerPhoneNumber } = toolCall?.arguments || req.body;
		try {
			const lead = await this.leadService.blacklistLead(customerPhoneNumber);

			ResponseUtils.success(res, lead, "Lead blacklisted successfully");
		} catch (error: any) {
			console.error("Error blacklisting lead:", error);
			ResponseUtils.error(res, "Failed to blacklist lead");
		}
	}

	async getScheduledCalls(req: Request, res: Response): Promise<void> {
		try {
			const scheduledCalls = await this.leadService.getScheduledCalls();

			ResponseUtils.success(res, scheduledCalls);
		} catch (error: any) {
			console.error("Error fetching scheduled calls:", error);
			ResponseUtils.error(res, "Failed to fetch scheduled calls");
		}
	}

	async getDueScheduledCalls(req: Request, res: Response): Promise<void> {
		try {
			const dueCalls = await this.leadService.getDueScheduledCalls();

			ResponseUtils.success(res, dueCalls);
		} catch (error: any) {
			console.error("Error fetching due scheduled calls:", error);
			ResponseUtils.error(res, "Failed to fetch due scheduled calls");
		}
	}

	async getAvailableLeads(req: Request, res: Response): Promise<void> {
		try {
			const availableLeads =
				await this.leadService.getAvailableLeadsForCampaign();

			ResponseUtils.success(res, availableLeads);
		} catch (error: any) {
			console.error("Error fetching available leads:", error);
			ResponseUtils.error(res, "Failed to fetch available leads");
		}
	}
}
