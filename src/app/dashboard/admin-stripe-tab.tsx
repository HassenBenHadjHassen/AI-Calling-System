'use client';

import { useState, useEffect } from 'react';

export interface AdminStripeTabProps {
  initialConfig?: {
    starterMonthlyPrice?: number;
    starterAnnualPrice?: number;
    starterMinutes?: number;

    proMonthlyPrice?: number;
    proAnnualPrice?: number;
    proMinutes?: number;

    enterpriseMonthlyPrice?: number;
    enterpriseAnnualPrice?: number;
    enterpriseMinutes?: number;

    lastUpdated?: string;
  };
}

export default function AdminStripeTab({ initialConfig }: AdminStripeTabProps) {
  // Plan Prices in EUR (€ HT) & Quotas set by the Admin
  const [starterMonthlyPrice, setStarterMonthlyPrice] = useState<number>(initialConfig?.starterMonthlyPrice ?? 79);
  const [starterAnnualPrice, setStarterAnnualPrice] = useState<number>(initialConfig?.starterAnnualPrice ?? 63);
  const [starterMinutes, setStarterMinutes] = useState<number>(initialConfig?.starterMinutes ?? 200);

  const [proMonthlyPrice, setProMonthlyPrice] = useState<number>(initialConfig?.proMonthlyPrice ?? 189);
  const [proAnnualPrice, setProAnnualPrice] = useState<number>(initialConfig?.proAnnualPrice ?? 149);
  const [proMinutes, setProMinutes] = useState<number>(initialConfig?.proMinutes ?? 650);

  const [enterpriseMonthlyPrice, setEnterpriseMonthlyPrice] = useState<number>(initialConfig?.enterpriseMonthlyPrice ?? 489);
  const [enterpriseAnnualPrice, setEnterpriseAnnualPrice] = useState<number>(initialConfig?.enterpriseAnnualPrice ?? 389);
  const [enterpriseMinutes, setEnterpriseMinutes] = useState<number>(initialConfig?.enterpriseMinutes ?? 2000);

  const [lastUpdated, setLastUpdated] = useState<string | undefined>(initialConfig?.lastUpdated);

  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load configuration if missing on initial render
  useEffect(() => {
    if (!initialConfig) {
      fetch('/api/admin/stripe-config')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.config) {
            const c = data.config;
            setStarterMonthlyPrice(c.starterMonthlyPrice ?? 79);
            setStarterAnnualPrice(c.starterAnnualPrice ?? 63);
            setStarterMinutes(c.starterMinutes ?? 200);

            setProMonthlyPrice(c.proMonthlyPrice ?? 189);
            setProAnnualPrice(c.proAnnualPrice ?? 149);
            setProMinutes(c.proMinutes ?? 650);

            setEnterpriseMonthlyPrice(c.enterpriseMonthlyPrice ?? 489);
            setEnterpriseAnnualPrice(c.enterpriseAnnualPrice ?? 389);
            setEnterpriseMinutes(c.enterpriseMinutes ?? 2000);

            setLastUpdated(c.lastUpdated);
          }
        })
        .catch(() => {});
    }
  }, [initialConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    setNotification(null);

    try {
      const res = await fetch('/api/admin/stripe-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          starterMonthlyPrice: Number(starterMonthlyPrice) || 0,
          starterAnnualPrice: Number(starterAnnualPrice) || 0,
          starterMinutes: Number(starterMinutes) || 0,

          proMonthlyPrice: Number(proMonthlyPrice) || 0,
          proAnnualPrice: Number(proAnnualPrice) || 0,
          proMinutes: Number(proMinutes) || 0,

          enterpriseMonthlyPrice: Number(enterpriseMonthlyPrice) || 0,
          enterpriseAnnualPrice: Number(enterpriseAnnualPrice) || 0,
          enterpriseMinutes: Number(enterpriseMinutes) || 0,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de l’enregistrement');
      }

      setLastUpdated(data.config?.lastUpdated || new Date().toISOString());
      setNotification({
        type: 'success',
        text: '✅ Nouveaux tarifs enregistrés avec succès ! Le site public et les paiements sont immédiatement synchronisés.',
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        text: err.message || 'Impossible d’enregistrer les tarifs.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-2xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white">
              Panneau Administrateur
            </span>
            <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Gestion des Prix
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>🏷️</span>
            <span>Tarifs &amp; Formules d&apos;Abonnement</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Définissez librement les prix de vente en direct de vos abonnements. Vos modifications mettent automatiquement à jour le site public et le tunnel de paiement.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isSaving ? 'Enregistrement en cours...' : '💾 Enregistrer les Nouveaux Tarifs ➔'}
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm flex items-start gap-3 border shadow-xs transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
              : 'bg-rose-50 text-rose-950 border-rose-300'
          }`}
        >
          <span className="text-base font-bold">{notification.type === 'success' ? '✓' : '⚠️'}</span>
          <div className="flex-1 font-semibold">{notification.text}</div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700 text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3 Pricing Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Starter / Artisan */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-lg">1. Starter / Artisan</h3>
                <p className="text-xs text-slate-400 mt-0.5">Pour artisans solos &amp; praticiens libéraux</p>
              </div>
              <span className="text-2xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Solo
              </span>
            </div>

            <div className="space-y-5 pt-5">
              {/* Monthly Price */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Prix Mensuel (€ HT / mois)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={starterMonthlyPrice}
                    onChange={(e) => setStarterMonthlyPrice(Number(e.target.value) || 0)}
                    className="w-full pl-3.5 pr-16 py-2.5 rounded-xl border border-slate-300 bg-white text-base font-black text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    € HT / m
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Tarif facturé chaque mois sans engagement
                </p>
              </div>

              {/* Annual Price */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Prix Annuel Mensualisé (€ HT / mois)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={starterAnnualPrice}
                    onChange={(e) => setStarterAnnualPrice(Number(e.target.value) || 0)}
                    className="w-full pl-3.5 pr-16 py-2.5 rounded-xl border border-slate-300 bg-white text-base font-black text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    € HT / m
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center justify-between">
                  <span>Facturé {starterAnnualPrice * 12} € HT / an</span>
                  <span className="text-[11px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                    Économie : ~{Math.round(((starterMonthlyPrice - starterAnnualPrice) / (starterMonthlyPrice || 1)) * 100)}%
                  </span>
                </div>
              </div>

              {/* Quota Minutes */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Volume d&apos;appels inclus (minutes / mois)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={starterMinutes}
                    onChange={(e) => setStarterMinutes(Number(e.target.value) || 0)}
                    className="w-full pl-3.5 pr-16 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    minutes
                  </span>
                </div>
              </div>

              {/* Fixed Features Overview */}
              <div className="pt-2 text-2xs text-slate-500 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>1 ligne téléphonique dédiée</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Accueil 24h/24 et 7j/7</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Pro / Cabinet (Highlighted) */}
        <div className="bg-white border-2 border-amber-400/90 rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-sm ring-1 ring-amber-400/20">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-amber-200">
              <div>
                <h3 className="font-black text-slate-900 text-lg flex items-center gap-1.5">
                  <span>2. Pro / Cabinet</span>
                  <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-extrabold uppercase">
                    Populaire
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Cabinets médicaux &amp; PME (3 lignes)</p>
              </div>
              <span className="text-2xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                Cabinet
              </span>
            </div>

            <div className="space-y-5 pt-5">
              {/* Monthly Price */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  Prix Mensuel (€ HT / mois)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={proMonthlyPrice}
                    onChange={(e) => setProMonthlyPrice(Number(e.target.value) || 0)}
                    className="w-full pl-3.5 pr-16 py-2.5 rounded-xl border border-amber-300 bg-white text-base font-black text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-800">
                    € HT / m
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Tarif facturé chaque mois sans engagement
                </p>
              </div>

              {/* Annual Price */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  Prix Annuel Mensualisé (€ HT / mois)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={proAnnualPrice}
                    onChange={(e) => setProAnnualPrice(Number(e.target.value) || 0)}
                    className="w-full pl-3.5 pr-16 py-2.5 rounded-xl border border-amber-300 bg-white text-base font-black text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-800">
                    € HT / m
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 font-semibold flex items-center justify-between">
                  <span>Facturé {proAnnualPrice * 12} € HT / an</span>
                  <span className="text-[11px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                    Économie : ~{Math.round(((proMonthlyPrice - proAnnualPrice) / (proMonthlyPrice || 1)) * 100)}%
                  </span>
                </div>
              </div>

              {/* Quota Minutes */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-slate-800 block">
                  Volume d&apos;appels inclus (minutes / mois)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={proMinutes}
                    onChange={(e) => setProMinutes(Number(e.target.value) || 0)}
                    className="w-full pl-3.5 pr-16 py-2 rounded-xl border border-amber-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-amber-800">
                    minutes
                  </span>
                </div>
              </div>

              {/* Fixed Features Overview */}
              <div className="pt-2 text-2xs text-slate-500 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>3 lignes simultanées sans attente</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Synchronisation agenda Google / Doctolib</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Entreprise & Réseau */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-lg">3. Entreprise &amp; Réseau</h3>
                <p className="text-xs text-slate-400 mt-0.5">Cliniques, réseaux &amp; multi-établissements</p>
              </div>
              <span className="text-2xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                Réseau
              </span>
            </div>

            <div className="space-y-5 pt-5">
              {/* Monthly Price */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Prix Mensuel (€ HT / mois)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={enterpriseMonthlyPrice}
                    onChange={(e) => setEnterpriseMonthlyPrice(Number(e.target.value) || 0)}
                    className="w-full pl-3.5 pr-16 py-2.5 rounded-xl border border-slate-300 bg-white text-base font-black text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    € HT / m
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Tarif facturé chaque mois sans engagement
                </p>
              </div>

              {/* Annual Price */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Prix Annuel Mensualisé (€ HT / mois)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={enterpriseAnnualPrice}
                    onChange={(e) => setEnterpriseAnnualPrice(Number(e.target.value) || 0)}
                    className="w-full pl-3.5 pr-16 py-2.5 rounded-xl border border-slate-300 bg-white text-base font-black text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    € HT / m
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 font-semibold flex items-center justify-between">
                  <span>Facturé {enterpriseAnnualPrice * 12} € HT / an</span>
                  <span className="text-[11px] bg-purple-100 text-purple-950 px-2 py-0.5 rounded-full font-bold">
                    Économie : ~{Math.round(((enterpriseMonthlyPrice - enterpriseAnnualPrice) / (enterpriseMonthlyPrice || 1)) * 100)}%
                  </span>
                </div>
              </div>

              {/* Quota Minutes */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Volume d&apos;appels inclus (minutes / mois)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={enterpriseMinutes}
                    onChange={(e) => setEnterpriseMinutes(Number(e.target.value) || 0)}
                    className="w-full pl-3.5 pr-16 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    minutes
                  </span>
                </div>
              </div>

              {/* Fixed Features Overview */}
              <div className="pt-2 text-2xs text-slate-500 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Lignes simultanées illimitées</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Intégration CRM sur-mesure</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button Footer */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-slate-700 block">
            Synchronisation Immédiate
          </span>
          <p className="text-2xs text-slate-400 mt-0.5">
            Dernière mise à jour : {lastUpdated ? new Date(lastUpdated).toLocaleString('fr-FR') : 'Par défaut (catalogue de base)'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {isSaving ? 'Enregistrement en cours...' : '💾 Enregistrer les Nouveaux Tarifs ➔'}
        </button>
      </div>
    </div>
  );
}
