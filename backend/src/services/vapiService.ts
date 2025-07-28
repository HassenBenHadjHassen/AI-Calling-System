import { Vapi, VapiClient } from "@vapi-ai/server-sdk";
import { env } from "../config/env";
class VapiService {
  private client: VapiClient;
  private phoneNumberId: string;
  private workflowId: string;

  constructor() {
    this.phoneNumberId = env.VAPI_PHONE_NUMBER_ID;
    this.workflowId = env.VAPI_WORKFLOW_ID;
    this.client = new VapiClient({
      token: env.VAPI_API_KEY,
    });
  }

  async createCall(callRequest: any): Promise<Vapi.CallsCreateResponse> {
    try {
      const workflowId = callRequest.workflowId || this.workflowId;

      const callPayload: Vapi.CreateCallDto = {
        phoneNumberId: this.phoneNumberId,
        customer: {
          number: callRequest.phoneNumber,
        },
        workflowId: workflowId,
        name: callRequest.name,
        assistantId: env.VAPI_ASSISTANT_ID,
        workflowOverrides: {
          variableValues: {
            title: callRequest.title,
            name: callRequest.name,
          },
        },
      };

      // Use the SDK's calls resource
      const response = await this.client.calls.create(callPayload);

      console.log("Vapi.ai call created successfully:", response);
      return response;
    } catch (error: any) {
      console.error("Error creating Vapi call:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      if (error.response?.status === 401) {
        throw new Error("Vapi.ai API key is invalid or expired");
      } else if (error.response?.status === 400) {
        console.error(
          "Response data:",
          JSON.stringify(error.response.data, null, 2)
        );
        throw new Error(
          `Vapi.ai API error: ${
            error.response.data?.message || "Invalid request parameters"
          }`
        );
      } else if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
        throw new Error(
          "Cannot connect to Vapi.ai API - check your internet connection"
        );
      } else {
        console.error("Unknown error:", error);
      }
      throw new Error(`Failed to create call with Vapi.ai: ${error.message}`);
    }
  }

  async getCall(callId: string): Promise<Vapi.Call> {
    try {
      const response = await this.client.calls.get(callId);
      return response;
    } catch (error) {
      console.error("Error fetching Vapi call:", error);
      throw new Error("Failed to fetch call from Vapi.ai");
    }
  }
}

export const vapiService = new VapiService();
