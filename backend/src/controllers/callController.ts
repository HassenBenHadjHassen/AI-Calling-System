import { Request, Response } from "express";
import {
  triggerCallService,
  callWebhookService,
} from "../services/callService";
import { CallStatus } from "../generated/prisma";
import { env } from "../config/env";
import { processTransferRequest, generateTransferInstructions } from "../services/transferService";
import { transferToHuman, getAgentStats } from "../services/humanAgentService";

export const triggerCall = async (req: Request, res: Response) => {
  try {
    const callData = req.body;
    const result = await triggerCallService(callData);
    res.json({ message: "Call triggered", result });
  } catch (err) {
    res.status(500).json({ error: "Failed to trigger call: " + err });
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

export const twimlHandler = async (req: Request, res: Response) => {
  try {
    console.log('TwiML webhook called:', {
      method: req.method,
      body: req.body,
      query: req.query
    });

    // Extract call information from Twilio
    const {
      CallSid,
      From,
      To,
      CallStatus: twilioCallStatus,
      Direction
    } = req.body;

    // Generate TwiML response for French AI calling
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="fr-FR">
    Bonjour, veuillez patienter pendant que nous vous connectons à notre assistant.
  </Say>
  <Pause length="2"/>
  <Say voice="alice" language="fr-FR">
    Connexion en cours...
  </Say>
  <!-- Vapi.ai will take over the call from here -->
  <Dial>
    <Conference statusCallback="${env.TWILIO_TWIML_URL}/status" statusCallbackEvent="start end join leave">
      ai-calling-${CallSid}
    </Conference>
  </Dial>
</Response>`;

    // Set proper content type for TwiML
    res.set('Content-Type', 'text/xml');
    res.status(200).send(twiml);

    // Log the call for tracking (optional)
    console.log(`TwiML generated for call ${CallSid} from ${From} to ${To}`);
  } catch (err) {
    console.error('Error generating TwiML:', err);
    
    // Fallback TwiML in case of error
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="fr-FR">
    Désolé, nous rencontrons un problème technique. Veuillez rappeler plus tard.
  </Say>
  <Hangup/>
</Response>`;
    
    res.set('Content-Type', 'text/xml');
    res.status(200).send(fallbackTwiml);
  }
};

export const twimlStatusCallback = async (req: Request, res: Response) => {
  try {
    console.log('TwiML status callback received:', {
      method: req.method,
      body: req.body
    });

    // Extract status information from Twilio
    const {
      CallSid,
      ConferenceSid,
      StatusCallbackEvent,
      Timestamp,
      From,
      To,
      CallStatus: twilioCallStatus,
      CallDuration
    } = req.body;

    // Map Twilio events to our call status
    let callStatus: CallStatus;
    switch (StatusCallbackEvent) {
      case 'conference-start':
      case 'participant-join':
        callStatus = CallStatus.INITIATED;
        break;
      case 'conference-end':
      case 'participant-leave':
        callStatus = CallStatus.COMPLETED;
        break;
      default:
        callStatus = CallStatus.INITIATED;
    }

    // Update call history if we have the call information
    if (CallSid) {
      try {
        await callWebhookService(CallSid, callStatus, {
          conferenceSid: ConferenceSid,
          event: StatusCallbackEvent,
          timestamp: Timestamp,
          duration: CallDuration,
          twilioCallStatus
        });
      } catch (error) {
        console.error('Error updating call status from TwiML callback:', error);
      }
    }

    // Respond with 200 OK to acknowledge receipt
    res.status(200).send('OK');

    console.log(`TwiML status processed: ${StatusCallbackEvent} for call ${CallSid}`);
  } catch (err) {
    console.error('Error processing TwiML status callback:', err);
    res.status(500).send('Error processing callback');
  }
};

// Enhanced webhook for Vapi.ai with transfer logic
export const vapiWebhook = async (req: Request, res: Response) => {
  try {
    console.log('Vapi.ai webhook received:', {
      method: req.method,
      body: req.body
    });

    const {
      type,
      call,
      transcript,
      functionCalls,
      message
    } = req.body;

    const callId = call?.id;
    if (!callId) {
      return res.status(400).json({ error: 'Call ID is required' });
    }

    // Handle different webhook types
    switch (type) {
      case 'function-call':
        // Handle transfer requests
        if (functionCalls?.some((fc: any) => fc.name === 'transfer_to_human')) {
          const transferResult = await processTransferRequest(
            callId,
            transcript || '',
            { functionCalls, call }
          );

          if (transferResult.transferApproved) {
            // Initiate human transfer
            const humanTransferResult = await transferToHuman(
              callId,
              call?.conferenceSid
            );

            res.json({
              success: true,
              action: 'TRANSFER_TO_HUMAN',
              transferResult: humanTransferResult,
              message: humanTransferResult.success 
                ? 'Transfert vers un conseiller en cours...'
                : 'Transfert impossible pour le moment. Continuons notre conversation.'
            });
          } else {
            // Continue AI conversation
            const instructions = generateTransferInstructions(transferResult.analysis);
            res.json({
              success: true,
              action: 'CONTINUE_AI',
              message: instructions
            });
          }
        } else {
          res.json({ success: true, message: 'Function call processed' });
        }
        break;

      case 'transcript':
        // Analyze transcript for potential transfer triggers
        if (transcript) {
          const transferResult = await processTransferRequest(callId, transcript);
          
          // Store analysis but don't auto-transfer (wait for explicit request)
          console.log(`Transcript analysis for call ${callId}:`, transferResult.analysis);
        }
        res.json({ success: true, message: 'Transcript processed' });
        break;

      case 'status-update':
        // Update call status
        const status = call?.status;
        if (status) {
          let callStatus: CallStatus;
          switch (status) {
            case 'ringing':
            case 'in-progress':
              callStatus = CallStatus.INITIATED;
              break;
            case 'completed':
              callStatus = CallStatus.COMPLETED;
              break;
            case 'failed':
            case 'busy':
            case 'no-answer':
              callStatus = CallStatus.FAILED;
              break;
            default:
              callStatus = CallStatus.INITIATED;
          }

          await callWebhookService(callId, callStatus, {
            event: `vapi-${status}`,
            duration: call?.duration?.toString(),
            twilioCallStatus: call?.endReason
          });
        }
        res.json({ success: true, message: 'Status updated' });
        break;

      default:
        console.log(`Unhandled webhook type: ${type}`);
        res.json({ success: true, message: 'Webhook received' });
    }
  } catch (err) {
    console.error('Error processing Vapi.ai webhook:', err);
    res.status(500).json({ 
      error: 'Failed to process webhook',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
};

// Get human agent statistics
export const getHumanAgentStats = async (req: Request, res: Response) => {
  try {
    const stats = getAgentStats();
    res.json({
      success: true,
      ...stats
    });
  } catch (err) {
    console.error('Error getting agent stats:', err);
    res.status(500).json({ 
      error: 'Failed to get agent statistics',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
};

// Manual transfer endpoint
export const manualTransfer = async (req: Request, res: Response) => {
  try {
    const { callId, conferenceSid, specialty } = req.body;
    
    if (!callId) {
      return res.status(400).json({ error: 'Call ID is required' });
    }

    const transferResult = await transferToHuman(callId, conferenceSid, specialty);
    
    res.json({
      ...transferResult
    });
  } catch (err) {
    console.error('Error in manual transfer:', err);
    res.status(500).json({ 
      error: 'Failed to transfer call',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
};
