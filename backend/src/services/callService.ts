import { CallRepository } from "../repositories/callRepository";
import { LeadRepository } from "../repositories/leadRepository";
import { CampaignRepository } from "../repositories/campaignRepository";
import { vapiService } from "./vapiService";
import { CallStatus, LeadStatus, ScheduledCallStatus } from "@prisma/client";

export class CallService {
  private callRepository: CallRepository;
  private leadRepository: LeadRepository;
  private campaignRepository: CampaignRepository;

  constructor() {
    this.callRepository = new CallRepository();
    this.leadRepository = new LeadRepository();
    this.campaignRepository = new CampaignRepository();
  }

  async triggerCall(leadId: string, title: string): Promise<any> {
    const lead = await this.leadRepository.findById(leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }

    if (lead.blacklisted) {
      throw new Error("Cannot call blacklisted lead");
    }

    // Create call record
    const callRecord = await this.callRepository.create({
      leadId: lead.id,
      campaignId: lead.campaignId || undefined,
      callStatus: CallStatus.INITIATED,
    });

    try {
      // Trigger call via Vapi.ai
      const vapiResponse = await vapiService.createCall({
        phoneNumber: lead.phone1,
        name: lead.name,
        title: title, // Default title, could be made configurable
      });

      // Update call record with Vapi call ID
      await this.callRepository.updateStatus(
        callRecord.id,
        CallStatus.INITIATED
      );

      return {
        callRecord,
        vapiCallId: (vapiResponse as any).id,
      };
    } catch (error) {
      // Update call record as failed
      await this.callRepository.updateStatus(callRecord.id, CallStatus.FAILED);
      throw error;
    }
  }

  async handleWebhook(webhookData: any): Promise<void> {
    const { callId, status, duration, transferred, transferTo } = webhookData;

    // Find call record by Vapi call ID
    const callRecord = await this.callRepository.findByVapiCallId(callId);
    if (!callRecord) {
      console.error("Call record not found for webhook:", callId);
      return;
    }

    // Update call status based on webhook
    if (status === "completed") {
      await this.callRepository.updateStatus(
        callRecord.id,
        CallStatus.COMPLETED
      );
      if (duration) {
        await this.callRepository.updateDuration(callRecord.id, duration);
      }
    } else if (status === "failed") {
      await this.callRepository.updateStatus(callRecord.id, CallStatus.FAILED);
    }

    // Handle transfer
    if (transferred && transferTo) {
      await this.callRepository.updateTransfer(callRecord.id, true, transferTo);
    }

    // Update lead status based on call outcome
    const lead = await this.leadRepository.findById(callRecord.leadId);
    if (lead) {
      if (status === "completed") {
        await this.leadRepository.updateStatus(lead.id, LeadStatus.CALLED);
      } else if (status === "failed") {
        await this.leadRepository.updateStatus(lead.id, LeadStatus.FAILED);
      }
    }
  }

  async triggerScheduledCalls(title: string): Promise<any[]> {
    const dueScheduledCalls = await this.leadRepository.findDueScheduledCalls();
    const triggeredCalls = [];

    for (const lead of dueScheduledCalls) {
      try {
        const result = await this.triggerCall(lead.id, title);
        triggeredCalls.push(result);

        // Update scheduled call status
        await this.leadRepository.updateScheduledCall(
          lead.id,
          lead.scheduledCallAt!,
          lead.scheduledCallNote || undefined
        );
      } catch (error) {
        console.error(
          `Failed to trigger scheduled call for lead ${lead.id}:`,
          error
        );
      }
    }

    return triggeredCalls;
  }

  async triggerCampaignCalls(
    campaignId: string,
    title: string
  ): Promise<any[]> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (campaign.status !== "ACTIVE") {
      throw new Error("Campaign is not active");
    }

    const triggeredCalls = [];
    const maxSimultaneousCalls = 5;

    // Ensure campaign has leads property
    const campaignWithLeads = campaign as any;
    const leads = campaignWithLeads.leads || [];

    for (const lead of leads.slice(0, maxSimultaneousCalls)) {
      if (lead.status === LeadStatus.NEW && !lead.blacklisted) {
        try {
          const result = await this.triggerCall(lead.id, title);
          triggeredCalls.push(result);
        } catch (error) {
          console.error(`Failed to trigger call for lead ${lead.id}:`, error);
        }
      }
    }

    return triggeredCalls;
  }

  async getCallStats(): Promise<any> {
    return this.callRepository.getCallStats();
  }

  async getCallsByLead(leadId: string): Promise<any[]> {
    return this.callRepository.findByLeadId(leadId);
  }

  async getCallsByCampaign(campaignId: string): Promise<any[]> {
    return this.callRepository.findByCampaignId(campaignId);
  }

  async getTransferredCalls(): Promise<any[]> {
    return this.callRepository.findTransferredCalls();
  }

  async getCompletedCalls(): Promise<any[]> {
    return this.callRepository.findCompletedCalls();
  }

  async getFailedCalls(): Promise<any[]> {
    return this.callRepository.findFailedCalls();
  }

  async updateCallNotes(callId: string, notes: string): Promise<any> {
    return this.callRepository.updateNotes(callId, notes);
  }

  async getCallById(callId: string): Promise<any> {
    return this.callRepository.findById(callId);
  }

  async getCallByVapiId(vapiCallId: string): Promise<any> {
    return this.callRepository.findByVapiCallId(vapiCallId);
  }
}
