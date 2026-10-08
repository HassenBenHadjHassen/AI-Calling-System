import { describe, it, expect } from 'vitest';
import { openAiClient } from '@/lib/integrations/openai';

describe('SMS Intent Classification (Workflow D)', () => {
  it('classifies explicit confirmation replies as OUI', async () => {
    const examples = [
      'OUI',
      'oui',
      'ok ca marche confirme le',
      "d'accord",
      '1',
      'parfait',
      'ça marche',
    ];

    for (const text of examples) {
      const res = await openAiClient.classifySmsReply(text);
      expect(res.intent).toBe('OUI');
    }
  });

  it('classifies explicit refusal replies as NON', async () => {
    const examples = [
      'NON',
      'non',
      'non ou jamais ou je suis pas dispo',
      "non c'est impossible",
      '2',
      'refus',
      'annuler svp',
    ];

    for (const text of examples) {
      const res = await openAiClient.classifySmsReply(text);
      expect(res.intent).toBe('NON');
    }
  });

  it('classifies alternate time requests as AUTRE with parsed proposed time', async () => {
    const examples = [
      { text: "non mais à 17h si possible", expectedTime: '17h' },
      { text: "plutôt vers 16:30", expectedTime: '16h30' },
      { text: "possible de reporter à 18h ?", expectedTime: '18h' },
    ];

    for (const ex of examples) {
      const res = await openAiClient.classifySmsReply(ex.text);
      expect(res.intent).toBe('AUTRE');
      expect(res.proposedTime).toBe(ex.expectedTime);
    }
  });

  it('classifies irrelevant conversational messages as NONE', async () => {
    const examples = ['allo', 'jsp', 'bonjour qui est ce', 'merci'];

    for (const text of examples) {
      const res = await openAiClient.classifySmsReply(text);
      expect(res.intent).toBe('NONE');
    }
  });
});
