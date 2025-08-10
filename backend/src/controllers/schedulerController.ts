import { Request, Response } from "express";
import { ScheduledCallScheduler } from "../services/scheduledCallScheduler";
import { ResponseUtils } from "../utils/responseUtils";

export class SchedulerController {
	private scheduler: ScheduledCallScheduler;

	constructor(scheduler: ScheduledCallScheduler) {
		this.scheduler = scheduler;
	}

	async getSchedulerStatus(req: Request, res: Response): Promise<void> {
		try {
			const stats = await this.scheduler.getSchedulerStats();
			ResponseUtils.success(res, stats);
		} catch (error: any) {
			console.error("Error getting scheduler status:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to get scheduler status",
				500
			);
		}
	}

	async triggerDueCalls(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.scheduler.triggerDueCalls();
			ResponseUtils.success(res, result);
		} catch (error: any) {
			console.error("Error triggering due calls:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to trigger due calls",
				500
			);
		}
	}

	async startScheduler(req: Request, res: Response): Promise<void> {
		try {
			this.scheduler.start();
			ResponseUtils.success(res, { message: "Scheduler started successfully" });
		} catch (error: any) {
			console.error("Error starting scheduler:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to start scheduler",
				500
			);
		}
	}

	async stopScheduler(req: Request, res: Response): Promise<void> {
		try {
			this.scheduler.stop();
			ResponseUtils.success(res, { message: "Scheduler stopped successfully" });
		} catch (error: any) {
			console.error("Error stopping scheduler:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to stop scheduler",
				500
			);
		}
	}

	async triggerReconcileStaleCalls(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.scheduler.triggerReconcileStaleCalls();
			ResponseUtils.success(res, result, "Stale calls reconciled successfully");
		} catch (error: any) {
			console.error("Error reconciling stale calls:", error);
			ResponseUtils.error(
				res,
				error.message || "Failed to reconcile stale calls",
				500
			);
		}
	}
}
