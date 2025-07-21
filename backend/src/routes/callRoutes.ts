import { Router } from "express";
import { triggerCall, callWebhook } from "../controllers/callController";

const router = Router();

router.post("/trigger", triggerCall);
router.post("/webhook", callWebhook);

export default router;
