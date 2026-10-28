'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PlanConfig, STRIPE_PLANS } from '@/lib/stripe/plans';

interface PricingTableProps {
  initialPlans?: Record<string, PlanConfig>;
}

export default function PricingTable({ initialPlans }: PricingTableProps) {
  const [annualBilling, setAnnualBilling] = useState(true);
  const [plansData, setPlansData] = useState<Record<string, PlanConfig>>(initialPlans || STRIPE_PLANS);

  useEffect(() => {
    // Refresh plans dynamically in case admin changed prices recently
    fetch('/api/plans')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.plans) {
          setPlansData(data.plans);
        }
      })
      .catch(() => {});
  }, []);

  const starterPlan = plansData.starter || STRIPE_PLANS.starter;
  const proPlan = plansData.pro || STRIPE_PLANS.pro;
  const enterprisePlan = plansData.enterprise || STRIPE_PLANS.enterprise;

  const plans = [
    {
      id: 'starter',
      name: starterPlan.name,
      tagline: starterPlan.tagline,
      monthlyPrice: starterPlan.monthlyPrice,
      annualPrice: starterPlan.annualMonthlyPrice,
      minutes: `${starterPlan.minutesIncluded} min / mois`,
      extraMinute: starterPlan.extraMinuteRate,
      popular: false,
      features: starterPlan.features,
      ctaText: 'Choisir la formule Starter',
      ctaHref: '/checkout?plan=starter',
    },
    {
      id: 'pro',
      name: proPlan.name,
      tagline: proPlan.tagline,
      monthlyPrice: proPlan.monthlyPrice,
      annualPrice: proPlan.annualMonthlyPrice,
      minutes: `${proPlan.minutesIncluded} min / mois`,
      extraMinute: proPlan.extraMinuteRate,
      popular: true,
      badge: 'Le Plus Choisi',
      features: proPlan.features,
      ctaText: 'Choisir la Formule Pro ➔',
      ctaHref: '/checkout?plan=pro',
    },
    {
      id: 'enterprise',
      name: enterprisePlan.name,
      tagline: enterprisePlan.tagline,
      monthlyPrice: enterprisePlan.monthlyPrice,
      annualPrice: enterprisePlan.annualMonthlyPrice,
      minutes: `${enterprisePlan.minutesIncluded} min / mois`,
      extraMinute: enterprisePlan.extraMinuteRate,
      popular: false,
      features: enterprisePlan.features,
      ctaText: 'Choisir la Formule Entreprise',
      ctaHref: '/checkout?plan=enterprise',
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
                  href={`/checkout?plan=${plan.id}&interval=${annualBilling ? 'annual' : 'monthly'}`}
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

      {/* Stripe Trust & Payment Badges Bar */}
      <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center text-lg font-black">
            🔒
          </div>
          <div>
            <h5 className="font-extrabold text-slate-900 text-xs">Paiement & Facturation Sécurisés Stripe</h5>
            <p className="text-[11px] text-slate-500">Chiffrement SSL 256 bits & authentification 3D Secure 2.0</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 font-bold text-2xs shadow-2xs">
            💳 Carte Bancaire
          </span>
          <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 font-bold text-2xs shadow-2xs">
            Visa
          </span>
          <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 font-bold text-2xs shadow-2xs">
            Mastercard
          </span>
          <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 font-bold text-2xs shadow-2xs">
            Apple Pay
          </span>
          <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 font-bold text-2xs shadow-2xs">
            Google Pay
          </span>
        </div>

        <div className="text-right text-[11px] text-slate-500">
          <span className="font-semibold text-emerald-700">✓ 14 jours satisfait ou remboursé</span>
          <span className="block text-slate-400">Résiliation libre en 1 clic</span>
        </div>
      </div>
    </div>
  );
}
