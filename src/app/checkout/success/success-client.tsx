'use client';

import Link from 'next/link';
import { STRIPE_PLANS, BillingInterval } from '@/lib/stripe/plans';

interface SuccessClientProps {
  sessionId?: string;
  planId?: string;
  interval?: BillingInterval;
  email?: string;
}

export default function SuccessClient({
  sessionId = 'cs_sample_123',
  planId = 'pro',
  interval = 'annual',
  email = '',
}: SuccessClientProps) {
  const plan = STRIPE_PLANS[planId] || STRIPE_PLANS.pro;
  const orderRef = `VF-${new Date().getFullYear()}-${sessionId.slice(-6).toUpperCase()}`;

  const billedAmount = interval === 'annual' ? plan.annualBilledTotal : plan.monthlyPrice;
  const tva = Math.round(billedAmount * 0.2 * 100) / 100;
  const totalTtc = (billedAmount + tva).toFixed(2);

  return (
    <div className="max-w-2xl mx-auto w-full space-y-8">
      {/* Celebration Header */}
      <div className="text-center space-y-4">
        <div className="relative inline-flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-200/80 text-emerald-600 flex items-center justify-center text-3xl shadow-xl shadow-emerald-500/20 animate-bounce">
            ✓
          </div>
          <div className="absolute -inset-2 rounded-full border border-emerald-400/40 animate-ping pointer-events-none"></div>
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span>🎉</span>
            <span>Paiement Validé & Abonnement Actif</span>
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Bienvenue chez VoxFlow AI !
          </h1>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            Votre souscription à la formule <strong>{plan.name}</strong> a été enregistrée avec succès. Votre standard téléphonique intelligent est prêt pour la mise en service.
          </p>
        </div>
      </div>

      {/* Order Confirmation Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
              Référence de commande Stripe
            </span>
            <span className="font-mono font-bold text-slate-900 text-sm">{orderRef}</span>
          </div>
          <div className="sm:text-right">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
              Date & Statut
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Paiement Confirmé
            </span>
          </div>
        </div>

        {/* Breakdown Items */}
        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600">Formule souscrite :</span>
            <span className="font-bold text-slate-900">{plan.name} ({interval === 'annual' ? 'Annuel' : 'Mensuel'})</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600">Volume mensuel inclus :</span>
            <span className="font-semibold text-slate-800">{plan.minutesIncluded} minutes / mois</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600">Lignes d&apos;accueil simultanées :</span>
            <span className="font-semibold text-slate-800">{plan.simultaneousLines} ligne(s) sans attente</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600">Email de facturation :</span>
            <span className="font-mono text-slate-800">{email || 'Transmis lors du paiement'}</span>
          </div>

          <div className="flex justify-between items-baseline pt-2">
            <span className="font-bold text-sm text-slate-900">Montant total réglé :</span>
            <span className="text-2xl font-black text-slate-900">{totalTtc} € TTC</span>
          </div>
        </div>

        <p className="text-2xs text-slate-400 text-center">
          Un reçu de paiement certifié et une confirmation ont été envoyés à votre adresse email.
        </p>
      </div>

      {/* Onboarding Next Steps */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-4">
        <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
          <span>🚀</span>
          <span>Prochaines étapes pour démarrer vos appels :</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-2">
            <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-black flex items-center justify-center text-xs">
              1
            </div>
            <h4 className="font-bold text-slate-900">Accédez à votre espace</h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Connectez-vous à votre tableau de bord pour personnaliser le nom de votre assistant et vos horaires.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-2">
            <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-black flex items-center justify-center text-xs">
              2
            </div>
            <h4 className="font-bold text-slate-900">Synchronisez vos agendas</h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Connectez votre calendrier (Google, Outlook ou Doctolib) pour bloquer automatiquement les rendez-vous pris.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-2">
            <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-black flex items-center justify-center text-xs">
              3
            </div>
            <h4 className="font-bold text-slate-900">Transférez vos appels</h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Activez le transfert d&apos;appel depuis votre ligne actuelle ou utilisez votre numéro dédié.
            </p>
          </div>
        </div>
      </div>

      {/* Call to Action Buttons */}
      <div className="space-y-3 pt-2 text-center">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-amber-500/25 transition-all"
        >
          Accéder à mon Tableau de Bord ➔
        </Link>
        <div>
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Revenir au site public
          </Link>
        </div>
      </div>
    </div>
  );
}
