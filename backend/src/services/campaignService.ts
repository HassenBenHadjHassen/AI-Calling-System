import {
  startCampaignDB,
  stopCampaignDB,
  getCampaigns,
} from "../repositories/campaignRepository";

export const startCampaignService = async (campaignId: string) => {
  return startCampaignDB(campaignId);
};

export const stopCampaignService = async (campaignId: string) => {
  return stopCampaignDB(campaignId);
};

export const listCampaignsService = async () => {
  return getCampaigns();
};
