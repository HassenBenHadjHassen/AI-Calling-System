import { JotformSubmissionPayload, JotformSubmissionSchema } from '../validation/schemas';

export class JotformIntegration {
  /**
   * Normalizes incoming JotForm request body, supporting both raw multipart/form-data
   * where fields might be embedded in `rawRequest` or parsed JSON.
   */
  static parseSubmission(body: unknown): JotformSubmissionPayload {
    let payload = body;

    // JotForm often sends a JSON string in 'rawRequest'
    if (typeof body === 'object' && body !== null && 'rawRequest' in body && typeof (body as Record<string, unknown>).rawRequest === 'string') {
      try {
        payload = JSON.parse((body as Record<string, unknown>).rawRequest as string);
      } catch {
        console.warn('[JotForm parse warning]: Failed to parse body.rawRequest as JSON');
      }
    }

    return JotformSubmissionSchema.parse(payload);
  }

  /**
   * Generates the personalized Devis form link with the callId query parameter
   */
  static buildFormUrl(baseUrl: string, callId: string): string {
    if (baseUrl.includes('{callId}')) {
      return baseUrl.replace('{callId}', encodeURIComponent(callId));
    }
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}callId=${encodeURIComponent(callId)}`;
  }
}
