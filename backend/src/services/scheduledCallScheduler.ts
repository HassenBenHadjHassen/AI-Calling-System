import { PrismaClient, ScheduledCallStatus, LeadStatus } from "@prisma/client";
import { callService } from "./callService";
import { LeadRepository } from "../repositories/leadRepository";
import { callStatusPoller } from "./callStatusPoller";
import prismaSingleton from "../db/prisma";

export class ScheduledCallScheduler {
	private prisma: PrismaClient;
	private callService = callService;
	private leadRepository = new LeadRepository();
	private schedulerInterval: NodeJS.Timeout | null = null;
	private reconcileInterval: NodeJS.Timeout | null = null;
	private readonly CHECK_INTERVAL = 60000; // Check every minute
	private readonly RECONCILE_INTERVAL = 300000; // Check every 5 minutes
	private readonly DEFAULT_CALL_TITLE = "Scheduled Call";

	constructor() {
		this.prisma = prismaSingleton;
	}

	/**
	 * Start the scheduled call scheduler
	 */
	start(): void {
		console.log("🕐 Starting Scheduled Call Scheduler...");

		// Start the scheduler interval
		this.schedulerInterval = setInterval(() => {
			this.processDueScheduledCalls();
		}, this.CHECK_INTERVAL);

		// Start the reconcile interval
		this.reconcileInterval = setInterval(() => {
			this.reconcileStaleCalls();
		}, this.RECONCILE_INTERVAL);

		// Process any overdue calls immediately on startup
		setTimeout(() => {
			this.processDueScheduledCalls();
		}, 5000); // Wait 5 seconds after startup

		// Reconcile stale calls after 10 seconds
		setTimeout(() => {
			this.reconcileStaleCalls();
		}, 10000); // Wait 10 seconds after startup
	}

	/**
	 * Stop the scheduled call scheduler
	 */
	stop(): void {
		if (this.schedulerInterval) {
			clearInterval(this.schedulerInterval);
			this.schedulerInterval = null;
			console.log("🛑 Scheduled Call Scheduler stopped");
		}
		if (this.reconcileInterval) {
			clearInterval(this.reconcileInterval);
			this.reconcileInterval = null;
			console.log("🛑 Stale Call Reconcile Scheduler stopped");
		}
	}

	/**
	 * Process all due scheduled calls
	 */
	private async processDueScheduledCalls(): Promise<void> {
		try {
			const dueCalls = await this.findDueScheduledCalls();

			if (dueCalls.length > 0) {
				console.log(`⏰ Processing ${dueCalls.length} due scheduled calls...`);

				for (const lead of dueCalls) {
					await this.executeScheduledCall(lead);
				}
			}
		} catch (error: any) {
			console.error("❌ Error processing due scheduled calls:", error);
		}
	}

	/**
	 * Reconcile stale initiated calls using the new polling system
	 */
	private async reconcileStaleCalls(): Promise<void> {
		try {
			console.log("🔍 Checking for stale initiated calls...");

			const result = await callStatusPoller.reconcileStaleCalls();

			if (result.finalized > 0) {
				console.log(`✅ Reconciled ${result.finalized} stale calls`);
			} else {
				console.log("✅ No stale calls found to reconcile");
			}

			if (result.errors.length > 0) {
				console.error("❌ Errors during reconciliation:", result.errors);
			}
		} catch (error: any) {
			console.error("❌ Error reconciling stale calls:", error);
		}
	}

	/**
	 * Find all scheduled calls that are due for execution
	 */
	private async findDueScheduledCalls(): Promise<any[]> {
		try {
			const now = new Date();

			return await this.prisma.lead.findMany({
				where: {
					scheduledCallAt: {
						lte: now, // Due time is now or in the past
					},
					scheduledCallStatus: {
						in: [ScheduledCallStatus.PENDING, ScheduledCallStatus.ORPHANED],
					},
					status: LeadStatus.SCHEDULED,
					blacklisted: false,
				},
				include: {
					campaign: true,
					callHistory: true,
				},
			});
		} catch (error: any) {
			console.error("Error finding due scheduled calls:", error);
			return [];
		}
	}

	/**
	 * Execute a scheduled call for a specific lead
	 */
	private async executeScheduledCall(lead: any): Promise<void> {
		try {
			console.log(
				`📞 Executing scheduled call for ${lead.name} (${lead.phone1})`
			);

			// Determine call title based on campaign status
			let callTitle = this.DEFAULT_CALL_TITLE;
			if (lead.campaign) {
				callTitle = `Scheduled Call - ${lead.campaign.name}`;
			} else if (lead.scheduledCallStatus === ScheduledCallStatus.ORPHANED) {
				callTitle = "Scheduled Call - Orphaned";
			}

			// Trigger the call
			const result = await this.callService.triggerCall(
				lead.id,
				callTitle,
				true // isScheduled = true
			);

			// Clear the scheduled call since it has been executed
			await this.leadRepository.clearScheduledCall(lead.id);

			console.log(`✅ Scheduled call executed successfully for ${lead.name}`);
			console.log(`   Call ID: ${result.callId}`);
			console.log(`   Vapi Call ID: ${result.vapiCallId}`);
		} catch (error: any) {
			console.error(
				`❌ Failed to execute scheduled call for ${lead.name}:`,
				error
			);

			// Handle failed scheduled call execution
			await this.handleFailedScheduledCall(lead, error);
		}
	}

	/**
	 * Handle failed scheduled call execution
	 */
	private async handleFailedScheduledCall(
		lead: any,
		error: any
	): Promise<void> {
		try {
			// Update scheduled call status to FAILED
			await this.prisma.lead.update({
				where: { id: lead.id },
				data: {
					scheduledCallStatus: ScheduledCallStatus.FAILED,
					scheduledCallNote: `Scheduled call failed: ${error.message}`,
				},
			});

			// Log the failure
			console.log(`📝 Marked scheduled call as failed for ${lead.name}`);

			// Optionally, you could implement retry logic here
			// For now, we just mark it as failed and let the user handle it manually
		} catch (updateError: any) {
			console.error(
				`❌ Failed to update scheduled call status for ${lead.name}:`,
				updateError
			);
		}
	}

	/**
	 * Get scheduler status and statistics
	 */
	async getSchedulerStats(): Promise<{
		isRunning: boolean;
		nextCheckTime: Date;
		dueCallsCount: number;
		orphanedCallsCount: number;
	}> {
		const now = new Date();
		const nextCheck = new Date(now.getTime() + this.CHECK_INTERVAL);

		const dueCallsCount = await this.prisma.lead.count({
			where: {
				scheduledCallAt: { lte: now },
				scheduledCallStatus: {
					in: [ScheduledCallStatus.PENDING, ScheduledCallStatus.ORPHANED],
				},
				status: LeadStatus.SCHEDULED,
				blacklisted: false,
			},
		});

		const orphanedCallsCount = await this.prisma.lead.count({
			where: {
				scheduledCallStatus: ScheduledCallStatus.ORPHANED,
				scheduledCallAt: { not: null },
			},
		});

		return {
			isRunning: this.schedulerInterval !== null,
			nextCheckTime: nextCheck,
			dueCallsCount,
			orphanedCallsCount,
		};
	}

	/**
	 * Manually trigger processing of due scheduled calls
	 */
	async triggerDueCalls(): Promise<{
		processedCount: number;
		errors: string[];
	}> {
		const errors: string[] = [];
		let processedCount = 0;

		try {
			const dueCalls = await this.findDueScheduledCalls();

			for (const lead of dueCalls) {
				try {
					await this.executeScheduledCall(lead);
					processedCount++;
				} catch (error: any) {
					errors.push(`Failed to process ${lead.name}: ${error.message}`);
				}
			}
		} catch (error: any) {
			errors.push(`Scheduler error: ${error.message}`);
		}

		return { processedCount, errors };
	}

	/**
	 * Manually trigger reconciliation of stale calls
	 */
	async triggerReconcileStaleCalls(): Promise<{
		scanned: number;
		finalized: number;
		errors: string[];
	}> {
		try {
			return await callStatusPoller.reconcileStaleCalls();
		} catch (error: any) {
			console.error("❌ Error triggering stale call reconciliation:", error);
			return {
				scanned: 0,
				finalized: 0,
				errors: [`Scheduler error: ${error.message}`],
			};
		}
	}
}
