import { CampaignRepository } from "../repositories/campaignRepository";
import { LeadRepository } from "../repositories/leadRepository";
import { CampaignStatus, LeadStatus, Campaign, Lead } from "@prisma/client";

// Define a type for Campaign with leads included
type CampaignWithLeads = Campaign & {
  leads: Lead[];
};

export class CampaignService {
  private campaignRepository: CampaignRepository;
  private leadRepository: LeadRepository;

  constructor() {
    this.campaignRepository = new CampaignRepository();
    this.leadRepository = new LeadRepository();
  }

  async startCampaign(campaignId: string): Promise<any> {
    const campaign = (await this.campaignRepository.findById(
      campaignId
    )) as CampaignWithLeads | null;
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (campaign.status === CampaignStatus.ACTIVE) {
      throw new Error("Campaign is already active");
    }

    if (campaign.leads.length === 0) {
      throw new Error("Cannot start campaign with no leads");
    }

    // Start the campaign (this will automatically stop any other active campaign)
    return this.campaignRepository.start(campaignId);
  }

  async stopCampaign(campaignId: string): Promise<any> {
    const campaign = (await this.campaignRepository.findById(
      campaignId
    )) as CampaignWithLeads | null;
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (campaign.status !== CampaignStatus.ACTIVE) {
      throw new Error("Campaign is not active");
    }

    return this.campaignRepository.stop(campaignId);
  }

  async completeCampaign(campaignId: string): Promise<any> {
    const campaign = (await this.campaignRepository.findById(
      campaignId
    )) as CampaignWithLeads | null;
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    return this.campaignRepository.complete(campaignId);
  }

  async getActiveCampaign(): Promise<any> {
    return this.campaignRepository.findActive();
  }

  async getNextAvailableCampaign(): Promise<any> {
    return this.campaignRepository.findNextAvailable();
  }

  async getAllCampaigns(): Promise<any[]> {
    return this.campaignRepository.findAll();
  }

  async getCampaignById(campaignId: string): Promise<any> {
    return this.campaignRepository.findById(campaignId);
  }

  async getCampaignsByStatus(status: CampaignStatus): Promise<any[]> {
    return this.campaignRepository.findByStatus(status);
  }

  async createCampaign(name: string): Promise<any> {
    return this.campaignRepository.create({ name });
  }

  async deleteCampaign(campaignId: string): Promise<void> {
    const campaign = (await this.campaignRepository.findById(
      campaignId
    )) as CampaignWithLeads | null;
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (campaign.status === CampaignStatus.ACTIVE) {
      throw new Error("Cannot delete active campaign");
    }

    return this.campaignRepository.delete(campaignId);
  }

  async addLeadsToCampaign(
    campaignId: string,
    leadIds: string[]
  ): Promise<any> {
    const campaign = (await this.campaignRepository.findById(
      campaignId
    )) as CampaignWithLeads | null;
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (campaign.status === CampaignStatus.COMPLETED) {
      throw new Error("Cannot add leads to completed campaign");
    }

    // Check if adding these leads would exceed the 5-lead limit
    const currentLeadCount = campaign.leads.length;
    if (currentLeadCount + leadIds.length > 5) {
      throw new Error(
        `Campaign can only have 5 leads. Current: ${currentLeadCount}, Adding: ${leadIds.length}`
      );
    }

    return this.campaignRepository.addLeads(campaignId, leadIds);
  }

  async removeLeadFromCampaign(
    campaignId: string,
    leadId: string
  ): Promise<any> {
    const campaign = (await this.campaignRepository.findById(
      campaignId
    )) as CampaignWithLeads | null;
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const lead = campaign.leads.find((l: Lead) => l.id === leadId);
    if (!lead) {
      throw new Error("Lead not found in campaign");
    }

    return this.campaignRepository.removeLead(campaignId, leadId);
  }

  async getCampaignStats(): Promise<{
    total: number;
    active: number;
    stopped: number;
    completed: number;
  }> {
    const campaigns = await this.campaignRepository.findAll();

    return {
      total: campaigns.length,
      active: campaigns.filter((c) => c.status === CampaignStatus.ACTIVE)
        .length,
      stopped: campaigns.filter((c) => c.status === CampaignStatus.STOPPED)
        .length,
      completed: campaigns.filter((c) => c.status === CampaignStatus.COMPLETED)
        .length,
    };
  }

  async getNextCampaignToProcess(): Promise<any> {
    // First, check for campaigns with leads that are ready to be processed
    const campaigns = (await this.campaignRepository.findByStatus(
      CampaignStatus.ACTIVE
    )) as CampaignWithLeads[];

    for (const campaign of campaigns) {
      if (campaign.leads.length > 0) {
        return campaign;
      }
    }

    return null;
  }
}
