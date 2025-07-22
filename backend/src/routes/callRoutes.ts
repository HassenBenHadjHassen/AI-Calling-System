import { Router } from "express";
import { 
  triggerCall, 
  callWebhook, 
  twimlHandler, 
  twimlStatusCallback,
  vapiWebhook,
  getHumanAgentStats,
  manualTransfer
} from "../controllers/callController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Call management
router.post("/trigger", authenticateToken, triggerCall);
router.post("/webhook", callWebhook); // Vapi.ai webhook (no auth needed)
router.post("/vapi-webhook", vapiWebhook); // Enhanced Vapi.ai webhook

// Twilio TwiML endpoints
router.post("/twiml", twimlHandler);
router.get("/twiml", twimlHandler); // Support both GET and POST
router.post("/twiml/status", twimlStatusCallback); // Status callback for conference events

// Human agent management
router.get("/agents/stats", authenticateToken, getHumanAgentStats);
router.post("/transfer", authenticateToken, manualTransfer);

export default router;
