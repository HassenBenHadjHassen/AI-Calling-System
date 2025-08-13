import { CallRepository } from "../repositories/callRepository";
import { LeadRepository } from "../repositories/leadRepository";
import { vapiService } from "./vapiService";
import { socketService } from "./socketService";
import { LeadStatus, CallStatus } from "@prisma/client";

interface PollingSession {
	interval: NodeJS.Timeout;
	startTime: number;
	attempts: number;
	dbCallId: string;
}

interface PollingConfig {
	activeCallInterval: number;
	staleCallInterval: number;
	maxPollingDuration: number;
	retryAttempts: number;
	retryDelay: number;
	batchSize: number;
	lookbackMinutes: number;
}

export class CallStatusPoller {
	private readonly activePollers: Map<string, PollingSession> = new Map();
	private readonly callRepository: CallRepository;
	private readonly leadRepository: LeadRepository;
	private batchReconcileInterval?: NodeJS.Timeout;

	private readonly config: PollingConfig = {
		activeCallInterval: 5000, // 5 seconds for active calls
		staleCallInterval: 300000, // 5 minutes for stale calls
		maxPollingDuration: 900000, // 15 minutes max
		retryAttempts: 3,
		retryDelay: 1000,
		batchSize: 100,
		lookbackMinutes: 60,
	};

	constructor() {
		this.callRepository = new CallRepository();
		this.leadRepository = new LeadRepository();
	}

	/**
	 * Compute duration from available timestamps when explicit duration is missing
	 */
	private computeDurationFromTimestamps(vapiCall: any): number | undefined {
		try {
			const toMs = (val: any): number | undefined => {
				if (!val) return undefined;
				const d = new Date(val);
				const ms = d.getTime();
				return Number.isFinite(ms) ? ms : undefined;
			};

			const startMs =
				toMs(vapiCall.startedAt) ||
				toMs(vapiCall.startTime) ||
				toMs(vapiCall.createdAt);
			const endMs =
				toMs(vapiCall.endedAt) ||
				toMs(vapiCall.completedAt) ||
				toMs(vapiCall.endTime) ||
				toMs(vapiCall.updatedAt);

			if (
				typeof startMs === "number" &&
				typeof endMs === "number" &&
				endMs >= startMs
			) {
				return Math.round((endMs - startMs) / 1000);
			}
		} catch {
			// ignore
		}
		return undefined;
	}

	/**
	 * Start polling for a specific call
	 */
	startPolling(vapiCallId: string, dbCallId: string): void {
		// Avoid duplicate pollers
		if (this.activePollers.has(vapiCallId)) {
			console.log(`📞 Poller already active for ${vapiCallId}`);
			return;
		}

		console.log(`📞 Starting poller for call ${vapiCallId} (DB: ${dbCallId})`);

		const session: PollingSession = {
			interval: setInterval(async () => {
				await this.pollCallStatus(vapiCallId, dbCallId);
			}, this.config.activeCallInterval),
			startTime: Date.now(),
			attempts: 0,
			dbCallId,
		};

		this.activePollers.set(vapiCallId, session);
	}

	/**
	 * Stop polling for a specific call
	 */
	stopPolling(vapiCallId: string): void {
		const session = this.activePollers.get(vapiCallId);
		if (session) {
			clearInterval(session.interval);
			this.activePollers.delete(vapiCallId);
			console.log(`📞 Stopped poller for ${vapiCallId}`);
		}
	}

	/**
	 * Poll Vapi.ai for call status
	 */
	private async pollCallStatus(
		vapiCallId: string,
		dbCallId: string
	): Promise<void> {
		const session = this.activePollers.get(vapiCallId);
		if (!session) return;

		// Check if we've exceeded max polling duration
		if (Date.now() - session.startTime > this.config.maxPollingDuration) {
			console.log(`📞 Max polling duration reached for ${vapiCallId}`);
			this.stopPolling(vapiCallId);
			return;
		}

		try {
			const call = await vapiService.getCall(vapiCallId);

			const currentStatus = (call as any)?.status as string | undefined;
			const cost = call.cost;

			// Try to get duration from Vapi response, fallback to computing from timestamps
			let duration = (call as any)?.duration as number | undefined;
			if (duration === undefined) {
				duration = this.computeDurationFromTimestamps(call);
				if (duration !== undefined) {
					console.log(
						`📞 Computed duration from timestamps: ${duration} seconds`
					);
				}
			}

			const recordingUrl = (call as any)?.recordingUrl as string | undefined;
			const stereoRecordingUrl = (call as any)?.stereoRecordingUrl as
				| string
				| undefined;
			if (recordingUrl && stereoRecordingUrl) {
				console.log(`📞 Recording URL: ${recordingUrl}`);
				await this.callRepository.updateRecordings(
					dbCallId,
					recordingUrl,
					stereoRecordingUrl
				);
			}

			// Extract and save messages from Vapi call
			const messages = (call as any)?.messages as any[] | undefined;
			if (messages && messages.length > 0) {
				console.log(`📞 Saving ${messages.length} messages to database`);
				await this.callRepository.updateMessages(dbCallId, messages);
			}

			if (!currentStatus) {
				session.attempts++;
				if (session.attempts >= this.config.retryAttempts) {
					console.error(`📞 Max retry attempts reached for ${vapiCallId}`);
					this.stopPolling(vapiCallId);
				}
				return;
			}

			// Reset attempts on successful response
			session.attempts = 0;

			if (this.isTerminalVapiStatus(currentStatus)) {
				await this.handleTerminalStatus(
					vapiCallId,
					dbCallId,
					currentStatus,
					duration,
					cost
				);
				this.stopPolling(vapiCallId);
			}
		} catch (error: any) {
			console.error(`📞 Polling error for ${vapiCallId}:`, error.message);
			session.attempts++;

			if (session.attempts >= this.config.retryAttempts) {
				console.error(`📞 Max retry attempts reached for ${vapiCallId}`);
				this.stopPolling(vapiCallId);
			}
		}
	}

	/**
	 * Handle terminal status updates
	 */
	private async handleTerminalStatus(
		vapiCallId: string,
		dbCallId: string,
		status: string,
		duration?: number,
		cost?: number
	): Promise<void> {
		try {
			// Fetch full call details to inspect end reason/metadata
			const vapiCall = await vapiService.getCall(vapiCallId);
			const normalizedStatus = status.toLowerCase();

			// Extract call metadata for logging and notes generation
			const endedBy: string | undefined =
				(vapiCall as any)?.endedBy ||
				(vapiCall as any)?.endBy ||
				(vapiCall as any)?.hangupBy;
			const endReason: string | undefined =
				(vapiCall as any)?.endReason ||
				(vapiCall as any)?.endedReason ||
				(vapiCall as any)?.statusReason ||
				(vapiCall as any)?.reason;

			// Map Vapi status to our CallStatus
			const isCompleted = ["completed", "ended"].includes(normalizedStatus);
			let newStatus: CallStatus;

			// Check if call was transferred by assistant
			if (endReason && endReason.toLowerCase() === "assistant-forwarded-call") {
				newStatus = CallStatus.TRANSFERRED;
			} else if (
				endReason &&
				endReason.toLowerCase() === "customer-did-not-answer"
			) {
				// Customer did not answer should be marked as FAILED
				newStatus = CallStatus.FAILED;
			} else if (isCompleted) {
				// If call is completed/ended, it means user picked up and spoke
				// This should be marked as COMPLETED, not FAILED
				newStatus = CallStatus.COMPLETED;
			} else {
				// Only mark as FAILED for actual failures (no answer, API issues, etc.)
				newStatus = CallStatus.FAILED;
			}

			// Update call status and duration/cost in database
			await this.callRepository.updateStatus(dbCallId, newStatus);

			// Check if the call ended with "customer-did-not-answer" reason
			const isCustomerDidNotAnswer =
				endReason && endReason.toLowerCase() === "customer-did-not-answer";

			const customerBusy =
				endReason && endReason.toLowerCase() === "customer-busy";

			// Try to get duration from Vapi response, fallback to computing from timestamps
			let vapiDuration = (vapiCall as any)?.duration as number | undefined;
			if (vapiDuration === undefined) {
				vapiDuration = this.computeDurationFromTimestamps(vapiCall);
				if (vapiDuration !== undefined) {
					console.log(
						`📞 Computed duration from timestamps in handleTerminalStatus: ${vapiDuration} seconds`
					);
				}
			}

			const vapiCost = vapiCall.cost;

			// If customer did not answer, set duration and cost to 0
			if (isCustomerDidNotAnswer || customerBusy) {
				console.log(
					`📞 Call ended with customer-did-not-answer, setting duration and cost to 0`
				);
				await this.callRepository.updateDuration(dbCallId, 0, 0);
			} else {
				// Update duration and cost if available
				if (vapiDuration !== undefined || vapiCost !== undefined) {
					await this.callRepository.updateDuration(
						dbCallId,
						vapiDuration || 0,
						vapiCost
					);
				}
			}

			// Update lead status based on call outcome
			const dbCall = await this.callRepository.findById(dbCallId);
			if (dbCall) {
				let newLeadStatus: LeadStatus;

				if (newStatus === CallStatus.TRANSFERRED) {
					newLeadStatus = LeadStatus.TRANSFERRED;
				} else if (newStatus === CallStatus.COMPLETED) {
					newLeadStatus = LeadStatus.CALLED;
				} else {
					newLeadStatus = LeadStatus.FAILED;
				}

				await this.leadRepository.updateStatus(dbCall.leadId, newLeadStatus);
			}

			// Extract and update call notes
			await this.extractAndUpdateCallNotes(vapiCallId, dbCallId);

			console.log(
				`📞 Call ${vapiCallId} finalized: ${newStatus} (duration: ${
					vapiDuration ?? duration ?? 0
				}s, cost: $${vapiCost ?? cost ?? 0} USD)`
			);

			// Emit real-time update
			socketService.emitToCall(dbCallId, "call-completed", {
				callId: dbCallId,
				vapiCallId,
				status: newStatus,
				duration: vapiDuration ?? duration,
				cost: vapiCost ?? cost,
				endedBy,
				endReason,
			});
		} catch (error: any) {
			console.error(
				`📞 Error handling terminal status for ${vapiCallId}:`,
				error.message
			);
		}
	}

	/**
	 * Extract meaningful call notes from Vapi.ai call data
	 */
	private async extractAndUpdateCallNotes(
		vapiCallId: string,
		dbCallId: string
	): Promise<void> {
		try {
			console.log(
				`📝 Extracting call notes for ${dbCallId} (Vapi: ${vapiCallId})`
			);

			const vapiCall = await vapiService.getCall(vapiCallId);
			console.log(`📝 Vapi call data received for ${vapiCallId}:`, {
				status: (vapiCall as any).status,
				duration: (vapiCall as any).duration,
				variables: (vapiCall as any).variables,
				hasTranscript: !!(vapiCall as any).transcript,
				transcriptLength: (vapiCall as any).transcript?.length || 0,
				hasSummary: !!(vapiCall as any).summary,
			});

			const notes = this.generateCallNotes(vapiCall);

			if (notes) {
				console.log(`📝 Generated call notes for ${dbCallId}:`, notes);
				await this.callRepository.updateNotes(dbCallId, notes);
				console.log(`📞 Call notes extracted and saved for ${dbCallId}`);
			} else {
				console.log(`📝 No meaningful call notes generated for ${dbCallId}`);
			}
		} catch (error: any) {
			console.error(
				`📞 Error extracting call notes for ${dbCallId}:`,
				error.message
			);
		}
	}

	/**
	 * Generate meaningful call notes from Vapi call data
	 */
	private generateCallNotes(vapiCall: any): string | null {
		try {
			console.log(`📝 Generating call notes from Vapi data:`, {
				status: vapiCall.status,
				variables: vapiCall.variables,
				hasTranscript: !!vapiCall.transcript,
				hasSummary: !!vapiCall.summary,
				duration: vapiCall.duration,
			});

			const notes: string[] = [];

			// Extract interest level if available
			if (vapiCall.variables?.interest_level) {
				const interest = vapiCall.variables.interest_level;
				notes.push(`Interest Level: ${interest}`);
				console.log(`📝 Extracted interest level: ${interest}`);
			}

			// Extract availability if available
			if (vapiCall.variables?.user_availability) {
				const availability = vapiCall.variables.user_availability;
				notes.push(`Availability: ${availability}`);
				console.log(`📝 Extracted availability: ${availability}`);
			}

			// Extract contact status if available
			if (vapiCall.variables?.contact) {
				const contact = vapiCall.variables.contact;
				notes.push(`Previously Contacted: ${contact}`);
				console.log(`📝 Extracted contact status: ${contact}`);
			}

			// Extract reschedule date if available
			if (vapiCall.variables?.reschedule_date) {
				const rescheduleDate = vapiCall.variables.reschedule_date;
				notes.push(`Rescheduled to: ${rescheduleDate}`);
				console.log(`📝 Extracted reschedule date: ${rescheduleDate}`);
			}

			// Extract subject if transfer was requested
			if (vapiCall.variables?.subject) {
				const subject = vapiCall.variables.subject;
				notes.push(`Transfer Subject: ${subject}`);
				console.log(`📝 Extracted transfer subject: ${subject}`);
			}

			// Add call outcome based on status and end reason
			const status = String(vapiCall.status || "").toLowerCase();
			const endedBy: string | undefined =
				vapiCall.endedBy || vapiCall.endBy || vapiCall.hangupBy;
			const endReason: string | undefined =
				vapiCall.endReason ||
				vapiCall.endedReason ||
				vapiCall.statusReason ||
				vapiCall.reason;
			// Note: We no longer use userHungUp logic since completed calls are considered successful
			// regardless of who hung up, as long as the user picked up and spoke

			if (status === "completed" || status === "ended") {
				// If call is completed/ended, it means user picked up and spoke
				// This is a successful call, regardless of who hung up
				notes.push("Call Outcome: Completed successfully");
				console.log(`📝 Call outcome: Completed successfully`);
				if (endedBy) {
					notes.push(`Ended By: ${endedBy}`);
				}
				if (endReason) {
					notes.push(`End Reason: ${endReason}`);
				}
			} else if (status === "failed") {
				notes.push("Call Outcome: Failed");
				console.log(`📝 Call outcome: Failed`);
			} else if (status === "no-answer") {
				notes.push("Call Outcome: No answer");
				console.log(`📝 Call outcome: No answer`);
			} else if (status === "busy") {
				notes.push("Call Outcome: Busy");
				console.log(`📝 Call outcome: Busy`);
			} else if (status === "canceled" || status === "cancelled") {
				notes.push("Call Outcome: Cancelled");
				console.log(`📝 Call outcome: Cancelled`);
			}

			// Add duration if available
			if (typeof vapiCall.duration === "number") {
				notes.push(`Call Duration: ${vapiCall.duration} seconds`);
				console.log(`📝 Call duration: ${vapiCall.duration} seconds`);
			}

			// Add summary if available
			if (vapiCall.summary) {
				notes.push(`Summary: ${vapiCall.summary}`);
				console.log(`📝 Call summary: ${vapiCall.summary}`);
			}

			// Add key conversation points if transcript is available
			if (vapiCall.transcript && Array.isArray(vapiCall.transcript)) {
				console.log(
					`📝 Analyzing transcript with ${vapiCall.transcript.length} messages`
				);
				const keyPoints = this.extractKeyConversationPoints(
					vapiCall.transcript
				);
				if (keyPoints.length > 0) {
					notes.push(`Key Points: ${keyPoints.join(", ")}`);
					console.log(`📝 Extracted key points: ${keyPoints.join(", ")}`);
				} else {
					console.log(`📝 No key conversation points found in transcript`);
				}
			} else {
				console.log(`📝 No transcript available for analysis`);
			}

			const result = notes.length > 0 ? notes.join("\n") : null;
			console.log(`📝 Final call notes generated:`, result ? "Yes" : "No");
			return result;
		} catch (error: any) {
			console.error("Error generating call notes:", error.message);
			return null;
		}
	}

	/**
	 * Extract key conversation points from transcript
	 */
	private extractKeyConversationPoints(transcript: any[]): string[] {
		const keyPoints: string[] = [];

		try {
			console.log(
				`📝 Analyzing ${transcript.length} transcript messages for key phrases`
			);

			for (const message of transcript) {
				if (message.role === "user" && message.content) {
					const content = message.content.toLowerCase();
					console.log(
						`📝 Analyzing user message: "${message.content.substring(
							0,
							100
						)}..."`
					);

					// Look for key phrases indicating interest or outcomes
					if (
						content.includes("intéressé") ||
						content.includes("intéressant")
					) {
						keyPoints.push("Client showed interest");
						console.log(`📝 Found interest indicator: "${content}"`);
					}
					if (content.includes("pas intéressé") || content.includes("refuse")) {
						keyPoints.push("Client not interested");
						console.log(`📝 Found disinterest indicator: "${content}"`);
					}
					if (content.includes("occupé") || content.includes("pas le temps")) {
						keyPoints.push("Client busy");
						console.log(`📝 Found busy indicator: "${content}"`);
					}
					if (content.includes("rappel") || content.includes("plus tard")) {
						keyPoints.push("Client requested callback");
						console.log(`📝 Found callback request: "${content}"`);
					}
					if (content.includes("transfert") || content.includes("humain")) {
						keyPoints.push("Client requested human transfer");
						console.log(`📝 Found transfer request: "${content}"`);
					}
				}
			}

			console.log(`📝 Extracted ${keyPoints.length} key conversation points`);
		} catch (error: any) {
			console.error("Error extracting key conversation points:", error.message);
		}

		return keyPoints;
	}

	/**
	 * Check if Vapi status is terminal
	 */
	private isTerminalVapiStatus(vapiStatus: string | undefined): boolean {
		if (!vapiStatus) return false;

		const terminal = new Set([
			"completed",
			"ended",
			"failed",
			"no-answer",
			"busy",
			"canceled",
			"cancelled",
		]);
		return terminal.has(vapiStatus.toLowerCase());
	}

	/**
	 * Start batch reconciliation for stale calls
	 */
	startBatchReconciliation(): void {
		if (this.batchReconcileInterval) {
			console.log("📞 Batch reconciliation already running");
			return;
		}

		console.log("📞 Starting batch reconciliation");
		this.batchReconcileInterval = setInterval(async () => {
			await this.reconcileStaleCalls();
		}, this.config.staleCallInterval);

		// Run initial reconciliation after startup
		setTimeout(async () => {
			await this.reconcileStaleCalls();
		}, 10000); // 10 seconds after startup
	}

	/**
	 * Stop batch reconciliation
	 */
	stopBatchReconciliation(): void {
		if (this.batchReconcileInterval) {
			clearInterval(this.batchReconcileInterval);
			this.batchReconcileInterval = undefined;
			console.log("📞 Stopped batch reconciliation");
		}
	}

	/**
	 * Reconcile stale calls in batches
	 */
	async reconcileStaleCalls(): Promise<{
		scanned: number;
		finalized: number;
		errors: string[];
	}> {
		const cutoff = new Date(
			Date.now() - this.config.lookbackMinutes * 60 * 1000
		);
		const errors: string[] = [];
		let finalized = 0;
		let stale: any[] = [];

		try {
			stale = await this.callRepository.findStaleInitiatedWithVapiId(
				cutoff,
				this.config.batchSize
			);

			console.log(`📞 Reconciling ${stale.length} stale calls`);

			for (const call of stale) {
				if (!call.vapiCallId) continue;

				try {
					const vapiCall = await vapiService.getCall(call.vapiCallId);
					const currentStatus = (vapiCall as any)?.status as string | undefined;

					// Try to get duration from Vapi response, fallback to computing from timestamps
					let duration = (vapiCall as any)?.duration as number | undefined;
					if (duration === undefined) {
						duration = this.computeDurationFromTimestamps(vapiCall);
						if (duration !== undefined) {
							console.log(
								`📞 Computed duration from timestamps in reconcileStaleCalls: ${duration} seconds`
							);
						}
					}

					if (!currentStatus) continue;
					if (!this.isTerminalVapiStatus(currentStatus)) continue;

					const normalized = currentStatus.toLowerCase();
					const endReason: string | undefined =
						(vapiCall as any)?.endReason ||
						(vapiCall as any)?.endedReason ||
						(vapiCall as any)?.statusReason ||
						(vapiCall as any)?.reason;
					// Note: We no longer use userHungUp logic since completed calls are considered successful
					// regardless of who hung up, as long as the user picked up and spoke

					const isCompleted = ["completed", "ended"].includes(normalized);
					let newStatus: CallStatus;

					// Check if call was transferred by assistant
					if (
						endReason &&
						endReason.toLowerCase() === "assistant-forwarded-call"
					) {
						newStatus = CallStatus.TRANSFERRED;
					} else if (
						endReason &&
						endReason.toLowerCase() === "customer-did-not-answer"
					) {
						// Customer did not answer should be marked as FAILED
						newStatus = CallStatus.FAILED;
					} else if (isCompleted) {
						newStatus = CallStatus.COMPLETED;
					} else {
						newStatus = CallStatus.FAILED;
					}

					await this.callRepository.updateStatus(call.id, newStatus);

					// Check if the call ended with "customer-did-not-answer" reason
					const isCustomerDidNotAnswer =
						endReason && endReason.toLowerCase() === "customer-did-not-answer";

					if (isCustomerDidNotAnswer) {
						console.log(
							`📞 Stale call ${call.id} ended with customer-did-not-answer, setting duration and cost to 0`
						);
						await this.callRepository.updateDuration(call.id, 0, 0);
					} else if (typeof duration === "number") {
						const vapiCost = vapiCall.cost;
						await this.callRepository.updateDuration(
							call.id,
							duration,
							vapiCost
						);
					}

					// Extract meaningful call notes for all terminal calls
					const notes = this.generateCallNotes(vapiCall);
					if (notes) {
						await this.callRepository.updateNotes(call.id, notes);
					}

					finalized++;
				} catch (err: any) {
					errors.push(`Call ${call.id} reconciliation error: ${err.message}`);
				}
			}

			if (finalized > 0) {
				console.log(
					`📞 Batch reconciliation completed: ${finalized} calls finalized`
				);
			}
		} catch (error: any) {
			console.error("📞 Batch reconciliation error:", error.message);
			errors.push(`Batch reconciliation failed: ${error.message}`);
		}

		return { scanned: stale.length, finalized, errors };
	}

	/**
	 * Get polling statistics
	 */
	getPollingStats(): {
		activePollers: number;
		config: PollingConfig;
	} {
		return {
			activePollers: this.activePollers.size,
			config: this.config,
		};
	}

	/**
	 * Stop all polling
	 */
	stopAllPolling(): void {
		for (const [vapiCallId] of this.activePollers) {
			this.stopPolling(vapiCallId);
		}
		this.stopBatchReconciliation();
		console.log("📞 All polling stopped");
	}
}

// Export singleton instance
export const callStatusPoller = new CallStatusPoller();
