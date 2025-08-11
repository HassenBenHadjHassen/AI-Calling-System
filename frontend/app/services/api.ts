// API service layer for communicating with backend
const API_BASE_URL = import.meta.env.VITE_API_URL;

class ApiService {
	private async request<T>(
		endpoint: string,
		options: RequestInit = {}
	): Promise<ApiResponse<T>> {
		const token =
			typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

		const config: RequestInit = {
			headers: {
				"Content-Type": "application/json",
				...(token && { Authorization: `Bearer ${token}` }),
				...options.headers,
			},
			...options,
		};

		const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
		const json = await response.json().catch(() => ({}));

		// Always return the parsed JSON, even for non-OK responses
		return json;
	}
	async get<T>(endpoint: string): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint);
	}

	async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	async put<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	async patch<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, {
			method: "PATCH",
			body: JSON.stringify(data),
		});
	}

	async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, {
			method: "DELETE",
		});
	}
}

const apiService = new ApiService();

// --- Types ---
export interface ApiResponse<T> {
	success: boolean;
	data: T;
	error?: string;
}

// Authentication Types
export interface AuthPayload {
	email: string;
	password: string;
}

export interface AuthResponse {
	token: string;
}

export interface User {
	id: number;
	email: string;
	role: string;
}

export interface AuthUserResponse {
	user: User;
	token: string;
}

// Lead Types
export interface Lead {
	id: string;
	name: string;
	address?: string;
	postalCode?: string;
	city?: string;
	phone1: string;
	phone2?: string;
	status: LeadStatus;
	campaignId?: string;
	blacklisted: boolean;
	scheduledCallAt?: string;
	scheduledCallNote?: string;
	scheduledCallStatus?: ScheduledCallStatus;
	createdAt: string;
	updatedAt: string;
	campaign?: Campaign;
}

export type LeadStatus =
	| "NEW"
	| "CALLED"
	| "INTERESTED"
	| "TRANSFERRED"
	| "FAILED"
	| "BLACKLISTED"
	| "SCHEDULED";

export type ScheduledCallStatus =
	| "PENDING"
	| "COMPLETED"
	| "FAILED"
	| "CANCELLED"
	| "RESCHEDULED";

export interface CreateLeadRequest {
	name: string;
	phone1: string;
	phone2?: string;
	address?: string;
	postalCode?: string;
	city?: string;
}

export interface UpdateLeadStatusRequest {
	status: LeadStatus;
}

export interface ScheduleCallRequest {
	customerPhoneNumber: string;
	scheduledCallAt: string;
	note?: string;
}

export interface BlacklistLeadRequest {
	customerPhoneNumber: string;
}

// Campaign Types
export interface Campaign {
	id: string;
	name: string;
	status: CampaignStatus;
	startedAt?: string;
	stoppedAt?: string;
	leads?: Lead[];
}

export type CampaignStatus = "ACTIVE" | "STOPPED" | "COMPLETED";

export interface CreateCampaignRequest {
	name: string;
}

export interface AddLeadsToCampaignRequest {
	leadIds: string[];
}

// Call Types
export interface CallHistory {
	id: string;
	leadId: string;
	campaignId?: string;
	callStatus: CallStatus;
	transferred: boolean;
	transferTo?: string;
	fromNumber?: string; // System phone number (Vapi phone number)
	toNumber?: string;   // Lead's phone number
	duration?: number;
	cost?: number; // Cost in dollars from Vapi.ai
	callTime: string;
	vapiCallId?: string;
	notes?: string;
	lead?: Lead;
}

export type CallStatus =
	| "INITIATED"
	| "COMPLETED"
	| "TRANSFERRED"
	| "FAILED"
	| "SCHEDULED";

export interface CallStats {
	totalCalls: number;
	completedCalls: number;
	failedCalls: number;
	transferredCalls: number;
	initiatedCalls: number;
	averageDuration: number;
	// Backend returns these field names
	total?: number;
	completed?: number;
	transferred?: number;
	failed?: number;
	scheduled?: number;
}

export interface TriggerCallResponse {
	triggeredCount: number;
	calls: CallHistory[];
}

export interface UpdateCallNotesRequest {
	notes: string;
}

// File Upload Types
export interface UploadResponse {
	totalLeads: number;
	campaignsCreated: number;
	leadsProcessed: number;
	duplicatesSkipped: number;
	errors?: string[];
}

// Authentication API
export const authAPI = {
	login: async (
		email: string,
		password: string
	): Promise<ApiResponse<AuthResponse>> => {
		return apiService.post<AuthResponse>("/auth/login", {
			email,
			password,
		});
	},

	register: async (
		email: string,
		password: string
	): Promise<ApiResponse<User>> => {
		return apiService.post<User>("/auth/register", {
			email,
			password,
		});
	},

	logout: async (): Promise<ApiResponse<{ note: string }>> => {
		return apiService.post<{ note: string }>("/auth/logout", {});
	},

	refreshToken: async (): Promise<ApiResponse<AuthUserResponse>> => {
		return apiService.post<AuthUserResponse>("/auth/refresh", {});
	},

	getProfile: async (): Promise<ApiResponse<User>> => {
		return apiService.get<User>("/auth/profile");
	},

	verifyToken: async (): Promise<ApiResponse<User>> => {
		return apiService.get<User>("/auth/verify");
	},

	getUsers: async (): Promise<ApiResponse<{ users: User[] }>> => {
		return apiService.get<{ users: User[] }>("/auth/users");
	},
};

// Lead API
export const leadAPI = {
	createManualLead: async (
		data: CreateLeadRequest
	): Promise<ApiResponse<Lead>> => {
		return apiService.post<Lead>("/leads/manual", data);
	},

	uploadLeads: async (file: File): Promise<ApiResponse<UploadResponse>> => {
		const formData = new FormData();
		formData.append("file", file);

		const token =
			typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
		const response = await fetch(`${API_BASE_URL}/leads/upload`, {
			method: "POST",
			headers: {
				...(token && { Authorization: `Bearer ${token}` }),
			},
			body: formData,
		});

		const json = await response.json().catch(() => ({}));
		return json;
	},

	getLeads: async (status?: LeadStatus): Promise<ApiResponse<Lead[]>> => {
		const params = status ? `?status=${status}` : "";
		return apiService.get<Lead[]>(`/leads${params}`);
	},

	getLeadById: async (id: string): Promise<ApiResponse<Lead>> => {
		return apiService.get<Lead>(`/leads/${id}`);
	},

	updateLeadStatus: async (
		id: string,
		status: LeadStatus
	): Promise<ApiResponse<Lead>> => {
		return apiService.patch<Lead>(`/leads/${id}/status`, { status });
	},

	updateLead: async (
		id: string,
		data: {
			name?: string;
			address?: string;
			postalCode?: string;
			city?: string;
			phone1?: string;
			phone2?: string;
		}
	): Promise<ApiResponse<Lead>> => {
		return apiService.put<Lead>(`/leads/${id}`, data);
	},

	scheduleCall: async (
		data: ScheduleCallRequest
	): Promise<ApiResponse<Lead>> => {
		return apiService.post<Lead>("/leads/schedule", data);
	},

	blacklistLead: async (
		data: BlacklistLeadRequest
	): Promise<ApiResponse<Lead>> => {
		return apiService.post<Lead>("/leads/blacklist", data);
	},

	getScheduledCalls: async (): Promise<ApiResponse<Lead[]>> => {
		return apiService.get<Lead[]>("/leads/scheduled-calls");
	},

	getDueScheduledCalls: async (): Promise<ApiResponse<Lead[]>> => {
		return apiService.get<Lead[]>("/leads/due-scheduled-calls");
	},

	getAvailableLeads: async (): Promise<ApiResponse<Lead[]>> => {
		return apiService.get<Lead[]>("/leads/available/campaign");
	},

	cleanAllLeads: async (): Promise<ApiResponse<{ deletedCount: number }>> => {
		return apiService.delete<{ deletedCount: number }>("/leads/clean/all");
	},

	deleteLead: async (id: string): Promise<ApiResponse<{ message: string }>> => {
		return apiService.delete<{ message: string }>(`/leads/${id}`);
	},

	deleteLeads: async (
		leadIds: string[]
	): Promise<ApiResponse<{ message: string; deletedCount: number }>> => {
		return apiService.post<{ message: string; deletedCount: number }>(
			"/leads/delete/batch",
			{ leadIds }
		);
	},

	cleanupOrphanedLeads: async (): Promise<
		ApiResponse<{ cleanedCount: number }>
	> => {
		return apiService.post<{ cleanedCount: number }>(
			"/leads/cleanup/orphaned",
			{}
		);
	},

	getLeadStatistics: async (): Promise<
		ApiResponse<{
			totalLeads: number;
			leadsByStatus: Record<string, number>;
			availableLeads: number;
			blacklistedLeads: number;
			scheduledLeads: number;
			orphanedLeads: number;
		}>
	> => {
		return apiService.get<{
			totalLeads: number;
			leadsByStatus: Record<string, number>;
			availableLeads: number;
			blacklistedLeads: number;
			scheduledLeads: number;
			orphanedLeads: number;
		}>("/leads/statistics");
	},

	resetLeadsForTesting: async (): Promise<
		ApiResponse<{ resetCount: number }>
	> => {
		return apiService.post<{ resetCount: number }>("/leads/reset/testing", {});
	},
	debugLeadAvailability: async (): Promise<
		ApiResponse<{
			totalLeads: number;
			leadsByStatus: Record<string, number>;
			leadsByCampaignId: Record<string, number>;
			blacklistedLeads: number;
			scheduledLeads: number;
			availableLeads: number;
		}>
	> => {
		return apiService.get<{
			totalLeads: number;
			leadsByStatus: Record<string, number>;
			leadsByCampaignId: Record<string, number>;
			blacklistedLeads: number;
			scheduledLeads: number;
			availableLeads: number;
		}>("/leads/debug/availability");
	},
	getOrphanedScheduledCalls: async (): Promise<ApiResponse<Lead[]>> => {
		return apiService.get<Lead[]>("/leads/orphaned-scheduled-calls");
	},

	reassignOrphanedScheduledCall: async (data: {
		leadId: string;
		campaignId: string;
	}): Promise<ApiResponse<Lead>> => {
		return apiService.post<Lead>("/leads/reassign-orphaned-call", data);
	},

	getOrphanedScheduledCallsCount: async (): Promise<
		ApiResponse<{ count: number }>
	> => {
		return apiService.get<{ count: number }>(
			"/leads/orphaned-scheduled-calls/count"
		);
	},
};

// Campaign API
export const campaignAPI = {
	createCampaign: async (
		data: CreateCampaignRequest
	): Promise<ApiResponse<Campaign>> => {
		return apiService.post<Campaign>("/campaigns", data);
	},

	getCampaigns: async (
		status?: CampaignStatus
	): Promise<ApiResponse<Campaign[]>> => {
		const params = status ? `?status=${status}` : "";
		return apiService.get<Campaign[]>(`/campaigns${params}`);
	},

	getCampaignById: async (id: string): Promise<ApiResponse<Campaign>> => {
		return apiService.get<Campaign>(`/campaigns/${id}`);
	},

	getCampaign: async (id: string): Promise<ApiResponse<Campaign>> => {
		return apiService.get<Campaign>(`/campaigns/${id}`);
	},

	startCampaign: async (id: string): Promise<ApiResponse<Campaign>> => {
		return apiService.post<Campaign>(`/campaigns/${id}/start`, {});
	},

	stopCampaign: async (id: string): Promise<ApiResponse<Campaign>> => {
		return apiService.post<Campaign>(`/campaigns/${id}/stop`, {});
	},

	completeCampaign: async (id: string): Promise<ApiResponse<Campaign>> => {
		return apiService.put<Campaign>(`/campaigns/${id}/complete`, {});
	},

	deleteCampaign: async (id: string): Promise<ApiResponse<null>> => {
		return apiService.delete<null>(`/campaigns/${id}`);
	},

	addLeadsToCampaign: async (
		id: string,
		data: AddLeadsToCampaignRequest
	): Promise<ApiResponse<Campaign>> => {
		return apiService.post<Campaign>(`/campaigns/${id}/leads`, data);
	},

	removeLeadFromCampaign: async (
		id: string,
		leadId: string
	): Promise<ApiResponse<Campaign>> => {
		return apiService.delete<Campaign>(`/campaigns/${id}/leads/${leadId}`);
	},

	getActiveCampaign: async (): Promise<ApiResponse<Campaign>> => {
		return apiService.get<Campaign>("/campaigns/active/current");
	},

	getAllActiveCampaigns: async (): Promise<ApiResponse<Campaign[]>> => {
		return apiService.get<Campaign[]>("/campaigns/active/all");
	},

	getNextCampaignToProcess: async (): Promise<ApiResponse<Campaign>> => {
		return apiService.get<Campaign>("/campaigns/next/process");
	},

	getCampaignStats: async (): Promise<ApiResponse<any>> => {
		return apiService.get<any>("/campaigns/stats");
	},

	cleanAllCampaigns: async (): Promise<
		ApiResponse<{ deletedCount: number }>
	> => {
		return apiService.delete<{ deletedCount: number }>("/campaigns/clean/all");
	},
};

// Call API
export const callAPI = {
	triggerCall: async (
		leadId: string,
		title: string,
		name: string
	): Promise<ApiResponse<CallHistory>> => {
		return apiService.post<CallHistory>(`/calls/trigger/${leadId}`, {
			title,
		});
	},

	// Webhook handling removed - replaced with enhanced polling system

	triggerScheduledCalls: async (
		title: string
	): Promise<ApiResponse<TriggerCallResponse>> => {
		return apiService.post<TriggerCallResponse>(`/calls/scheduled`, {});
	},

	triggerCampaignCalls: async (
		campaignId: string,
		title: string
	): Promise<ApiResponse<TriggerCallResponse>> => {
		return apiService.post<TriggerCallResponse>(
			`/calls/campaign/${campaignId}`,
			{}
		);
	},

	handleOverdueRescheduledCalls: async (): Promise<
		ApiResponse<{
			processedCount: number;
			message: string;
		}>
	> => {
		return apiService.post<{
			processedCount: number;
			message: string;
		}>("/calls/trigger/overdue", {});
	},

	getCallsByLead: async (
		leadId: string
	): Promise<ApiResponse<CallHistory[]>> => {
		return apiService.get<CallHistory[]>(`/calls/lead/${leadId}`);
	},

	getCallsByCampaign: async (
		campaignId: string
	): Promise<ApiResponse<CallHistory[]>> => {
		return apiService.get<CallHistory[]>(`/calls/campaign/${campaignId}`);
	},

	getTransferredCalls: async (): Promise<ApiResponse<CallHistory[]>> => {
		return apiService.get<CallHistory[]>("/calls/transferred");
	},

	getCompletedCalls: async (): Promise<ApiResponse<CallHistory[]>> => {
		return apiService.get<CallHistory[]>("/calls/completed");
	},

	getFailedCalls: async (): Promise<ApiResponse<CallHistory[]>> => {
		return apiService.get<CallHistory[]>("/calls/failed");
	},

	updateCallNotes: async (
		id: string,
		data: UpdateCallNotesRequest
	): Promise<ApiResponse<CallHistory>> => {
		return apiService.put<CallHistory>(`/calls/${id}/notes`, data);
	},

	getRecentCalls: async (
		limit?: number
	): Promise<ApiResponse<CallHistory[]>> => {
		const params = limit ? `?limit=${limit}` : "";
		return apiService.get<CallHistory[]>(`/calls/recent${params}`);
	},

	getCallById: async (id: string): Promise<ApiResponse<CallHistory>> => {
		return apiService.get<CallHistory>(`/calls/${id}`);
	},

	getCallHistory: async (params: {
		campaignId?: string;
		leadId?: string;
	}): Promise<ApiResponse<CallHistory[]>> => {
		if (params.campaignId) {
			return apiService.get<CallHistory[]>(
				`/calls/campaign/${params.campaignId}`
			);
		}
		if (params.leadId) {
			return apiService.get<CallHistory[]>(`/calls/lead/${params.leadId}`);
		}
		// If no specific filters, return recent calls
		return apiService.get<CallHistory[]>("/calls/recent");
	},

	reconcileStaleCalls: async (params?: {
		lookbackMinutes?: number;
		batchSize?: number;
	}): Promise<
		ApiResponse<{
			scanned: number;
			finalized: number;
			errors: string[];
		}>
	> => {
		return apiService.post<{
			scanned: number;
			finalized: number;
			errors: string[];
		}>("/calls/reconcile/stale", params || {});
	},

	reconcileStaleCallsViaScheduler: async (): Promise<
		ApiResponse<{
			scanned: number;
			finalized: number;
			errors: string[];
		}>
	> => {
		return apiService.post<{
			scanned: number;
			finalized: number;
			errors: string[];
		}>("/scheduler/reconcile-stale", {});
	},

	getCallStats: async (params?: {
		campaignId?: string;
	}): Promise<ApiResponse<CallStats>> => {
		const queryParams = new URLSearchParams();
		if (params?.campaignId) queryParams.append("campaignId", params.campaignId);
		const queryString = queryParams.toString();
		const endpoint = `/calls/stats${queryString ? `?${queryString}` : ""}`;
		return apiService.get<CallStats>(endpoint);
	},

	getCallManagementStats: async (): Promise<
		ApiResponse<{
			activeCalls: number;
			maxCalls: number;
			queueLength: number;
			scheduledInQueue: number;
			campaignInQueue: number;
		}>
	> => {
		return apiService.get<{
			activeCalls: number;
			maxCalls: number;
			queueLength: number;
			scheduledInQueue: number;
			campaignInQueue: number;
		}>("/calls/management-stats");
	},

	// ===== Live Call Control =====
	getMonitoringUrls: async (
		vapiCallId: string
	): Promise<ApiResponse<{ listenUrl?: string; controlUrl?: string }>> => {
		return apiService.get<{ listenUrl?: string; controlUrl?: string }>(
			`/calls/control/${vapiCallId}/monitoring-urls`
		);
	},

	sayMessage: async (
		vapiCallId: string,
		params: { message: string; endCallAfterSpoken?: boolean }
	): Promise<ApiResponse<null>> => {
		return apiService.post<null>(`/calls/control/${vapiCallId}/say`, params);
	},

	addConversationMessage: async (
		vapiCallId: string,
		params: {
			message: { role: "system" | "user" | "assistant"; content: string };
			triggerResponse?: boolean;
		}
	): Promise<ApiResponse<null>> => {
		return apiService.post<null>(
			`/calls/control/${vapiCallId}/conversation`,
			params
		);
	},

	controlAssistant: async (
		vapiCallId: string,
		control: "mute-assistant" | "unmute-assistant" | "say-first-message"
	): Promise<ApiResponse<null>> => {
		return apiService.post<null>(`/calls/control/${vapiCallId}/assistant`, {
			control,
		});
	},

	endCall: async (vapiCallId: string): Promise<ApiResponse<null>> => {
		return apiService.post<null>(`/calls/control/${vapiCallId}/end`, {});
	},

	transferCall: async (
		vapiCallId: string,
		params: { destinationNumber: string; transferMessage?: string }
	): Promise<ApiResponse<null>> => {
		return apiService.post<null>(
			`/calls/control/${vapiCallId}/transfer`,
			params
		);
	},
};

// Health Check API
export const healthAPI = {
	check: async (): Promise<
		ApiResponse<{
			status: string;
			timestamp: string;
			environment: string;
			version: string;
		}>
	> => {
		return apiService.get<{
			status: string;
			timestamp: string;
			environment: string;
			version: string;
		}>("/health");
	},
};

// Scheduler API
export const schedulerAPI = {
	getSchedulerStatus: async (): Promise<
		ApiResponse<{
			isRunning: boolean;
			nextCheckTime: Date;
			dueCallsCount: number;
			orphanedCallsCount: number;
		}>
	> => {
		return apiService.get<{
			isRunning: boolean;
			nextCheckTime: Date;
			dueCallsCount: number;
			orphanedCallsCount: number;
		}>("/scheduler/status");
	},

	triggerDueCalls: async (): Promise<
		ApiResponse<{ processedCount: number; errors: string[] }>
	> => {
		return apiService.post<{ processedCount: number; errors: string[] }>(
			"/scheduler/trigger",
			{}
		);
	},

	startScheduler: async (): Promise<ApiResponse<{ message: string }>> => {
		return apiService.post<{ message: string }>("/scheduler/start", {});
	},

	stopScheduler: async (): Promise<ApiResponse<{ message: string }>> => {
		return apiService.post<{ message: string }>("/scheduler/stop", {});
	},
};

// Export the main API service for direct use if needed
export { apiService };
