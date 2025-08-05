import { PrismaClient, CallHistory, CallStatus } from "@prisma/client";

export class CallRepository {
	private prisma: PrismaClient;

	constructor() {
		this.prisma = new PrismaClient();
	}

	async create(callData: {
		leadId: string;
		campaignId?: string;
		callStatus: CallStatus;
		vapiCallId?: string;
		notes?: string;
	}): Promise<CallHistory> {
		try {
			return await this.prisma.callHistory.create({
				data: callData,
				include: {
					lead: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to create call record: ${error.message}`);
		}
	}

	async findById(id: string): Promise<CallHistory | null> {
		try {
			return await this.prisma.callHistory.findUnique({
				where: { id },
				include: {
					lead: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find call by ID: ${error.message}`);
		}
	}

	async findByVapiCallId(vapiCallId: string): Promise<CallHistory | null> {
		try {
			return await this.prisma.callHistory.findFirst({
				where: { vapiCallId },
				include: {
					lead: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find call by Vapi call ID: ${error.message}`);
		}
	}

	async findByLeadId(leadId: string): Promise<CallHistory[]> {
		try {
			return await this.prisma.callHistory.findMany({
				where: { leadId },
				include: {
					lead: true,
				},
				orderBy: {
					callTime: "desc",
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find calls by lead ID: ${error.message}`);
		}
	}

	async findByCampaignId(campaignId: string): Promise<CallHistory[]> {
		try {
			return await this.prisma.callHistory.findMany({
				where: { campaignId },
				include: {
					lead: true,
				},
				orderBy: {
					callTime: "desc",
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find calls by campaign ID: ${error.message}`);
		}
	}

	async updateStatus(id: string, status: CallStatus): Promise<CallHistory> {
		try {
			return await this.prisma.callHistory.update({
				where: { id },
				data: { callStatus: status },
				include: {
					lead: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to update call status: ${error.message}`);
		}
	}

	async updateTransfer(
		id: string,
		transferred: boolean,
		transferTo?: string
	): Promise<CallHistory> {
		try {
			return await this.prisma.callHistory.update({
				where: { id },
				data: {
					transferred,
					transferTo,
					callStatus: CallStatus.TRANSFERRED,
				},
				include: {
					lead: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to update call transfer: ${error.message}`);
		}
	}

	async updateDuration(id: string, duration: number): Promise<CallHistory> {
		try {
			return await this.prisma.callHistory.update({
				where: { id },
				data: { duration },
				include: {
					lead: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to update call duration: ${error.message}`);
		}
	}

	async updateNotes(id: string, notes: string): Promise<CallHistory> {
		try {
			return await this.prisma.callHistory.update({
				where: { id },
				data: { notes },
				include: {
					lead: true,
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to update call notes: ${error.message}`);
		}
	}

	async findByStatus(status: CallStatus): Promise<CallHistory[]> {
		try {
			return await this.prisma.callHistory.findMany({
				where: { callStatus: status },
				include: {
					lead: true,
				},
				orderBy: {
					callTime: "desc",
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find calls by status: ${error.message}`);
		}
	}

	async findTransferredCalls(): Promise<CallHistory[]> {
		try {
			return await this.prisma.callHistory.findMany({
				where: { transferred: true },
				include: {
					lead: true,
				},
				orderBy: {
					callTime: "desc",
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find transferred calls: ${error.message}`);
		}
	}

	async findCompletedCalls(): Promise<CallHistory[]> {
		try {
			return await this.prisma.callHistory.findMany({
				where: { callStatus: CallStatus.COMPLETED },
				include: {
					lead: true,
				},
				orderBy: {
					callTime: "desc",
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find completed calls: ${error.message}`);
		}
	}

	async findFailedCalls(): Promise<CallHistory[]> {
		try {
			return await this.prisma.callHistory.findMany({
				where: { callStatus: CallStatus.FAILED },
				include: {
					lead: true,
				},
				orderBy: {
					callTime: "desc",
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find failed calls: ${error.message}`);
		}
	}

	async findRecentCalls(limit: number = 50): Promise<CallHistory[]> {
		try {
			return await this.prisma.callHistory.findMany({
				include: {
					lead: true,
				},
				orderBy: {
					callTime: "desc",
				},
				take: limit,
			});
		} catch (error: any) {
			throw new Error(`Failed to find recent calls: ${error.message}`);
		}
	}

	async findAll(): Promise<CallHistory[]> {
		try {
			return await this.prisma.callHistory.findMany({
				include: {
					lead: true,
				},
				orderBy: {
					callTime: "desc",
				},
			});
		} catch (error: any) {
			throw new Error(`Failed to find all calls: ${error.message}`);
		}
	}

	async getCallStats(): Promise<{
		total: number;
		completed: number;
		transferred: number;
		failed: number;
		scheduled: number;
	}> {
		try {
			const [total, completed, transferred, failed, scheduled] =
				await Promise.all([
					this.prisma.callHistory.count(),
					this.prisma.callHistory.count({
						where: { callStatus: CallStatus.COMPLETED },
					}),
					this.prisma.callHistory.count({ where: { transferred: true } }),
					this.prisma.callHistory.count({
						where: { callStatus: CallStatus.FAILED },
					}),
					this.prisma.callHistory.count({
						where: { callStatus: CallStatus.SCHEDULED },
					}),
				]);

			return {
				total,
				completed,
				transferred,
				failed,
				scheduled,
			};
		} catch (error: any) {
			throw new Error(`Failed to get call statistics: ${error.message}`);
		}
	}
}
