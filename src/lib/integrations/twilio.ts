import twilio from 'twilio';
import { env } from '../env';
import { normalizePhoneNumber } from '../validation/phone';

export interface SendSmsParams {
  to: string;
  from?: string;
  body: string;
}

export interface SendSmsResult {
  success: boolean;
  messageId: string;
  status: string;
  isDryRun: boolean;
  error?: string;
}

export interface LineTypeIntelligenceResult {
  type: 'mobile' | 'landline' | 'voip' | 'unknown';
  carrierName?: string;
  error?: string;
}

class TwilioIntegration {
  private client: twilio.Twilio | null = null;

  constructor() {
    if (
      env.TWILIO_ACCOUNT_SID &&
      !env.TWILIO_ACCOUNT_SID.startsWith('AC_mock') &&
      env.TWILIO_AUTH_TOKEN &&
      !env.TWILIO_AUTH_TOKEN.startsWith('mock_')
    ) {
      this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    }
  }

  /**
   * Sends an SMS message. If DRY_RUN is enabled or mock credentials are in use,
   * simulates the delivery safely without contacting Twilio servers.
   */
  async sendSms(params: SendSmsParams): Promise<SendSmsResult> {
    const to = normalizePhoneNumber(params.to);
    const from = params.from ? normalizePhoneNumber(params.from) : env.TWILIO_PHONE_NUMBER;

    if (env.DRY_RUN || !this.client) {
      const mockId = `dry_run_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      console.log(`[DRY_RUN Twilio SMS] From: ${from} -> To: ${to}\nMessage: "${params.body}"`);
      return {
        success: true,
        messageId: mockId,
        status: 'delivered_dry_run',
        isDryRun: true,
      };
    }

    try {
      const message = await this.client.messages.create({
        to,
        from,
        body: params.body,
      });

      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        isDryRun: false,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Twilio SMS Error]:', errMsg);
      return {
        success: false,
        messageId: '',
        status: 'failed',
        isDryRun: false,
        error: errMsg,
      };
    }
  }

  /**
   * Queries Twilio Lookup API v2 with line_type_intelligence.
   * Returns whether the number is mobile, landline, or other.
   */
  async lookupLineType(rawNumber: string): Promise<LineTypeIntelligenceResult> {
    const phoneNumber = normalizePhoneNumber(rawNumber);

    if (env.DRY_RUN || !this.client) {
      // In dry run or test mode, derive line type deterministically from French prefix
      // French mobile numbers begin with +336 or +337
      const isMobile = phoneNumber.startsWith('+336') || phoneNumber.startsWith('+337');
      const isLandline =
        phoneNumber.startsWith('+331') ||
        phoneNumber.startsWith('+332') ||
        phoneNumber.startsWith('+333') ||
        phoneNumber.startsWith('+334') ||
        phoneNumber.startsWith('+335') ||
        phoneNumber.startsWith('+339');

      return {
        type: isMobile ? 'mobile' : isLandline ? 'landline' : 'unknown',
        carrierName: isMobile ? 'French Mobile Carrier (Dry Run)' : 'Fixed Line Carrier (Dry Run)',
      };
    }

    try {
      const result = await this.client.lookups.v2.phoneNumbers(phoneNumber).fetch({
        fields: 'line_type_intelligence',
      });

      const lineType = result.lineTypeIntelligence?.type?.toLowerCase();
      let type: LineTypeIntelligenceResult['type'] = 'unknown';

      if (lineType === 'mobile') type = 'mobile';
      else if (lineType === 'landline') type = 'landline';
      else if (lineType === 'voip') type = 'voip';

      return {
        type,
        carrierName: result.lineTypeIntelligence?.carrierName || undefined,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Twilio Lookup Warning for ${phoneNumber}]:`, errMsg);
      // Fallback to pattern recognition if API fails
      const isMobile = phoneNumber.startsWith('+336') || phoneNumber.startsWith('+337');
      return {
        type: isMobile ? 'mobile' : 'landline',
        error: errMsg,
      };
    }
  }

  /**
   * Validates Twilio inbound webhook signature (X-Twilio-Signature)
   */
  validateWebhookSignature(
    signature: string,
    url: string,
    params: Record<string, string>
  ): boolean {
    if (env.DRY_RUN || !env.TWILIO_AUTH_TOKEN || env.TWILIO_AUTH_TOKEN.startsWith('mock_')) {
      return true; // Bypass signature in dry run / development
    }

    try {
      return twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, url, params);
    } catch (err) {
      console.error('[Twilio Signature Validation Error]:', err);
      return false;
    }
  }

  /**
   * Builds empty TwiML response
   */
  buildEmptyTwimlResponse(): string {
    const twiml = new twilio.twiml.MessagingResponse();
    return twiml.toString();
  }
}

export const twilioClient = new TwilioIntegration();
