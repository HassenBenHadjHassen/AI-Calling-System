import { Router } from "express";
import { SchedulerController } from "../controllers/schedulerController";
import getScheduler from "../services/schedulerInstance";

const router = Router();
const schedulerController = new SchedulerController(getScheduler());

// Get scheduler status
router.get(
	"/status",
	// authenticateToken, // Commented out for testing
	schedulerController.getSchedulerStatus.bind(schedulerController)
);

// Manually trigger due calls
router.post(
	"/trigger",
	// authenticateToken, // Commented out for testing
	schedulerController.triggerDueCalls.bind(schedulerController)
);

// Start scheduler
router.post(
	"/start",
	// authenticateToken, // Commented out for testing
	schedulerController.startScheduler.bind(schedulerController)
);

// Stop scheduler
router.post(
	"/stop",
	// authenticateToken, // Commented out for testing
	schedulerController.stopScheduler.bind(schedulerController)
);

// Manually trigger stale call reconciliation
router.post(
	"/reconcile-stale",
	// authenticateToken, // Commented out for testing
	schedulerController.triggerReconcileStaleCalls.bind(schedulerController)
);

export default router;
