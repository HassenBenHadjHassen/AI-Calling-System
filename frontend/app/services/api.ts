// API service layer for communicating with backend
const API_BASE_URL =
  import.meta.env.REACT_APP_API_URL || "http://localhost:3548/api";

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = localStorage.getItem("authToken");

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
  duration?: number;
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
  uploadedCount: number;
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

    const token = localStorage.getItem("authToken");
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
    return apiService.put<Lead>(`/leads/${id}/status`, { status });
  },

  scheduleCall: async (
    data: ScheduleCallRequest
  ): Promise<ApiResponse<Lead>> => {
    return apiService.post<Lead>("/leads/schedule-call", data);
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
    return apiService.get<Lead[]>("/leads/available");
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

  startCampaign: async (id: string): Promise<ApiResponse<Campaign>> => {
    return apiService.put<Campaign>(`/campaigns/${id}/start`, {});
  },

  stopCampaign: async (id: string): Promise<ApiResponse<Campaign>> => {
    return apiService.put<Campaign>(`/campaigns/${id}/stop`, {});
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
    return apiService.put<Campaign>(`/campaigns/${id}/leads`, data);
  },

  removeLeadFromCampaign: async (
    id: string,
    leadId: string
  ): Promise<ApiResponse<Campaign>> => {
    return apiService.delete<Campaign>(`/campaigns/${id}/leads/${leadId}`);
  },

  getActiveCampaign: async (): Promise<ApiResponse<Campaign>> => {
    return apiService.get<Campaign>("/campaigns/active");
  },

  getNextCampaignToProcess: async (): Promise<ApiResponse<Campaign>> => {
    return apiService.get<Campaign>("/campaigns/next");
  },

  getCampaignStats: async (): Promise<ApiResponse<any>> => {
    return apiService.get<any>("/campaigns/stats");
  },
};

// Call API
export const callAPI = {
  triggerCall: async (
    leadId: string,
    title: string
  ): Promise<ApiResponse<CallHistory>> => {
    return apiService.post<CallHistory>(
      `/calls/${leadId}/trigger/${title}`,
      {}
    );
  },

  handleWebhook: async (webhookData: any): Promise<ApiResponse<null>> => {
    return apiService.post<null>("/calls/webhook", webhookData);
  },

  triggerScheduledCalls: async (
    title: string
  ): Promise<ApiResponse<TriggerCallResponse>> => {
    return apiService.post<TriggerCallResponse>(
      `/calls/scheduled/${title}`,
      {}
    );
  },

  triggerCampaignCalls: async (
    campaignId: string,
    title: string
  ): Promise<ApiResponse<TriggerCallResponse>> => {
    return apiService.post<TriggerCallResponse>(
      `/calls/campaign/${campaignId}/${title}`,
      {}
    );
  },

  getCallStats: async (): Promise<ApiResponse<CallStats>> => {
    return apiService.get<CallStats>("/calls/stats");
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

  getCallById: async (id: string): Promise<ApiResponse<CallHistory>> => {
    return apiService.get<CallHistory>(`/calls/${id}`);
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

// Export the main API service for direct use if needed
export { apiService };
