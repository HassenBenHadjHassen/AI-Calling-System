import { CallRepository } from "../repositories/callRepository";
import { LeadRepository } from "../repositories/leadRepository";
import { CampaignRepository } from "../repositories/campaignRepository";
import { vapiService } from "./vapiService";
import { CallStatus, LeadStatus, ScheduledCallStatus } from "@prisma/client";

export class CallService {
	private callRepository: CallRepository;
	private leadRepository: LeadRepository;
	private campaignRepository: CampaignRepository;

	constructor() {
		this.callRepository = new CallRepository();
		this.leadRepository = new LeadRepository();
		this.campaignRepository = new CampaignRepository();
	}

	async triggerCall(leadId: string, title: string): Promise<any> {
		try {
			const lead = await this.leadRepository.findById(leadId);
			if (!lead) {
				throw new Error("Lead not found");
			}

			if (lead.blacklisted) {
				throw new Error("Cannot call blacklisted lead");
			}

			// if a call is scheduled make sure it doesnt call before the scheduled time
			if (lead.scheduledCallAt && lead.scheduledCallAt > new Date()) {
				throw new Error("Cannot call before scheduled time");
			}

			// Create call record
			const callRecord = await this.callRepository.create({
				leadId: lead.id,
				campaignId: lead.campaignId || undefined,
				callStatus: CallStatus.INITIATED,
			});

			try {
				// Trigger call via Vapi.ai
				const vapiResponse = await vapiService.createCall({
					phoneNumber: lead.phone1,
					name: lead.name,
					title: title, // Default title, could be made configurable
				});

				// Update call record with Vapi call ID
				await this.callRepository.updateStatus(
					callRecord.id,
					CallStatus.INITIATED
				);

				return {
					callRecord,
					vapiCallId: (vapiResponse as any).id,
				};
			} catch (error: any) {
				// Update call record as failed
				await this.callRepository.updateStatus(
					callRecord.id,
					CallStatus.FAILED
				);
				throw new Error(`Failed to trigger call via Vapi: ${error.message}`);
			}
		} catch (error: any) {
			throw new Error(`Failed to trigger call: ${error.message}`);
		}
	}

	async handleWebhook(webhookData: any): Promise<void> {
		try {
			const { callId, status, duration, transferred, transferTo } = webhookData;

			// Find call record by Vapi call ID
			const callRecord = await this.callRepository.findByVapiCallId(callId);
			if (!callRecord) {
				console.error("Call record not found for webhook:", callId);
				return;
			}

			// Update call status based on webhook
			if (status === "completed") {
				await this.callRepository.updateStatus(
					callRecord.id,
					CallStatus.COMPLETED
				);
				if (duration) {
					await this.callRepository.updateDuration(callRecord.id, duration);
				}
			} else if (status === "failed") {
				await this.callRepository.updateStatus(
					callRecord.id,
					CallStatus.FAILED
				);
			}

			// Handle transfer
			if (transferred && transferTo) {
				await this.callRepository.updateTransfer(
					callRecord.id,
					true,
					transferTo
				);
			}

			// Update lead status based on call outcome
			const lead = await this.leadRepository.findById(callRecord.leadId);
			if (lead) {
				if (status === "completed") {
					await this.leadRepository.updateStatus(lead.id, LeadStatus.CALLED);
				} else if (status === "failed") {
					await this.leadRepository.updateStatus(lead.id, LeadStatus.FAILED);
				}
			}
		} catch (error: any) {
			throw new Error(`Failed to handle webhook: ${error.message}`);
		}
	}

	async triggerScheduledCalls(title: string): Promise<any[]> {
		try {
			const dueScheduledCalls =
				await this.leadRepository.findDueScheduledCalls();
			const triggeredCalls = [];

			for (const lead of dueScheduledCalls) {
				try {
					const result = await this.triggerCall(lead.id, title);
					triggeredCalls.push(result);

					// Update scheduled call status
					await this.leadRepository.updateScheduledCall(
						lead.id,
						lead.scheduledCallAt!,
						lead.scheduledCallNote || undefined
					);
				} catch (error: any) {
					console.error(
						`Failed to trigger scheduled call for lead ${lead.id}:`,
						error
					);
				}
			}

			return triggeredCalls;
		} catch (error: any) {
			throw new Error(`Failed to trigger scheduled calls: ${error.message}`);
		}
	}

	async triggerCampaignCalls(
		campaignId: string,
		title: string
	): Promise<any[]> {
		try {
			const campaign = await this.campaignRepository.findById(campaignId);
			if (!campaign) {
				throw new Error("Campaign not found");
			}

			if (campaign.status !== "ACTIVE") {
				throw new Error("Campaign is not active");
			}

			const triggeredCalls = [];
			const maxSimultaneousCalls = 5;

			// Ensure campaign has leads property
			const campaignWithLeads = campaign as any;
			const leads = campaignWithLeads.leads || [];

			for (const lead of leads.slice(0, maxSimultaneousCalls)) {
				if (lead.status === LeadStatus.NEW && !lead.blacklisted) {
					try {
						const result = await this.triggerCall(lead.id, title);
						triggeredCalls.push(result);
					} catch (error: any) {
						console.error(`Failed to trigger call for lead ${lead.id}:`, error);
					}
				}
			}

			return triggeredCalls;
		} catch (error: any) {
			throw new Error(`Failed to trigger campaign calls: ${error.message}`);
		}
	}

	async getCallStats(): Promise<any> {
		try {
			return await this.callRepository.getCallStats();
		} catch (error: any) {
			throw new Error(`Failed to get call statistics: ${error.message}`);
		}
	}

	async getCallsByLead(leadId: string): Promise<any[]> {
		try {
			return await this.callRepository.findByLeadId(leadId);
		} catch (error: any) {
			throw new Error(`Failed to get calls by lead: ${error.message}`);
		}
	}

	async getCallsByCampaign(campaignId: string): Promise<any[]> {
		try {
			return await this.callRepository.findByCampaignId(campaignId);
		} catch (error: any) {
			throw new Error(`Failed to get calls by campaign: ${error.message}`);
		}
	}

	async getTransferredCalls(): Promise<any[]> {
		try {
			return await this.callRepository.findTransferredCalls();
		} catch (error: any) {
			throw new Error(`Failed to get transferred calls: ${error.message}`);
		}
	}

	async getCompletedCalls(): Promise<any[]> {
		try {
			return await this.callRepository.findCompletedCalls();
		} catch (error: any) {
			throw new Error(`Failed to get completed calls: ${error.message}`);
		}
	}

	async getFailedCalls(): Promise<any[]> {
		try {
			return await this.callRepository.findFailedCalls();
		} catch (error: any) {
			throw new Error(`Failed to get failed calls: ${error.message}`);
		}
	}

	async updateCallNotes(callId: string, notes: string): Promise<any> {
		try {
			return await this.callRepository.updateNotes(callId, notes);
		} catch (error: any) {
			throw new Error(`Failed to update call notes: ${error.message}`);
		}
	}

	async getRecentCalls(limit: number = 50): Promise<any[]> {
		try {
			return await this.callRepository.findRecentCalls(limit);
		} catch (error: any) {
			throw new Error(`Failed to get recent calls: ${error.message}`);
		}
	}

	async getCallById(callId: string): Promise<any> {
		try {
			return await this.callRepository.findById(callId);
		} catch (error: any) {
			throw new Error(`Failed to get call by ID: ${error.message}`);
		}
	}

	async getCallByVapiId(vapiCallId: string): Promise<any> {
		try {
			return await this.callRepository.findByVapiCallId(vapiCallId);
		} catch (error: any) {
			throw new Error(`Failed to get call by Vapi ID: ${error.message}`);
		}
	}
}
