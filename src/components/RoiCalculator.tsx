'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RoiCalculator() {
  const [callsPerMonth, setCallsPerMonth] = useState<number>(350);
  const [missedRate, setMissedRate] = useState<number>(25);
  const [dealValue, setDealValue] = useState<number>(250);
  const [conversionRate, setConversionRate] = useState<number>(35);

  // Calculations
  const missedCallsPerMonth = Math.round(callsPerMonth * (missedRate / 100));
  const recoveredClientsPerMonth = Math.round(missedCallsPerMonth * (conversionRate / 100));
  const recoveredRevenueMonthly = Math.round(recoveredClientsPerMonth * dealValue);
  const recoveredRevenueYearly = recoveredRevenueMonthly * 12;
  const hoursSavedPerMonth = Math.round((callsPerMonth * 4.5) / 60);

  // Estimated platform subscription
  const estimatedCost = 189; // Monthly Pro plan
  const netMonthlyProfit = Math.max(0, recoveredRevenueMonthly - estimatedCost);
  const calculatedRoi = Math.round((netMonthlyProfit / estimatedCost) * 100);

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-200/50 text-slate-900">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left: Interactive Input Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              Calculateur d&apos;Impact Financier
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Combien de chiffre d&apos;affaires perdez-vous chaque mois sur répondeur ?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Ajustez les curseurs selon votre activité pour estimer le retour sur investissement instantané d&apos;un agent téléphonique dédié.
            </p>
          </div>

          <div className="space-y-4 pt-1">
            {/* Slider 1: Calls per month */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">Appels entrants mensuels</span>
                <span className="font-bold text-amber-700 text-sm">{callsPerMonth} appels</span>
              </div>
              <input
                type="range"
                min="50"
                max="2500"
                step="25"
                value={callsPerMonth}
                onChange={(e) => setCallsPerMonth(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>50 (Indépendant)</span>
                <span>1 000 (Cabinet)</span>
                <span>2 500+ (PME)</span>
              </div>
            </div>

            {/* Slider 2: Missed call percentage */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">Taux d&apos;appels manqués / non-décrochés</span>
                <span className="font-bold text-rose-700 text-sm">{missedRate}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={missedRate}
                onChange={(e) => setMissedRate(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
              />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>10% (Optimal)</span>
                <span>Moyenne nationale : ~28%</span>
                <span>60% (Surchargé)</span>
              </div>
            </div>

            {/* Slider 3: Average deal / consultation value */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">Valeur moyenne d&apos;un client ou chantier</span>
                <span className="font-bold text-emerald-700 text-sm">{dealValue} €</span>
              </div>
              <input
                type="range"
                min="40"
                max="2000"
                step="20"
                value={dealValue}
                onChange={(e) => setDealValue(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>50 € (Soin/Consultation)</span>
                <span>350 € (Dépannage)</span>
                <span>1 500 €+ (Rénovation/Conseil)</span>
              </div>
            </div>

            {/* Slider 4: Conversion rate */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">Taux de conversion estimé en RDV ou devis</span>
                <span className="font-bold text-blue-700 text-sm">{conversionRate}%</span>
              </div>
              <input
                type="range"
                min="15"
                max="75"
                step="5"
                value={conversionRate}
                onChange={(e) => setConversionRate(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>15% (Prudent)</span>
                <span>35% (Moyenne constatée)</span>
                <span>75% (Haut de gamme)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Revenue Recovery Result Card (5 cols) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-slate-50 border border-amber-300 rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
          <div className="border-b border-amber-200/80 pb-4">
            <span className="text-xs uppercase font-bold tracking-wider text-amber-900">
              Revenus Récupérés Estimés
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black text-amber-600">
                +{recoveredRevenueMonthly.toLocaleString('fr-FR')} €
              </span>
              <span className="text-xs text-slate-600 font-semibold">/ mois</span>
            </div>
            <p className="text-xs text-emerald-700 font-bold mt-1">
              Soit +{recoveredRevenueYearly.toLocaleString('fr-FR')} € de chiffre d&apos;affaires récupéré par an
            </p>
          </div>

          {/* Detailed Metric Cards */}
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Clients / Devis Sauvés
              </span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">
                {recoveredClientsPerMonth} / mois
              </span>
              <span className="text-[11px] text-slate-400">sur {missedCallsPerMonth} manqués</span>
            </div>

            <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Temps Préservé
              </span>
              <span className="text-xl font-black text-amber-600 mt-0.5 block">
                ~{hoursSavedPerMonth}h / mois
              </span>
              <span className="text-[11px] text-slate-400">au standard</span>
            </div>
          </div>

          {/* ROI Metric Badge */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-800 block">
                Retour sur Investissement (ROI)
              </span>
              <span className="text-[11px] text-emerald-700">
                Pour un forfait Pro estimé à {estimatedCost} €/mois
              </span>
            </div>
            <span className="text-2xl font-black text-emerald-700">
              +{calculatedRoi}%
            </span>
          </div>

          {/* CTA */}
          <div className="pt-1">
            <Link
              href="/contact"
              className="w-full block text-center py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-amber-500/20 hover:-translate-y-0.5"
            >
              Demander mon Audit Téléphonique ➔
            </Link>
            <p className="text-[11px] text-center text-slate-500 mt-2">
              Sans engagement • Configuration rapide sur votre numéro
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
