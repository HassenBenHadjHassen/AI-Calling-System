import { CallRepository } from "../repositories/callRepository";
import { LeadRepository } from "../repositories/leadRepository";
import { CampaignRepository } from "../repositories/campaignRepository";
import { vapiService } from "./vapiService";
import { CallStatus, LeadStatus, ScheduledCallStatus } from "@prisma/client";
import { socketService } from "./socketService";
import { callStatusPoller } from "./callStatusPoller";
import { activeCallManager } from "./activeCallManager";
import { env } from "../config/env";

export class CallService {
	private callRepository: CallRepository;
	private leadRepository: LeadRepository;
	private campaignRepository: CampaignRepository;

	// Active status polling now handled by CallStatusPoller

	// Global call management
	private callQueue: Array<{
		leadId: string;
		title: string;
		isScheduled: boolean;
		priority: number; // Higher number = higher priority
		timestamp: Date;
	}> = [];

	constructor() {
		this.callRepository = new CallRepository();
		this.leadRepository = new LeadRepository();
		this.campaignRepository = new CampaignRepository();
	}

	/**
	 * Get current active call count
	 */
	private getActiveCallCount(): number {
		return activeCallManager.getActiveCallCount();
	}

	/**
	 * Check if we can make a new call
	 */
	private canMakeCall(): boolean {
		return activeCallManager.canMakeCall();
	}

	/**
	 * Add a call to the active calls set
	 */
	private addActiveCall(callId: string): void {
		activeCallManager.addActiveCall(callId);
	}

	/**
	 * Remove a call from the active calls set
	 */
	private removeActiveCall(callId: string): void {
		activeCallManager.removeActiveCall(callId);
	}

	/**
	 * Add a call to the queue with priority
	 */
	private addToQueue(
		leadId: string,
		title: string,
		isScheduled: boolean
	): void {
		const priority = isScheduled ? 2 : 1; // Scheduled calls have higher priority
		this.callQueue.push({
			leadId,
			title,
			isScheduled,
			priority,
			timestamp: new Date(),
		});

		// Sort queue by priority (highest first) and then by timestamp (oldest first)
		this.callQueue.sort((a, b) => {
			if (a.priority !== b.priority) {
				return b.priority - a.priority; // Higher priority first
			}
			return a.timestamp.getTime() - b.timestamp.getTime(); // Older first
		});
	}

	/**
	 * Process the call queue
	 */
	private async processQueue(): Promise<void> {
		while (this.callQueue.length > 0 && this.canMakeCall()) {
			const queuedCall = this.callQueue.shift();
			if (queuedCall) {
				try {
					await this.triggerCall(queuedCall.leadId, queuedCall.title);
				} catch (error) {
					console.error(
						`Failed to process queued call for lead ${queuedCall.leadId}:`,
						error
					);
				}
			}
		}
	}

	/**
	 * Get call statistics including queue information
	 */
	async getCallManagementStats(): Promise<{
		activeCalls: number;
		maxCalls: number;
		queueLength: number;
		scheduledInQueue: number;
		campaignInQueue: number;
	}> {
		const scheduledInQueue = this.callQueue.filter(
			(call) => call.isScheduled
		).length;
		const campaignInQueue = this.callQueue.filter(
			(call) => !call.isScheduled
		).length;

		return {
			activeCalls: this.getActiveCallCount(),
			maxCalls: activeCallManager.getMaxGlobalCalls(),
			queueLength: this.callQueue.length,
			scheduledInQueue,
			campaignInQueue,
		};
	}

	/**
	 * Get detailed information about queued calls
	 */
	async getQueuedCalls(): Promise<
		Array<{
			leadId: string;
			title: string;
			isScheduled: boolean;
			priority: number;
			timestamp: Date;
			queuePosition: number;
			estimatedWaitTime?: number; // in minutes
			lead?: any; // Lead information if available
		}>
	> {
		const queuedCallsWithLeads = await Promise.all(
			this.callQueue.map(async (call, index) => {
				// Calculate estimated wait time based on position and average call duration
				const averageCallDurationMinutes = 5; // Average 5 minutes per call
				const estimatedWaitTime = index * averageCallDurationMinutes;

				// Try to get lead information
				let lead = null;
				try {
					lead = await this.leadRepository.findById(call.leadId);
				} catch (error) {
					console.warn(
						`Could not fetch lead information for leadId: ${call.leadId}`
					);
				}

				return {
					...call,
					queuePosition: index + 1,
					estimatedWaitTime:
						estimatedWaitTime > 0 ? estimatedWaitTime : undefined,
					lead,
				};
			})
		);

		return queuedCallsWithLeads;
	}

	/**
	 * Calculate the next retry time for a failed call
	 * If current time is between 8am-10pm, schedule for 1 hour later
	 * If outside business hours, schedule for next day at 8am
	 */
	private calculateNextRetryTime(): Date {
		const now = new Date();
		const currentHour = now.getHours();

		// Business hours: 8am (8) to 10pm (22)
		const businessStartHour = 8;
		const businessEndHour = 22;

		let nextRetryTime = new Date(now);

		if (currentHour >= businessStartHour && currentHour < businessEndHour) {
			// Within business hours: schedule for 1 hour later
			nextRetryTime.setHours(currentHour + 1);
		} else {
			// Outside business hours: schedule for next day at 8am
			nextRetryTime.setDate(now.getDate() + 1);
			nextRetryTime.setHours(businessStartHour);
		}

		return nextRetryTime;
	}

	/**
	 * Format phone number to E.164 format for Vapi.ai
	 */
	private formatPhoneNumber(phone: string): string {
		if (!phone) {
			throw new Error("Phone number is required");
		}

		// Remove all non-digit characters except +
		let cleaned = phone.replace(/[^\d+]/g, "");

		// Already valid E.164 format
		if (cleaned.startsWith("+")) {
			return cleaned;
		}

		// ---------- Tunisian formats ----------
		const tunisianMobileWithZero = cleaned.match(/^0(2\d{7})$/);
		if (tunisianMobileWithZero) {
			return `+216${tunisianMobileWithZero[1]}`;
		}

		const tunisianLandlineWithZero = cleaned.match(/^0(7\d{7})$/);
		if (tunisianLandlineWithZero) {
			return `+216${tunisianLandlineWithZero[1]}`;
		}

		if (cleaned.length === 8 && /^[27]/.test(cleaned)) {
			return `+216${cleaned}`;
		}

		if (
			(cleaned.length === 10 || cleaned.length === 11) &&
			cleaned.startsWith("216")
		) {
			return `+${cleaned}`;
		}

		// ---------- French formats ----------
		const frenchWithZero = cleaned.match(/^0(\d{9})$/);
		if (frenchWithZero) {
			return `+33${frenchWithZero[1]}`;
		}

		if (cleaned.length === 9 && /^\d{9}$/.test(cleaned)) {
			return `+33${cleaned}`;
		}

		if (cleaned.length === 10 && cleaned.startsWith("0")) {
			return `+33${cleaned.substring(1)}`;
		}

		if (cleaned.length === 10 && !cleaned.startsWith("0")) {
			return `+33${cleaned}`;
		}

		if (cleaned.length === 11 && cleaned.startsWith("33")) {
			return `+${cleaned}`;
		}

		// ---------- US formats ----------
		// US numbers are typically 10 digits (area code + 7-digit number)
		if (cleaned.length === 10 && /^\d{10}$/.test(cleaned)) {
			return `+1${cleaned}`;
		}

		// US numbers with country code already (1 + 10 digits)
		if (cleaned.length === 11 && cleaned.startsWith("1")) {
			return `+${cleaned}`;
		}

		// ---------- Fallback ----------
		return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
	}

	async triggerCall(
		leadId: string,
		title: string,
		isScheduled: boolean = false
	): Promise<any> {
		try {
			const lead = await this.leadRepository.findById(leadId);
			if (!lead) {
				throw new Error("Lead not found");
			}

			if (lead.blacklisted) {
				throw new Error("Cannot call blacklisted lead");
			}

			// Allow calls for NEW leads or SCHEDULED leads when isScheduled is true
			if (
				lead.status !== LeadStatus.NEW &&
				!(isScheduled && lead.status === LeadStatus.SCHEDULED)
			) {
				throw new Error(
					`Cannot call lead with status: ${lead.status}. Only NEW leads can be called, or SCHEDULED leads when executing scheduled calls.`
				);
			}

			// if a call is scheduled make sure it doesnt call before the scheduled time
			if (lead.scheduledCallAt && lead.scheduledCallAt > new Date()) {
				throw new Error("Cannot call before scheduled time");
			}

			// Check if we can make a call right now
			if (!this.canMakeCall()) {
				// Add to queue instead
				this.addToQueue(leadId, title, isScheduled);
				console.log(
					`📞 Call for lead ${leadId} queued (${this.getActiveCallCount()}/${activeCallManager.getMaxGlobalCalls()} active calls)`
				);
				return {
					queued: true,
					queuePosition: this.callQueue.length,
					activeCalls: this.getActiveCallCount(),
					maxCalls: activeCallManager.getMaxGlobalCalls(),
				};
			}

			// Create call record
			const callRecord = await this.callRepository.create({
				leadId: lead.id,
				campaignId: lead.campaignId || undefined,
				callStatus: CallStatus.INITIATED,
				fromNumber: env.TWILIO_FROM_NUMBER,
				toNumber: lead.phone1,
			});

			try {
				// Add to active calls
				this.addActiveCall(callRecord.id);

				// Format phone number to E.164 format for Vapi.ai
				const formattedPhoneNumber = this.formatPhoneNumber(lead.phone1);

				// Trigger call via Vapi.ai
				const vapiResponse = await vapiService.createCall({
					phoneNumber: formattedPhoneNumber,
					name: lead.name,
					title: title,
				});

				// Update call record with Vapi call ID
				const vapiCallId = (vapiResponse as any).id;
				if (vapiCallId) {
					await this.callRepository.updateVapiCallId(callRecord.id, vapiCallId);
					// Start enhanced polling for call status
					callStatusPoller.startPolling(vapiCallId, callRecord.id);
				}

				console.log(
					`📞 Call initiated for lead ${leadId} (${this.getActiveCallCount()}/${activeCallManager.getMaxGlobalCalls()} active calls)`
				);

				// Process queue after successful call initiation
				setTimeout(() => this.processQueue(), 1000);

				return {
					callId: callRecord.id,
					callRecord,
					vapiCallId,
					activeCalls: this.getActiveCallCount(),
				};
			} catch (error: any) {
				// Remove from active calls on failure
				this.removeActiveCall(callRecord.id);

				// Update call record as failed
				await this.callRepository.updateStatus(
					callRecord.id,
					CallStatus.FAILED
				);

				// Schedule retry for failed call
				const maxRetries = 3;
				if (lead.retryCount >= maxRetries) {
					// Max retries reached, mark as permanently failed
					await this.leadRepository.updateStatus(lead.id, LeadStatus.FAILED);
					console.log(
						`Lead ${lead.id} has reached max retries (${maxRetries}), marking as permanently failed`
					);
				} else {
					const nextRetryTime = this.calculateNextRetryTime();
					await this.leadRepository.updateScheduledCall(
						lead.id,
						nextRetryTime,
						`Retry ${
							lead.retryCount + 1
						}/${maxRetries} scheduled after failed call trigger at ${new Date().toLocaleString()}`
					);
					console.log(
						`Scheduled retry ${lead.retryCount + 1}/${maxRetries} for lead ${
							lead.id
						} at ${nextRetryTime.toLocaleString()}`
					);
				}

				throw new Error(`Failed to trigger call via Vapi: ${error.message}`);
			}
		} catch (error: any) {
			throw new Error(`Failed to trigger call: ${error.message}`);
		}
	}

	// Webhook handling removed - replaced with enhanced polling system
	// All call status updates now handled by CallStatusPoller

	// Old polling methods removed - replaced with CallStatusPoller

	async triggerScheduledCalls(title: string): Promise<any[]> {
		try {
			const dueScheduledCalls =
				await this.leadRepository.findDueScheduledCalls();
			const triggeredCalls = [];

			for (const lead of dueScheduledCalls) {
				try {
					const result = await this.triggerCall(lead.id, title, true); // isScheduled = true
					triggeredCalls.push(result);

					// Clear the scheduled call since it has been triggered
					await this.leadRepository.clearScheduledCall(lead.id);
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

	/**
	 * Handle overdue rescheduled calls that have passed their scheduled time
	 * without being called. Update their status to "called" and clear the schedule.
	 */
	async handleOverdueRescheduledCalls(): Promise<number> {
		try {
			const now = new Date();

			// Find leads that have a scheduled call time in the past
			// and are still in SCHEDULED status (meaning they weren't called)
			const overdueLeads =
				await this.leadRepository.findOverdueScheduledCalls();

			let processedCount = 0;

			for (const lead of overdueLeads) {
				try {
					// Update lead status to CALLED since the scheduled time has passed
					await this.leadRepository.updateStatus(lead.id, LeadStatus.CALLED);

					// Clear the scheduled call data
					await this.leadRepository.clearScheduledCall(lead.id);

					console.log(
						`📅 Updated overdue rescheduled call for lead ${lead.id} (${
							lead.name
						}) - scheduled for ${lead.scheduledCallAt?.toLocaleString()} but not called`
					);

					processedCount++;
				} catch (error: any) {
					console.error(
						`Failed to handle overdue rescheduled call for lead ${lead.id}:`,
						error
					);
				}
			}

			if (processedCount > 0) {
				console.log(`📅 Processed ${processedCount} overdue rescheduled calls`);
			}

			return processedCount;
		} catch (error: any) {
			throw new Error(
				`Failed to handle overdue rescheduled calls: ${error.message}`
			);
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

			// Ensure campaign has leads property
			const campaignWithLeads = campaign as any;
			const leads = campaignWithLeads.leads || [];

			// Process all eligible leads (global limit is handled in triggerCall)
			for (const lead of leads) {
				if (lead.status === LeadStatus.NEW && !lead.blacklisted) {
					try {
						const result = await this.triggerCall(lead.id, title, false); // isScheduled = false
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
		return await this.callRepository.findByVapiCallId(vapiCallId);
	}

	/**
	 * Get the current or most recent Vapi call ID for a given phone number
	 */
	async getVapiCallIdByPhone(phoneNumber: string): Promise<string | null> {
		try {
			const formatted = this.formatPhoneNumber(phoneNumber);
			const lead = await this.leadRepository.findByPhone(formatted);
			if (!lead) return null;

			const calls = await this.callRepository.findByLeadId(lead.id);
			// Prefer an INITIATED call; otherwise fall back to the most recent with a vapiCallId
			const active =
				calls.find(
					(c: any) => c.vapiCallId && c.callStatus === CallStatus.INITIATED
				) || calls.find((c: any) => c.vapiCallId);

			return active?.vapiCallId || null;
		} catch (error) {
			console.warn(
				"Failed to get Vapi call ID by phone:",
				(error as any)?.message || error
			);
			return null;
		}
	}

	/**
	 * Reconcile stale calls that remained INITIATED due to missed webhooks.
	 * Looks back a window and polls Vapi to finalize status.
	 */
	async reconcileStaleInitiatedCalls(
		lookbackMinutes: number = 60,
		batchSize: number = 100
	): Promise<{
		scanned: number;
		finalized: number;
		errors: string[];
	}> {
		// Delegate to the new CallStatusPoller for reconciliation
		return await callStatusPoller.reconcileStaleCalls();
	}

	// ===== LIVE CALL CONTROL METHODS =====

	/**
	 * Make the assistant say a specific message during a live call
	 */
	async sayMessage(
		vapiCallId: string,
		message: string,
		endCallAfterSpoken: boolean = false
	): Promise<void> {
		try {
			await vapiService.sayMessage(vapiCallId, message, endCallAfterSpoken);

			// Emit real-time update
			socketService.emitToCall(vapiCallId, "message-sent", {
				callId: vapiCallId,
				message,
				endCallAfterSpoken,
				timestamp: new Date().toISOString(),
			});

			// Update call record with the action
			const callRecord = await this.getCallByVapiId(vapiCallId);
			if (callRecord) {
				await this.callRepository.updateNotes(
					callRecord.id,
					`[${new Date().toISOString()}] Manual message sent: "${message}"`
				);
			}
		} catch (error: any) {
			console.error("Error saying message:", error);
			throw new Error(`Failed to say message: ${error.message}`);
		}
	}

	/**
	 * Add a message to the conversation history
	 */
	async addMessageToConversation(
		vapiCallId: string,
		message: { role: "system" | "user" | "assistant"; content: string },
		triggerResponse: boolean = true
	): Promise<void> {
		try {
			await vapiService.addMessageToConversation(
				vapiCallId,
				message,
				triggerResponse
			);

			// Emit real-time update
			socketService.emitToCall(vapiCallId, "conversation-message-added", {
				callId: vapiCallId,
				message,
				triggerResponse,
				timestamp: new Date().toISOString(),
			});

			// Update call record with the action
			const callRecord = await this.getCallByVapiId(vapiCallId);
			if (callRecord) {
				await this.callRepository.updateNotes(
					callRecord.id,
					`[${new Date().toISOString()}] Message added to conversation: ${
						message.role
					}: "${message.content}"`
				);
			}
		} catch (error: any) {
			console.error("Error adding message to conversation:", error);
			throw new Error(
				`Failed to add message to conversation: ${error.message}`
			);
		}
	}

	/**
	 * Control assistant behavior (mute/unmute)
	 */
	async controlAssistant(
		vapiCallId: string,
		control: "mute-assistant" | "unmute-assistant" | "say-first-message"
	): Promise<void> {
		try {
			await vapiService.controlAssistant(vapiCallId, control);

			// Emit real-time update
			socketService.emitToCall(vapiCallId, "assistant-controlled", {
				callId: vapiCallId,
				control,
				timestamp: new Date().toISOString(),
			});

			// Update call record with the action
			const callRecord = await this.getCallByVapiId(vapiCallId);
			if (callRecord) {
				const actionText =
					control === "mute-assistant"
						? "Assistant muted"
						: control === "unmute-assistant"
						? "Assistant unmuted"
						: "Assistant first message triggered";
				await this.callRepository.updateNotes(
					callRecord.id,
					`[${new Date().toISOString()}] ${actionText}`
				);
			}
		} catch (error: any) {
			console.error("Error controlling assistant:", error);
			throw new Error(`Failed to control assistant: ${error.message}`);
		}
	}

	/**
	 * End the call programmatically
	 */
	async endCall(vapiCallId: string): Promise<void> {
		try {
			await vapiService.endCall(vapiCallId);

			// Emit real-time update
			socketService.emitToCall(vapiCallId, "call-ended", {
				callId: vapiCallId,
				reason: "manual_end",
				timestamp: new Date().toISOString(),
			});

			// Update call record
			const callRecord = await this.getCallByVapiId(vapiCallId);
			if (callRecord) {
				// Mark as FAILED in our domain when manually ended via control
				await this.callRepository.updateStatus(
					callRecord.id,
					CallStatus.FAILED
				);
				await this.callRepository.updateNotes(
					callRecord.id,
					`[${new Date().toISOString()}] Call ended manually`
				);
			}
		} catch (error: any) {
			console.error("Error ending call:", error);
			throw new Error(`Failed to end call: ${error.message}`);
		}
	}

	/**
	 * Transfer the call to another number
	 */
	async transferCall(
		vapiCallId: string,
		destinationNumber: string,
		transferMessage?: string
	): Promise<void> {
		try {
			// Format destination phone number to E.164 format
			const formattedDestinationNumber =
				this.formatPhoneNumber(destinationNumber);

			await vapiService.transferCall(
				vapiCallId,
				formattedDestinationNumber,
				transferMessage
			);

			// Emit real-time update
			socketService.emitToCall(vapiCallId, "call-transferred", {
				callId: vapiCallId,
				destinationNumber: formattedDestinationNumber,
				transferMessage,
				timestamp: new Date().toISOString(),
			});

			// Update call record
			const callRecord = await this.getCallByVapiId(vapiCallId);
			if (callRecord) {
				await this.callRepository.updateStatus(
					callRecord.id,
					CallStatus.TRANSFERRED
				);
				await this.callRepository.updateNotes(
					callRecord.id,
					`[${new Date().toISOString()}] Call transferred to ${formattedDestinationNumber}`
				);
			}
		} catch (error: any) {
			console.error("Error transferring call:", error);
			throw new Error(`Failed to transfer call: ${error.message}`);
		}
	}

	/**
	 * Get call monitoring URLs for real-time control and audio streaming
	 */
	async getCallMonitoringUrls(
		vapiCallId: string
	): Promise<{ listenUrl?: string; controlUrl?: string }> {
		try {
			return await vapiService.getCallMonitoringUrls(vapiCallId);
		} catch (error: any) {
			console.error("Error getting call monitoring URLs:", error);
			throw new Error(`Failed to get call monitoring URLs: ${error.message}`);
		}
	}

	/**
	 * Hang up on all active calls for a campaign
	 */
	async hangUpAllCampaignCalls(campaignId: string): Promise<{
		totalCalls: number;
		successfulHangUps: number;
		failedHangUps: number;
		errors: string[];
	}> {
		try {
			// Find all active calls for the campaign
			const activeCalls = await this.callRepository.findActiveCallsByCampaign(
				campaignId
			);

			if (activeCalls.length === 0) {
				return {
					totalCalls: 0,
					successfulHangUps: 0,
					failedHangUps: 0,
					errors: [],
				};
			}

			const results = {
				totalCalls: activeCalls.length,
				successfulHangUps: 0,
				failedHangUps: 0,
				errors: [] as string[],
			};

			// End each active call
			for (const call of activeCalls) {
				if (call.vapiCallId) {
					try {
						await this.endCall(call.vapiCallId);
						results.successfulHangUps++;

						console.log(
							`📞 Successfully hung up call ${call.vapiCallId} for campaign ${campaignId}`
						);
					} catch (error: any) {
						results.failedHangUps++;
						const errorMsg = `Failed to hang up call ${call.vapiCallId}: ${error.message}`;
						results.errors.push(errorMsg);
						console.error(errorMsg);
					}
				} else {
					results.failedHangUps++;
					const errorMsg = `Call ${call.id} has no Vapi call ID`;
					results.errors.push(errorMsg);
					console.error(errorMsg);
				}
			}

			console.log(
				`📞 Campaign ${campaignId} hang up results: ${results.successfulHangUps}/${results.totalCalls} successful`
			);

			return results;
		} catch (error: any) {
			console.error("Error hanging up campaign calls:", error);
			throw new Error(`Failed to hang up campaign calls: ${error.message}`);
		}
	}
}

// Export singleton instance
export const callService = new CallService();
