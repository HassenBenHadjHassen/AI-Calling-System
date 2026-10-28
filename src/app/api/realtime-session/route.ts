import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';


const REALTIME_TOOLS = [
  {
    type: 'function',
    name: 'book_appointment',
    description: 'Enregistre ou bloque une demande de rendez-vous dans le planning pour un patient ou un client.',
    parameters: {
      type: 'object',
      properties: {
        clientOrPatientName: {
          type: 'string',
          description: "Nom et prénom de l'appelant ou du patient",
        },
        dateTime: {
          type: 'string',
          description: 'Date et heure convenues pour le rendez-vous (ex: demain matin à 08h30)',
        },
        serviceType: {
          type: 'string',
          description: 'Type de soin, consultation ou intervention demandée',
        },
        address: {
          type: 'string',
          description: "Adresse du domicile si intervention ou soins sur place",
        },
        notes: {
          type: 'string',
          description: 'Informations complémentaires importantes (ex: ordonnance disponible)',
        },
      },
      required: ['clientOrPatientName', 'dateTime', 'serviceType'],
    },
  },
  {
    type: 'function',
    name: 'send_quote_sms',
    description: 'Envoie instantanément un SMS contenant un lien sécurisé vers le portail devis pour envoyer photos et plans du chantier.',
    parameters: {
      type: 'object',
      properties: {
        clientName: {
          type: 'string',
          description: 'Nom du client demandeur de devis',
        },
        projectType: {
          type: 'string',
          description: 'Nature des travaux (ex: rénovation salle de bain 15m², remplacement toiture, électricité)',
        },
        urgency: {
          type: 'string',
          enum: ['urgent_depannage', 'projet_planifie'],
          description: 'Caractère urgent (ex: fuite d eau, sinistre) ou projet planifié',
        },
        postalCode: {
          type: 'string',
          description: 'Code postal ou ville du chantier',
        },
      },
      required: ['clientName', 'projectType'],
    },
  },
  {
    type: 'function',
    name: 'trigger_urgent_alert',
    description: "Déclenche une alerte immédiate par notification et SMS sur le téléphone de garde ou d'astreinte du professionnel.",
    parameters: {
      type: 'object',
      properties: {
        callerName: {
          type: 'string',
          description: "Nom de l'appelant",
        },
        reason: {
          type: 'string',
          description: "Motif précis de l'urgence (détresse médicale, dégât des eaux majeur)",
        },
        recommendedAction: {
          type: 'string',
          description: 'Action immédiate préconisée (ex: rappel prioritaire soignant, consigne SAMU 15)',
        },
      },
      required: ['reason'],
    },
  },
  {
    type: 'function',
    name: 'request_human_callback',
    description: 'Enregistre une demande de rappel ou audit téléphonique pour un professionnel intéressé par la solution VoxFlow AI.',
    parameters: {
      type: 'object',
      properties: {
        callerName: {
          type: 'string',
          description: "Nom de l'appelant",
        },
        businessType: {
          type: 'string',
          description: "Activité de l'entreprise (santé, BTP, conseil, commerce...)",
        },
        phoneNumber: {
          type: 'string',
          description: 'Numéro de téléphone de rappel',
        },
        topic: {
          type: 'string',
          description: "Objet de la demande d'information ou question",
        },
      },
      required: ['callerName'],
    },
  },
];

function buildSystemPrompt(sector: string): string {
  const commonRules = `
RÈGLES DE RAISONNEMENT & COMPORTEMENT (REASONING EFFORT: MEDIUM) :
- Modèle : GPT-5.6 Terra. Voix : Marin.
- Analyse posément chaque demande avant de répondre. Valide la cohérence logique des dates, créneaux horaires, adresses et urgences avant toute action.
- Tu t'exprimes au téléphone : fais des phrases courtes, claires et vivantes (1 à 2 phrases par réplique).
- Ne fais JAMAIS de listes à puces ou d'énumérations longues à l'oral.
- Ton ton est chaleureux, poli, rassurant et très professionnel.
- Dès qu'une action concrète est validée (réservation, envoi de devis, alerte d'urgence), utilise immédiatement l'outil dédié correspondant pour l'exécuter.
`;

  switch (sector) {
    case 'sante':
      return `Tu es l'assistante téléphonique IA d'un Cabinet Médical & Soins Infirmiers à Domicile propulsé par VoxFlow AI.
Ton rôle est d'accueillir les patients avec douceur et bienveillance pendant que les soignants sont en tournée de soins.

OBJECTIFS DU SCÉNARIO SANTÉ :
1. Saluer chaleureusement le patient et lui demander comment tu peux l'aider.
2. S'il s'agit d'une demande de soins ou d'un pansement post-opératoire :
   - Demander son nom et prénom.
   - Demander s'il dispose d'une prescription ou ordonnance médicale pour les soins.
   - Demander son adresse ou code postal pour la tournée de soins à domicile.
   - Proposer un créneau adapté (les tournées se font principalement le matin entre 07h30 et 11h30).
3. Si le patient décrit une détresse vitale aiguë (difficulté respiratoire sévère, douleur thoracique violente, hémorragie massive), conseille immédiatement avec calme d'appeler le 15 (SAMU) et déclenche l'outil "trigger_urgent_alert".
4. Dès que la demande est claire et que l'horaire est convenu, appelle obligatoirement la fonction "book_appointment" pour enregistrer le rendez-vous.
5. Rassure le patient en lui confirmant qu'un SMS récapitulatif lui est transmis instantanément avec les coordonnées du soignant de garde.
${commonRules}`;

    case 'btp':
      return `Tu es l'assistante téléphonique IA d'une entreprise générale de BTP & Rénovation du Bâtiment propulsée par VoxFlow AI.
Ton rôle est d'accueillir les clients et prospects pendant que les artisans et chefs de chantier sont en intervention.

OBJECTIFS DU SCÉNARIO BTP :
1. Saluer le client avec énergie et professionnalisme.
2. Qualifier le projet de travaux :
   - S'agit-il d'une urgence (fuite, panne) ou d'un projet de travaux planifié ?
   - Quel est le type de rénovation (salle de bain, toiture, plomberie, électricité, isolation) et la surface approximative ?
   - Dans quelle ville ou code postal se situe le chantier ?
3. Dès que le projet est précisé, explique que pour lui faire gagner du temps sans attendre le soir, tu lui envoies immédiatement par SMS un lien sécurisé permettant de déposer photos et plans en 1 minute.
4. Appelle obligatoirement la fonction "send_quote_sms" avec son nom et la nature du projet.
5. Confirme que le dossier est directement transmis au métreur ou conducteur de travaux pour chiffrage.
${commonRules}`;

    case 'voxflow':
    default:
      return `Tu es VoxFlow AI, le standard téléphonique autonome et assistant d'accueil intelligent 24/7.
Tu es en démonstration vocale directe sur la page d'accueil de notre site web (https://voxflow.ai).

TON RÔLE :
- Tu démontres en direct ta réactivité, ton naturel et ta compréhension instantanée.
- Décroche immédiatement et salue l'utilisateur : invite-le à tester une situation réelle (par exemple : "Bonjour et bienvenue sur le standard VoxFlow AI ! Vous pouvez tester notre accueil téléphonique en direct. Souhaitez-vous simuler une prise de rendez-vous médical, une demande de devis travaux, ou me poser une question sur notre solution ?")
- Si l'utilisateur pose des questions sur VoxFlow AI :
  * Décrochage en moins d'une seconde, 24h/24 et 7j/7 sans jamais laisser un appel sans réponse.
  * Synchronisation en temps réel avec les agendas professionnels (Google Calendar, Doctolib, Outlook).
  * Envoi automatique de SMS (confirmations, liens devis avec photos, alertes urgentes).
  * Conforme RGPD avec serveurs sécurisés en France.
  * Mise en place en moins de 24h par simple transfert d'appel, sans changer de numéro.
- Si l'utilisateur simule une prise de RDV, utilise "book_appointment".
- S'il simule un devis travaux, utilise "send_quote_sms".
- S'il souhaite être recontacté ou demander un audit de son standard, utilise "request_human_callback".
${commonRules}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sector = body.sector || 'voxflow';
    const voice = body.voice || 'marin';
    const validRealtimeModels = ['gpt-realtime-2.1-mini', 'gpt-realtime-mini', 'gpt-realtime', 'gpt-realtime-1.5'];
    const model = validRealtimeModels.includes(body.model) ? body.model : 'gpt-realtime-2.1-mini';

    // Strictly use OPENAI_API_KEY from environment
    const apiKey = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;

    if (!apiKey || apiKey.startsWith('sk-mock')) {
      return NextResponse.json(
        {
          error: 'CONFIG_ERROR',
          message: 'Clé OpenAI non configurée sur le serveur.',
          fallbackAvailable: true,
        },
        { status: 500 }
      );
    }

    const instructions = buildSystemPrompt(sector);

    // Call OpenAI Realtime General Availability endpoint: POST /v1/realtime/client_secrets
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model,
          instructions,
          tools: REALTIME_TOOLS,
          tool_choice: 'auto',
          audio: {
            input: {
              transcription: {
                model: 'whisper-1',
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 350,
                create_response: true,
                interrupt_response: true,
              },
            },
            output: {
              voice,
            },
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const isQuotaError =
        data?.error?.code === 'insufficient_quota' ||
        data?.error?.code === 'credit_balance_exhausted' ||
        response.status === 429;

      return NextResponse.json(
        {
          error: isQuotaError ? 'QUOTA_EXHAUSTED' : 'OPENAI_ERROR',
          message:
            data?.error?.message ||
            'Impossible de créer la session vocale en direct avec OpenAI.',
          status: response.status,
          fallbackAvailable: true,
        },
        { status: response.status }
      );
    }

    // Success: Return ephemeral client secret and config
    return NextResponse.json({
      success: true,
      clientSecret: data.value,
      expiresAt: data.expires_at,
      sessionId: data.session?.id,
      model: data.session?.model || model,
      voice: 'marin',
      reasoningEffort: 'medium',
      sector,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: error?.message || 'Erreur interne lors de la création de la session vocale',
        fallbackAvailable: true,
      },
      { status: 500 }
    );
  }
}
