import { PrismaClient, CampaignStatus } from "../generated/prisma";

const prisma = new PrismaClient();

export const startCampaignDB = async (campaignId: string) => {
  return prisma.campaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.RUNNING },
  });
};

export const stopCampaignDB = async (campaignId: string) => {
  return prisma.campaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.STOPPED },
  });
};

export const getCampaigns = async () => {
  return prisma.campaign.findMany();
};

export const getCampaignById = async (campaignId: string) => {
  return prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      leads: true,
    },
  });
};
