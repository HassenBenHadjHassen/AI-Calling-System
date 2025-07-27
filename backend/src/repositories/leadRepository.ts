import { PrismaClient, LeadStatus } from "../generated/prisma";

const prisma = new PrismaClient();

interface CreateLeadData {
  leadId: string;
  phone: string;
  name?: string | null;
  email?: string | null;
}

interface PaginationOptions {
  page?: number;
  limit?: number;
  status?: LeadStatus;
  search?: string;
}

export const createLeads = async (leads: CreateLeadData[]) => {
  return prisma.lead.createMany({ data: leads });
};

export const getLeads = async () => {
  return prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
  });
};

export const getLeadsWithPagination = async (options: PaginationOptions) => {
  const { page = 1, limit = 50, status, search } = options;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { phone: { contains: search } },
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    leads,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

export const getLeadStats = async () => {
  const stats = await prisma.lead.groupBy({
    by: ["status"],
    _count: {
      status: true,
    },
  });

  const total = await prisma.lead.count();

  const formattedStats = {
    total,
    byStatus: stats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, {} as Record<LeadStatus, number>),
  };

  return formattedStats;
};

export const setLeadStatus = async (leadId: string, status: LeadStatus) => {
  return prisma.lead.update({ where: { id: leadId }, data: { status } });
};

export const getLeadById = async (leadId: string) => {
  return prisma.lead.findUnique({ where: { id: leadId } });
};

export const getLeadsByCampaign = async (
  campaignId: string,
  statusFilter?: LeadStatus[]
) => {
  const whereClause: any = {
    campaignId: campaignId,
  };

  if (statusFilter && statusFilter.length > 0) {
    whereClause.status = {
      in: statusFilter,
    };
  }

  return prisma.lead.findMany({
    where: whereClause,
    orderBy: {
      createdAt: "asc",
    },
  });
};
