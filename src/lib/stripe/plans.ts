export type BillingInterval = 'monthly' | 'annual';

export interface PlanConfig {
  id: 'starter' | 'pro' | 'enterprise';
  name: string;
  tagline: string;
  popular?: boolean;
  monthlyPrice: number; // in EUR
  annualMonthlyPrice: number; // in EUR per month when paid annually
  annualBilledTotal: number; // in EUR total for the year
  minutesIncluded: number;
  simultaneousLines: number | 'Illimité';
  extraMinuteRate: string;
  stripePriceEnvKey: {
    monthly: 'STRIPE_PRICE_STARTER_MONTHLY' | 'STRIPE_PRICE_PRO_MONTHLY' | 'STRIPE_PRICE_ENTERPRISE_MONTHLY';
    annual: 'STRIPE_PRICE_STARTER_ANNUAL' | 'STRIPE_PRICE_PRO_ANNUAL' | 'STRIPE_PRICE_ENTERPRISE_ANNUAL';
  };
  features: string[];
  recommendedFor: string;
}

export const STRIPE_PLANS: Record<string, PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter / Artisan',
    tagline: 'Pour les professionnels libéraux, artisans et activités en solo.',
    monthlyPrice: 79,
    annualMonthlyPrice: 63,
    annualBilledTotal: 756,
    minutesIncluded: 200,
    simultaneousLines: 1,
    extraMinuteRate: '0,18 € / min',
    stripePriceEnvKey: {
      monthly: 'STRIPE_PRICE_STARTER_MONTHLY',
      annual: 'STRIPE_PRICE_STARTER_ANNUAL',
    },
    features: [
      '1 ligne téléphonique dédiée ou renvoi transparent de votre numéro',
      '200 minutes de communication incluses chaque mois',
      'Accueil téléphonique 24h/24 et 7j/7 sans interruption',
      'Voix française naturelle et chaleureuse',
      'Prise de coordonnées & synthèse par email immédiat',
      'Envoi automatique de SMS de confirmation au correspondant',
      'Assistance & paramétrage initial inclus',
    ],
    recommendedFor: 'Artisans du BTP, cabinets infirmiers solo, consultants indépendants.',
  },
  pro: {
    id: 'pro',
    name: 'Pro / Cabinet',
    tagline: 'Pour les cabinets médicaux, PME et structures à fort volume d’appels.',
    popular: true,
    monthlyPrice: 189,
    annualMonthlyPrice: 149,
    annualBilledTotal: 1788,
    minutesIncluded: 650,
    simultaneousLines: 3,
    extraMinuteRate: '0,14 € / min',
    stripePriceEnvKey: {
      monthly: 'STRIPE_PRICE_PRO_MONTHLY',
      annual: 'STRIPE_PRICE_PRO_ANNUAL',
    },
    features: [
      'Jusqu’à 3 appels reçus en simultané sans encombrement',
      '650 minutes d’appels incluses chaque mois',
      'Synchronisation directe avec vos agendas habituels (Google, Outlook, Doctolib)',
      'Gestion automatique des créneaux et des indisponibilités',
      'Envoi instantané d’un portail de devis par SMS au client',
      'Détection des urgences & transfert prioritaire sur votre mobile',
      'Reconnaissance automatique de vos clients prioritaires',
      'Tableau de bord de suivi des rendez-vous et appels',
      'Support prioritaire 7j/7 (< 2h de temps de réponse)',
    ],
    recommendedFor: 'Cabinets médicaux de groupe, artisans avec équipe, agences immobilières.',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Entreprise & Réseau',
    tagline: 'Pour les réseaux multi-agences, cliniques et structures d’envergure.',
    monthlyPrice: 489,
    annualMonthlyPrice: 389,
    annualBilledTotal: 4668,
    minutesIncluded: 2000,
    simultaneousLines: 'Illimité',
    extraMinuteRate: '0,10 € / min',
    stripePriceEnvKey: {
      monthly: 'STRIPE_PRICE_ENTERPRISE_MONTHLY',
      annual: 'STRIPE_PRICE_ENTERPRISE_ANNUAL',
    },
    features: [
      'Lignes simultanées illimitées & gestion multi-établissements',
      'Volume de 2 000+ minutes modulables sur-mesure',
      'Scénarios d’accueil 100% personnalisés selon vos process métier',
      'Connexion directe à votre logiciel métier ou CRM existant',
      'Transfers conditionnels vers plusieurs équipes et astreintes',
      'Disponibilité contractuelle garantie 99,98% (SLA)',
      'Hébergement dédié et conformité stricte des données',
      'Interlocuteur dédié et formation de votre équipe',
    ],
    recommendedFor: 'Cliniques, centres de formation, syndics, réseaux de franchises.',
  },
};

/**
 * Pure price overrides interface safe for both Client and Server environments.
 */
export interface PlanPriceOverrides {
  starterMonthlyPrice?: number;
  starterAnnualPrice?: number;
  starterMinutes?: number;
  proMonthlyPrice?: number;
  proAnnualPrice?: number;
  proMinutes?: number;
  enterpriseMonthlyPrice?: number;
  enterpriseAnnualPrice?: number;
  enterpriseMinutes?: number;
}

/**
 * Pure builder function returning plans with price and quota overrides.
 * 100% Client-safe (no Node.js fs, dotenv or child_process dependencies).
 */
export function createDynamicPlans(overrides?: Partial<PlanPriceOverrides>): Record<string, PlanConfig> {
  const starterM = Number(overrides?.starterMonthlyPrice) || 79;
  const starterA = Number(overrides?.starterAnnualPrice) || 63;
  const starterMin = Number(overrides?.starterMinutes) || 200;

  const proM = Number(overrides?.proMonthlyPrice) || 189;
  const proA = Number(overrides?.proAnnualPrice) || 149;
  const proMin = Number(overrides?.proMinutes) || 650;

  const entM = Number(overrides?.enterpriseMonthlyPrice) || 489;
  const entA = Number(overrides?.enterpriseAnnualPrice) || 389;
  const entMin = Number(overrides?.enterpriseMinutes) || 2000;

  return {
    starter: {
      ...STRIPE_PLANS.starter,
      monthlyPrice: starterM,
      annualMonthlyPrice: starterA,
      annualBilledTotal: starterA * 12,
      minutesIncluded: starterMin,
    },
    pro: {
      ...STRIPE_PLANS.pro,
      monthlyPrice: proM,
      annualMonthlyPrice: proA,
      annualBilledTotal: proA * 12,
      minutesIncluded: proMin,
    },
    enterprise: {
      ...STRIPE_PLANS.enterprise,
      monthlyPrice: entM,
      annualMonthlyPrice: entA,
      annualBilledTotal: entA * 12,
      minutesIncluded: entMin,
    },
  };
}

export function getPlan(planId: string, overrides?: Partial<PlanPriceOverrides>): PlanConfig {
  const plans = createDynamicPlans(overrides);
  return plans[planId] || plans.pro;
}

