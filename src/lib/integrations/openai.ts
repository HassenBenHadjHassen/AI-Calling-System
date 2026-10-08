import OpenAI from 'openai';
import { env } from '../env';

export type SmsIntent = 'OUI' | 'NON' | 'AUTRE' | 'NONE';

export interface SmsClassificationResult {
  intent: SmsIntent;
  proposedTime?: string; // e.g. "17h00" or "17:00"
  rawText: string;
  source: 'deterministic' | 'openai';
}

class OpenAiIntegration {
  private openai: OpenAI | null = null;

  constructor() {
    if (
      env.OPENAI_API_KEY &&
      !env.OPENAI_API_KEY.startsWith('sk-mock')
    ) {
      this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
  }

  /**
   * Classifies an inbound SMS reply to an appointment confirmation prompt.
   * Uses fast deterministic regex rules first, then falls back to OpenAI for complex phrasing.
   */
  async classifySmsReply(body: string): Promise<SmsClassificationResult> {
    const text = body.trim();
    const lower = text.toLowerCase();

    // 1. Fast deterministic classification
    if (/^(oui|ok|d'accord|daccord|confirmé|confirme|1|yes|parfait|ça marche|ca marche)\b/i.test(lower)) {
      return {
        intent: 'OUI',
        rawText: text,
        source: 'deterministic',
      };
    }

    // Check for explicit time rescheduling in text (e.g., "plutôt à 17h", "non mais à 17h si possible", "à 16:30", "15h")
    const timeMatch = lower.match(/\b([0-2]?[0-9][h:][0-5]?[0-9]?)\b/);
    if (timeMatch && (lower.includes('plutôt') || lower.includes('autre') || lower.includes('possible') || lower.includes('reporter') || lower.includes('decal') || lower.includes('mais à') || lower.includes('vers') || lower.includes('à '))) {
      const parsedTime = timeMatch[1].replace(':', 'h');
      return {
        intent: 'AUTRE',
        proposedTime: parsedTime,
        rawText: text,
        source: 'deterministic',
      };
    }

    if (/^(non|pas dispo|impossible|refus|jamais|annuler|annule|2|no)\b/i.test(lower)) {
      return {
        intent: 'NON',
        rawText: text,
        source: 'deterministic',
      };
    }

    // 2. If OpenAI is not configured or in test mode without API key, classify conservative fallback
    if (!this.openai || env.DRY_RUN) {
      // Check for generic conversational filler
      if (/^(allo|bonjour|salut|qui est ce|merci|jsp)\b/i.test(lower)) {
        return {
          intent: 'NONE',
          rawText: text,
          source: 'deterministic',
        };
      }

      // Conservative fallback
      return {
        intent: 'NONE',
        rawText: text,
        source: 'deterministic',
      };
    }

    // 3. LLM classification via OpenAI
    try {
      const response = await this.openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'Tu es un classificateur de réponses SMS pour un cabinet infirmier. Analyse le SMS du patient et classe-le strictement en une des catégories suivantes:\n' +
              '- OUI (si le patient accepte ou confirme le rendez-vous proposé)\n' +
              '- NON (si le patient refuse ou annule le rendez-vous proposé)\n' +
              '- AUTRE (HHhMM) (si le patient propose un autre horaire spécifique, ex: AUTRE (17h00))\n' +
              '- NONE (si le message est hors sujet ou ne concerne pas le rendez-vous)\n\n' +
              'Réponds UNIQUEMENT par la catégorie exacte.',
          },
          {
            role: 'user',
            content: `SMS reçu: "${text}"`,
          },
        ],
        temperature: 0,
        max_tokens: 30,
      });

      const reply = response.choices[0]?.message?.content?.trim() || 'NONE';

      if (reply.startsWith('OUI')) {
        return { intent: 'OUI', rawText: text, source: 'openai' };
      }
      if (reply.startsWith('NON')) {
        return { intent: 'NON', rawText: text, source: 'openai' };
      }
      if (reply.includes('AUTRE')) {
        const timeFromLlm = reply.match(/\(([^)]+)\)/)?.[1] || '';
        return {
          intent: 'AUTRE',
          proposedTime: timeFromLlm || undefined,
          rawText: text,
          source: 'openai',
        };
      }

      return { intent: 'NONE', rawText: text, source: 'openai' };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[OpenAI SMS Classification Warning]:', errMsg);
      return {
        intent: 'NONE',
        rawText: text,
        source: 'deterministic',
      };
    }
  }
}

export const openAiClient = new OpenAiIntegration();
