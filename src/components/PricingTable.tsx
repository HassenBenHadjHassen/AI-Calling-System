'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PricingTable() {
  const [annualBilling, setAnnualBilling] = useState(true);

  const plans = [
    {
      name: 'Starter / Artisan',
      tagline: 'Pour les indépendants, artisans solos et professionnels libéraux.',
      monthlyPrice: 79,
      annualPrice: 63,
      minutes: '200 min / mois',
      extraMinute: '0,18 € / min',
      popular: false,
      features: [
        '1 ligne téléphonique dédiée ou renvoi de votre numéro actuel',
        '200 minutes d’appels incluses chaque mois',
        'Accueil téléphonique 24h/24 et 7j/7 sans interruption',
        'Voix française chaleureuse et naturelle',
        'Prise de coordonnées & synthèse par email',
        'Envoi automatique de SMS de confirmation',
        'Assistance et mise en service incluses',
      ],
      ctaText: 'Choisir la formule Starter',
      ctaHref: '/contact?plan=starter',
    },
    {
      name: 'Pro / Cabinet',
      tagline: 'Idéal pour cabinets médicaux, PME et entreprises du bâtiment.',
      monthlyPrice: 189,
      annualPrice: 149,
      minutes: '650 min / mois',
      extraMinute: '0,14 € / min',
      popular: true,
      badge: 'Le Plus Choisi',
      features: [
        'Jusqu’à 3 lignes d’appels simultanées',
        '650 minutes d’appels incluses chaque mois',
        'Synchronisation directe avec vos agendas (Google, Outlook, Doctolib)',
        'Gestion automatique des créneaux et des indisponibilités',
        'Envoi instantané d’un portail de devis par SMS au client',
        'Détection des urgences & transfert prioritaire sur votre portable',
        'Reconnaissance automatique de vos clients prioritaires',
        'Tableau de bord de suivi des rendez-vous et appels',
        'Support prioritaire 7j/7',
      ],
      ctaText: 'Choisir la Formule Pro ➔',
      ctaHref: '/contact?plan=pro',
    },
    {
      name: 'Entreprise & Réseau',
      tagline: 'Pour les réseaux multi-agences, cliniques et structures d’envergure.',
      monthlyPrice: 489,
      annualPrice: 389,
      minutes: '2 000+ min / mois',
      extraMinute: '0,10 € / min',
      popular: false,
      features: [
        'Lignes simultanées illimitées & multi-établissements',
        'Volume de minutes sur-mesure ou illimité',
        'Scénarios d’accueil 100% personnalisés selon vos processus',
        'Connexion directe à votre logiciel métier ou CRM existant',
        'Transferts conditionnels vers plusieurs équipes et astreintes',
        'Disponibilité contractuelle garantie 99,98%',
        'Hébergement dédié et conformité stricte des données',
        'Interlocuteur dédié et formation de votre équipe',
      ],
      ctaText: 'Demander une Étude Entreprise',
      ctaHref: '/contact?plan=entreprise',
    },
  ];

  return (
    <div className="w-full space-y-10">
      {/* Billing toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <div className="flex items-center bg-slate-100 border border-slate-200 p-1 rounded-full shadow-2xs">
          <button
            onClick={() => setAnnualBilling(false)}
            className={`px-5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              !annualBilling
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Facturation Mensuelle
          </button>
          <button
            onClick={() => setAnnualBilling(true)}
            className={`px-5 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
              annualBilling
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Facturation Annuelle</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
              -20%
            </span>
          </button>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          🎉 2 mois offerts avec l’engagement annuel
        </span>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {plans.map((plan) => {
          const price = annualBilling ? plan.annualPrice : plan.monthlyPrice;

          return (
            <div
              key={plan.name}
              className={`relative rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-200 ${
                plan.popular
                  ? 'bg-white border-2 border-amber-500 shadow-xl shadow-amber-500/10 md:-translate-y-2 ring-1 ring-amber-500/20'
                  : 'bg-white border border-slate-200/90 hover:border-slate-300 shadow-md shadow-slate-200/50'
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-xs uppercase tracking-wider shadow-sm">
                  {plan.badge}
                </div>
              )}

              {/* Header */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-xl font-black text-slate-900">{plan.name}</h4>
                  <p className="text-xs text-slate-500 mt-1 min-h-[36px]">
                    {plan.tagline}
                  </p>
                </div>

                {/* Price block */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                      {price} €
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">/ mois</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>{plan.minutes}</span>
                    <span className="text-slate-400">Hors quota : {plan.extraMinute}</span>
                  </div>
                </div>

                {/* Features List */}
                <div className="pt-6 border-t border-slate-100 space-y-3">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Inclus dans cette formule :
                  </span>
                  <ul className="space-y-2.5 text-xs text-slate-600">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="text-emerald-600 font-bold flex-shrink-0 mt-0.5">✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-8">
                <Link
                  href={plan.ctaHref}
                  className={`w-full block text-center py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20 hover:-translate-y-0.5'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                  }`}
                >
                  {plan.ctaText}
                </Link>
                <p className="text-[10px] text-center text-slate-400 mt-2">
                  Essai sans engagement • Zéro frais de mise en service
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
