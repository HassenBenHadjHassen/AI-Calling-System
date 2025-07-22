import {
  startCampaignDB,
  stopCampaignDB,
  getCampaigns,
  getCampaignById,
} from "../repositories/campaignRepository";
import { getLeadsByCampaign } from "../repositories/leadRepository";
import { triggerCallService } from "./callService";
import { LeadStatus, CampaignStatus } from "../generated/prisma";

export const startCampaignService = async (campaignId: string) => {
  return startCampaignDB(campaignId);
};

export const stopCampaignService = async (campaignId: string) => {
  return stopCampaignDB(campaignId);
};

export const listCampaignsService = async () => {
  return getCampaigns();
};

// New batch calling functionality
export const startBatchCallingService = async (campaignId: string, options?: {
  maxConcurrentCalls?: number;
  delayBetweenCalls?: number;
  filterByStatus?: LeadStatus[];
}) => {
  try {
    console.log(`Starting batch calling for campaign ${campaignId}`);
    
    // Get campaign details
    const campaign = await getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (campaign.status !== CampaignStatus.RUNNING) {
      throw new Error(`Campaign ${campaignId} is not running`);
    }

    // Get leads for this campaign
    const filterStatuses = options?.filterByStatus || [LeadStatus.NEW];
    const leads = await getLeadsByCampaign(campaignId, filterStatuses);
    
    if (leads.length === 0) {
      console.log(`No eligible leads found for campaign ${campaignId}`);
      return { message: 'No eligible leads found', totalLeads: 0, callsInitiated: 0 };
    }

    console.log(`Found ${leads.length} eligible leads for calling`);

    // Configuration
    const maxConcurrent = options?.maxConcurrentCalls || 3;
    const delayMs = options?.delayBetweenCalls || 2000; // 2 seconds between calls
    
    let callsInitiated = 0;
    let callsInProgress = 0;
    const results = [];

    // Process leads in batches
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      
      // Wait if we've reached max concurrent calls
      while (callsInProgress >= maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        // In a real implementation, you'd track completed calls
        callsInProgress = Math.max(0, callsInProgress - 1);
      }

      try {
        // Trigger call for this lead
        const callResult = await triggerCallService({
          leadId: lead.id,
          campaignId: campaignId,
          phoneNumber: lead.phone,
          name: lead.name || undefined,
        });

        results.push({
          leadId: lead.id,
          phoneNumber: lead.phone,
          status: 'initiated',
          callId: callResult.callHistoryId
        });

        callsInitiated++;
        callsInProgress++;
        
        console.log(`Call initiated for lead ${lead.id} (${lead.phone})`);
        
        // Add delay between calls
        if (i < leads.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        console.error(`Failed to initiate call for lead ${lead.id}:`, error);
        results.push({
          leadId: lead.id,
          phoneNumber: lead.phone,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`Batch calling completed: ${callsInitiated} calls initiated out of ${leads.length} leads`);
    
    return {
      message: 'Batch calling initiated',
      totalLeads: leads.length,
      callsInitiated,
      results
    };
  } catch (error) {
    console.error('Error in batch calling service:', error);
    throw error;
  }
};

export const getCampaignStatsService = async (campaignId: string) => {
  try {
    const campaign = await getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    // Get all leads for this campaign
    const allLeads = await getLeadsByCampaign(campaignId);
    
    // Calculate statistics
    const stats = {
      totalLeads: allLeads.length,
      newLeads: allLeads.filter((l: any) => l.status === LeadStatus.NEW).length,
      called: allLeads.filter((l: any) => l.status === LeadStatus.CALLED).length,
      interested: allLeads.filter((l: any) => l.status === LeadStatus.INTERESTED).length,
      transferred: allLeads.filter((l: any) => l.status === LeadStatus.TRANSFERRED).length,
      failed: allLeads.filter((l: any) => l.status === LeadStatus.FAILED).length,
    };

    return {
      campaign,
      stats
    };
  } catch (error) {
    console.error('Error getting campaign stats:', error);
    throw error;
  }
};
