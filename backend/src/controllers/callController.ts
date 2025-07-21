import { Request, Response } from "express";
import {
  triggerCallService,
  callWebhookService,
} from "../services/callService";
import { CallStatus } from "../generated/prisma";

export const triggerCall = async (req: Request, res: Response) => {
  try {
    const callData = req.body;
    const result = await triggerCallService(callData);
    res.json({ message: "Call triggered", result });
  } catch (err) {
    res.status(500).json({ error: "Failed to trigger call" });
  }
};

export const callWebhook = async (req: Request, res: Response) => {
  try {
    const { callId, status } = req.body;
    if (!Object.values(CallStatus).includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const result = await callWebhookService(callId, status);
    res.json({ message: "Webhook received", result });
  } catch (err) {
    res.status(500).json({ error: "Failed to process webhook" });
  }
};
