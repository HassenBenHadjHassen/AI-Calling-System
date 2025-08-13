import { Vapi, VapiClient } from "@vapi-ai/server-sdk";
import { env } from "../config/env";

interface CallControlPayload {
	type: "say" | "add-message" | "control" | "end-call" | "transfer";
	content?: string;
	endCallAfterSpoken?: boolean;
	message?: {
		role: "system" | "user" | "assistant";
		content: string;
	};
	triggerResponseEnabled?: boolean;
	control?: "mute-assistant" | "unmute-assistant" | "say-first-message";
	destination?: {
		type: "number";
		number: string;
	};
}

class VapiService {
	private readonly client: VapiClient;
	private readonly phoneNumberId: string;
	private readonly workflowId: string;

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
				workflowOverrides: {
					variableValues: {
						title: callRequest.title,
						name: callRequest.name,
						phoneNumber: callRequest.phoneNumber,
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

	/**
	 * Control a live call using Vapi's call control features
	 * @param callId - The Vapi call ID
	 * @param controlPayload - The control action to perform
	 */
	async controlCall(
		callId: string,
		controlPayload: CallControlPayload
	): Promise<void> {
		console.log(
			`[CONTROL] Starting control call operation for callId: ${callId}`,
			{
				controlType: controlPayload.type,
				timestamp: new Date().toISOString(),
			}
		);

		try {
			// First get the call to obtain the control URL
			console.log(`[CONTROL] Fetching call details for callId: ${callId}`);
			const call = await this.getCall(callId);
			console.log(`[CONTROL] Call details retrieved successfully`, {
				callId: call.id,
				status: call.status,
				hasMonitor: !!call.monitor,
				hasControlUrl: !!call.monitor?.controlUrl,
			});

			if (!call.monitor?.controlUrl) {
				console.error(
					`[CONTROL] Control URL not available for call ${callId}`,
					{
						callStatus: call.status,
						monitorExists: !!call.monitor,
						controlUrlExists: !!call.monitor?.controlUrl,
					}
				);
				throw new Error(
					"Call control URL not available - call may not be active"
				);
			}

			console.log(
				`[CONTROL] Control URL found, preparing to send control request`,
				{
					controlUrl: call.monitor.controlUrl,
					controlPayload: controlPayload,
				}
			);

			const response = await fetch(call.monitor.controlUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(controlPayload),
			});

			console.log(`[CONTROL] Control request sent, response received`, {
				status: response.status,
				statusText: response.statusText,
				ok: response.ok,
			});

			if (!response.ok) {
				const errorData = await response.text();
				console.error(`[CONTROL] Control request failed`, {
					status: response.status,
					statusText: response.statusText,
					errorData: errorData,
					controlPayload: controlPayload,
				});
				throw new Error(
					`Call control failed: ${response.status} - ${errorData}`
				);
			}

			const responseData = await response.text();
			console.log(`[CONTROL] Control request successful`, {
				callId: callId,
				controlType: controlPayload.type,
				responseStatus: response.status,
				responseData: responseData || "No response body",
				timestamp: new Date().toISOString(),
			});

			console.log(
				`Call control action '${controlPayload.type}' executed successfully for call ${callId}`
			);
		} catch (error: any) {
			console.error(`[CONTROL] Error in control call operation`, {
				callId: callId,
				controlPayload: controlPayload,
				error: error.message,
				stack: error.stack,
				timestamp: new Date().toISOString(),
			});
			console.error("Error controlling call:", error);
			throw new Error(`Failed to control call: ${error.message}`);
		}
	}

	/**
	 * Make the assistant say a specific message during the call
	 */
	async sayMessage(
		callId: string,
		message: string,
		endCallAfterSpoken: boolean = false
	): Promise<void> {
		await this.controlCall(callId, {
			type: "say",
			content: message,
			endCallAfterSpoken,
		});
	}

	/**
	 * Add a message to the conversation history
	 */
	async addMessageToConversation(
		callId: string,
		message: { role: "system" | "user" | "assistant"; content: string },
		triggerResponse: boolean = true
	): Promise<void> {
		await this.controlCall(callId, {
			type: "add-message",
			message,
			triggerResponseEnabled: triggerResponse,
		});
	}

	/**
	 * Control assistant behavior (mute/unmute)
	 */
	async controlAssistant(
		callId: string,
		control: "mute-assistant" | "unmute-assistant" | "say-first-message"
	): Promise<void> {
		await this.controlCall(callId, {
			type: "control",
			control,
		});
	}

	/**
	 * End the call programmatically
	 */
	async endCall(callId: string): Promise<void> {
		await this.controlCall(callId, {
			type: "end-call",
		});
	}

	/**
	 * Transfer the call to another number
	 */
	async transferCall(
		callId: string,
		destinationNumber: string,
		transferMessage?: string
	): Promise<void> {
		await this.controlCall(callId, {
			type: "transfer",
			destination: {
				type: "number",
				number: destinationNumber,
			},
			content: transferMessage || "Transferring your call now",
		});
	}

	/**
	 * Get call monitoring URLs for real-time control and audio streaming
	 */
	async getCallMonitoringUrls(
		callId: string
	): Promise<{ listenUrl?: string; controlUrl?: string }> {
		try {
			const call = await this.getCall(callId);
			return {
				listenUrl: call.monitor?.listenUrl,
				controlUrl: call.monitor?.controlUrl,
			};
		} catch (error) {
			console.error("Error getting call monitoring URLs:", error);
			throw new Error("Failed to get call monitoring URLs");
		}
	}
}

export const vapiService = new VapiService();
