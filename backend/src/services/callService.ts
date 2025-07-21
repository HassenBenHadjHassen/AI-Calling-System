import { logCall, updateCallStatus } from "../repositories/callRepository";
import { CallStatus } from "../generated/prisma";
import twilio from "twilio";
import axios from "axios";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export const triggerCallService = async (callData: any) => {
  try {
    // 1. Place a call with Twilio (from a +33 number)
    const twilioCall = await twilioClient.calls.create({
      url: process.env.TWILIO_TWIML_URL!, // Your webhook or TwiML instructions
      to: callData.phone,
      from: process.env.TWILIO_FROM_NUMBER!, // Must be a +33 number
    });

    // 2. Start the AI agent with Vapi.ai (replace with your actual API endpoint and payload)
    const vapiResponse = await axios.post(
      "https://api.vapi.ai/v1/calls",
      {
        phone: callData.phone,
        script: callData.script || process.env.VAPI_DEFAULT_SCRIPT,
        twilioCallSid: twilioCall.sid,
        // ...other Vapi.ai params as needed
      },
      {
        headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` },
      }
    );

    // 3. Log the call as INITIATED
    return logCall({
      ...callData,
      status: CallStatus.INITIATED,
      startedAt: new Date(),
      twilioCallSid: twilioCall.sid,
      vapiCallId: vapiResponse.data.id,
    });
  } catch (error) {
    // Optionally log the failed attempt
    await logCall({
      ...callData,
      status: CallStatus.FAILED,
      startedAt: new Date(),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const callWebhookService = async (
  callId: string,
  status: CallStatus
) => {
  return updateCallStatus(callId, status);
};
