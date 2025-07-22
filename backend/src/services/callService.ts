import {
  createCallHistory,
  updateCallHistory,
} from "../repositories/callRepository";
import { updateLeadStatusService } from "./leadService";
import { vapiService } from "./vapiService";
import { CallStatus, LeadStatus } from "../generated/prisma";

interface TriggerCallData {
  leadId: string;
  campaignId?: string;
  phoneNumber: string;
  name?: string;
}

export const triggerCallService = async (callData: TriggerCallData) => {
  try {
    console.log("Triggering call with Vapi.ai:", callData);
    
    // Create call with Vapi.ai
    const vapiCall = await vapiService.createCall({
      phoneNumber: callData.phoneNumber,
      name: callData.name,
    });

    // Create call history record
    const callHistory = await createCallHistory({
      leadId: callData.leadId,
      campaignId: callData.campaignId,
      status: CallStatus.INITIATED,
      startedAt: new Date(),
      vapiCallId: vapiCall.id,
    });

    // Update lead status to CALLED
    await updateLeadStatusService(callData.leadId, LeadStatus.CALLED);

    return {
      callHistoryId: callHistory.id,
      vapiCallId: vapiCall.id,
      status: 'initiated',
      message: 'Call successfully triggered'
    };
  } catch (error) {
    console.error('Error triggering call:', error);
    throw new Error('Failed to trigger call: ' + error);
  }
};

export const callWebhookService = async (
  callId: string,
  status: CallStatus,
  metadata?: {
    conferenceSid?: string;
    event?: string;
    timestamp?: string;
    duration?: string;
    twilioCallStatus?: string;
  }
) => {
  try {
    console.log(`Processing webhook for call ${callId} with status ${status}`);
    
    // Prepare update data
    const updateData: any = {
      status,
      endedAt: status === CallStatus.COMPLETED ? new Date() : undefined,
    };

    // Add TwiML metadata if provided
    if (metadata) {
      updateData.metadata = {
        ...updateData.metadata,
        conferenceSid: metadata.conferenceSid,
        event: metadata.event,
        timestamp: metadata.timestamp,
        twilioCallStatus: metadata.twilioCallStatus,
      };

      // Parse duration if provided
      if (metadata.duration && status === CallStatus.COMPLETED) {
        updateData.duration = parseInt(metadata.duration, 10);
      }
    }

    // Note: Transfer detection will be handled by Vapi.ai webhooks separately
    // TwiML callbacks only provide basic call status information

    // Update call history in database
    const updatedCall = await updateCallHistory(callId, updateData);

    console.log(`Call ${callId} status updated to ${status}`, metadata ? `with metadata: ${JSON.stringify(metadata)}` : '');

    // Update lead status based on call outcome
    if (updatedCall) {
      let leadStatus: LeadStatus;
      
      switch (status) {
        case CallStatus.TRANSFERRED:
          leadStatus = LeadStatus.TRANSFERRED;
          break;
        case CallStatus.COMPLETED:
          // Check if there were interest indicators
          leadStatus = updateData.transferredToHuman ? LeadStatus.INTERESTED : LeadStatus.CALLED;
          break;
        case CallStatus.FAILED:
          leadStatus = LeadStatus.FAILED;
          break;
        default:
          leadStatus = LeadStatus.CALLED;
      }
      
      await updateLeadStatusService(updatedCall.leadId, leadStatus);
    }

    return {
      message: 'Webhook processed successfully',
      callId,
      status,
      transferredToHuman: updateData.transferredToHuman || false
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    throw new Error('Failed to process webhook');
  }
};
