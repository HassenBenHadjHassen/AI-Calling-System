import axios from "axios";
import { env } from "../config/env";

interface VapiCallRequest {
  phoneNumber: string;
  assistantId?: string;
  name?: string;
  leadId?: string;
  campaignId?: string;
}

interface VapiCallResponse {
  id: string;
  status: string;
  phoneNumber: string;
  startedAt?: string;
  endedAt?: string;
}

class VapiService {
  private baseURL = "https://api.vapi.ai";
  private apiKey: string;

  constructor() {
    this.apiKey = env.VAPI_API_KEY;
  }

  async createCall(callRequest: VapiCallRequest): Promise<VapiCallResponse> {
    try {
      // Get or create assistant
      const assistantId =
        callRequest.assistantId || (await this.getOrCreateAssistant());

      const callPayload = {
        phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
        customer: {
          number: callRequest.phoneNumber, // The client's number (who to call)
        },
        assistantId: assistantId,
        name: callRequest.name,
        // Optional but recommended metadata
        metadata: {
          customer_name: callRequest.name,
          customer_phonenumber: callRequest.phoneNumber,
          lead_id: callRequest.leadId,
          campaign_id: callRequest.campaignId,
          call_timestamp: new Date().toISOString(),
        },
      };

      const response = await axios.post(`${this.baseURL}/call`, callPayload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 10000, // 10 second timeout
      });

      console.log("Vapi.ai call created successfully:", response.data);
      return response.data;
    } catch (error: any) {
      console.error("Error creating Vapi call:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
        },
      });

      if (error.response?.status === 401) {
        throw new Error("Vapi.ai API key is invalid or expired");
      } else if (error.response?.status === 400) {
        console.error(
          "Response data:",
          JSON.stringify(error.response.data, null, 2)
        );
        console.error("Messages detail:", error.response.data.message);
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

  async getCall(callId: string): Promise<VapiCallResponse> {
    try {
      const response = await axios.get(`${this.baseURL}/call/${callId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error("Error fetching Vapi call:", error);
      throw new Error("Failed to fetch call from Vapi.ai");
    }
  }

  async endCall(callId: string): Promise<void> {
    try {
      await axios.patch(
        `${this.baseURL}/call/${callId}`,
        { status: "ended" },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.error("Error ending Vapi call:", error);
      throw new Error("Failed to end call");
    }
  }

  // Cache for assistant ID to avoid recreating
  private assistantId: string | null = null;

  async getOrCreateAssistant(): Promise<string> {
    if (this.assistantId) {
      console.log("Using cached assistant ID:", this.assistantId);
      return this.assistantId;
    }

    try {
      console.log("Checking for existing assistants...");

      // First, validate API key by making a simple request
      await this.validateApiKey();

      // Try to get existing assistant first
      const assistants = await this.listAssistants();
      console.log(`Found ${assistants.length} existing assistants`);

      const existingAssistant = assistants.find(
        (a: any) => a.name === "French AI Sales Agent"
      );

      if (existingAssistant) {
        console.log("Found existing assistant:", existingAssistant.id);
        this.assistantId = existingAssistant.id;
        return this.assistantId!;
      }

      // Create new assistant if none exists
      console.log("No existing assistant found, creating new one...");
      this.assistantId = await this.createAssistant();
      console.log("Successfully created new assistant:", this.assistantId);
      return this.assistantId;
    } catch (error: any) {
      console.error("Error getting or creating assistant:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      if (error.response?.status === 401) {
        throw new Error(
          "Vapi.ai API key is invalid. Please check your VAPI_API_KEY environment variable."
        );
      } else if (error.response?.status === 403) {
        throw new Error(
          "Vapi.ai API key does not have permission to create assistants."
        );
      } else {
        throw new Error(
          `Failed to get or create Vapi.ai assistant: ${error.message}`
        );
      }
    }
  }

  async validateApiKey(): Promise<void> {
    try {
      console.log("Validating Vapi.ai API key...");
      const response = await axios.get(`${this.baseURL}/assistant`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 5000,
      });
      console.log("API key validation successful");
    } catch (error: any) {
      console.error("API key validation failed:", {
        status: error.response?.status,
        message: error.message,
      });

      if (error.response?.status === 401) {
        throw new Error("Invalid Vapi.ai API key");
      } else if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
        throw new Error("Cannot connect to Vapi.ai API");
      } else {
        throw error;
      }
    }
  }

  async listAssistants(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseURL}/assistant`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.data || [];
    } catch (error) {
      console.error("Error listing assistants:", error);
      return [];
    }
  }

  async createAssistant(): Promise<string> {
    try {
      console.log("Creating Vapi.ai assistant with complete configuration...");

      const assistantConfig = {
        name: "French AI Sales Agent",
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "fr",
          smartFormat: false,
        },
        model: {
          provider: "openai",
          model: "gpt-3.5-turbo",
          temperature: 0.7,
          messages: [
            {
              content: `Tu es un agent commercial français professionnel et sympathique. Ton objectif est de:

1. Saluer poliment le prospect en français
2. Présenter brièvement notre service de manière engageante
3. Poser des questions qualifiantes pour comprendre leurs besoins
4. Détecter l'intérêt avec des mots-clés comme "intéressé", "oui", "plus d'infos", "en savoir plus"
5. Si le prospect montre de l'intérêt, utilise la fonction transfer_to_human
6. Toujours proposer une option de désinscription pour respecter le RGPD
7. Garde la conversation naturelle et professionnelle

Si le prospect dit "non", "pas intéressé" ou demande à être retiré de la liste, remercie-le poliment et termine l'appel.

Tu peux poser des questions comme:
- "Puis-je vous présenter rapidement notre solution?"
- "Cela pourrait-il vous intéresser?"
- "Souhaiteriez-vous en savoir plus?"

Si tu détectes de l'intérêt, utilise immédiatement la fonction transfer_to_human.`,
              role: "system",
            },
          ],
        },

        voice: {
          provider: "11labs",
          voiceId: "pNInz6obpgDQGcFmaJgB",
          stability: 0.5,
          similarityBoost: 0.8,
          style: 0,
          useSpeakerBoost: true,
        },
        firstMessage: "",
        backgroundSound: "off",
        backgroundSpeechDenoisingPlan: {
          smartDenoisingPlan: {
            enabled: true,
          },
        },
        modelOutputInMessagesEnabled: false,
        endCallMessage: "Merci beaucoup pour votre temps. Bonne journée !",
        endCallPhrases: [
          "au revoir",
          "raccrocher",
          "terminer",
          "stop",
          "arrêter",
        ],
        metadata: {},
        firstMessageInterruptionsEnabled: false,
        firstMessageMode: null,
        voicemailDetection: {
          provider: "google",
        },
        clientMessages: null,
        serverMessages: null,
        maxDurationSeconds: 20,
        transportConfigurations: [],
        observabilityPlan: {
          provider: "langfuse",
          tags: [],
        },
        credentials: [],
        hooks: [],
        voicemailMessage: "",
        compliancePlan: {},
        analysisPlan: {},
        artifactPlan: {},
        messagePlan: {},
        startSpeakingPlan: {},
        stopSpeakingPlan: {},
        monitorPlan: {},
        credentialIds: [],
        server: {},
        keypadInputPlan: {},
        backgroundDenoisingEnabled: false,
      };

      console.log(
        "Assistant config prepared:",
        JSON.stringify(assistantConfig, null, 2)
      );

      const response = await axios.post(
        `${this.baseURL}/assistant`,
        assistantConfig,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.id;
    } catch (error) {
      console.error("Error creating Vapi assistant:", error);
      throw new Error("Failed to create assistant");
    }
  }

  private async getDefaultAssistantId(): Promise<string> {
    // In production, you'd store this in your database or environment
    // For now, we'll create one if needed
    try {
      return await this.createAssistant();
    } catch (error) {
      throw new Error("Failed to get default assistant");
    }
  }

  private async getFrenchPhoneNumberId(): Promise<string> {
    try {
      const response = await axios.get(`${this.baseURL}/phone-number`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      // Find a French number (+33)
      const frenchNumber = response.data.find((number: any) =>
        number.number.startsWith("+33")
      );

      if (!frenchNumber) {
        throw new Error("No French phone number found in Vapi account");
      }

      return frenchNumber.id;
    } catch (error) {
      console.error("Error fetching French phone number:", error);
      throw new Error("Failed to get French phone number");
    }
  }
}

export const vapiService = new VapiService();
