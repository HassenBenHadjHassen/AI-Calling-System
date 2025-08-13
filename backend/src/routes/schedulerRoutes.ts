import { Router } from "express";
import { SchedulerController } from "../controllers/schedulerController";
import getScheduler from "../services/schedulerInstance";
import { authenticateToken } from "../middleware/auth";

const router = Router();
const schedulerController = new SchedulerController(getScheduler());

// Get scheduler status
router.get(
	"/status",
	authenticateToken,
	schedulerController.getSchedulerStatus.bind(schedulerController)
);

// Manually trigger due calls
router.post(
	"/trigger",
	authenticateToken,
	schedulerController.triggerDueCalls.bind(schedulerController)
);

// Start scheduler
router.post(
	"/start",
	authenticateToken,
	schedulerController.startScheduler.bind(schedulerController)
);

// Stop scheduler
router.post(
	"/stop",
	authenticateToken,
	schedulerController.stopScheduler.bind(schedulerController)
);

// Manually trigger stale call reconciliation
router.post(
	"/reconcile-stale",
	authenticateToken,
	schedulerController.triggerReconcileStaleCalls.bind(schedulerController)
);

export default router;
