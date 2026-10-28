'use client';

import { useState } from 'react';
import Link from 'next/link';

interface BillingTabProps {
  userRole?: string;
  assignedBusiness?: string;
}

export default function BillingTab({ userRole, assignedBusiness }: BillingTabProps) {
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [portalMessage, setPortalMessage] = useState<string | null>(null);

  const handleOpenPortal = async () => {
    setLoadingPortal(true);
    setPortalMessage(null);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setPortalMessage(data.message || 'Impossible d’accéder au portail Stripe.');
      }
    } catch {
      setPortalMessage('Erreur lors de la redirection vers le portail client.');
    } finally {
      setLoadingPortal(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>💳</span>
            <span>Abonnement & Facturation Stripe</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gérez votre abonnement, vos moyens de paiement et vos factures en toute sécurité.
          </p>
        </div>

        <button
          onClick={handleOpenPortal}
          disabled={loadingPortal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-60"
        >
          {loadingPortal ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>Chargement du portail...</span>
            </>
          ) : (
            <>
              <span>Portail Client Stripe</span>
              <span>➔</span>
            </>
          )}
        </button>
      </div>

      {portalMessage && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          {portalMessage}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Current Active Plan */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Formule Active
            </span>
            <span className="text-xs text-slate-400 font-mono">Facturé par Stripe</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-slate-100 pb-5">
            <div>
              <h3 className="text-2xl font-black text-slate-900">Formule Pro / Cabinet</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Standard Téléphonique Intelligent &bull; 650 min / mois incluses
              </p>
            </div>
            <div className="sm:text-right">
              <span className="text-2xl font-black text-slate-900">149 €</span>
              <span className="text-xs text-slate-500"> HT / mois (Annuel)</span>
            </div>
          </div>

          {/* Quota Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700">Consommation du mois en cours :</span>
              <span className="font-bold text-slate-900">148 min / 650 min (23%)</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full"
                style={{ width: '23%' }}
              ></div>
            </div>
            <p className="text-2xs text-slate-400">
              Minutes supplémentaires facturées automatiquement au tarif préférentiel de 0,14 € / min.
            </p>
          </div>

          {/* Quick Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
              <span className="text-2xs text-slate-400 block font-bold uppercase">Prochain renouvellement</span>
              <span className="font-bold text-slate-800">1er du mois prochain</span>
              <span className="text-2xs text-slate-400 block">Renouvellement automatique</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
              <span className="text-2xs text-slate-400 block font-bold uppercase">Moyen de paiement</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span>💳</span>
                <span>Carte bancaire enregistrée</span>
              </span>
              <span className="text-2xs text-emerald-600 font-semibold block">Actif & vérifié</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition-all"
            >
              Changer de formule ➔
            </Link>
            <button
              onClick={handleOpenPortal}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors cursor-pointer"
            >
              Mettre à jour ma carte bancaire
            </button>
          </div>
        </div>

        {/* Card 2: Security & Invoices */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-4">
            <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <span>🔒</span>
              <span>Sécurité Bancaire Stripe</span>
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Vos paiements sont traités par Stripe, leader mondial du paiement en ligne. VoxFlow AI n&apos;a jamais accès à vos numéros de carte bancaire.
            </p>
            <ul className="text-2xs text-slate-600 space-y-2 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Chiffrement SSL 256 bits</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Authentification forte 3D Secure 2.0</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Factures certifiées avec TVA téléchargeables</span>
              </li>
            </ul>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 space-y-3">
            <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
              <span>📄</span>
              <span>Téléchargement des factures</span>
            </h4>
            <p className="text-2xs text-slate-500 leading-relaxed">
              Toutes vos factures acquittées avec mention de TVA française sont conservées et accessibles sur le portail client Stripe.
            </p>
            <button
              onClick={handleOpenPortal}
              className="w-full text-center py-2 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Consulter l&apos;historique des factures ➔
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
