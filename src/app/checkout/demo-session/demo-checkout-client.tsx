'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { STRIPE_PLANS, BillingInterval } from '@/lib/stripe/plans';
import Link from 'next/link';

interface DemoCheckoutClientProps {
  sessionId: string;
  planId: string;
  interval: BillingInterval;
  email?: string;
  company?: string;
}

export default function DemoCheckoutClient({
  sessionId,
  planId,
  interval,
  email,
  company,
}: DemoCheckoutClientProps) {
  const router = useRouter();
  const plan = STRIPE_PLANS[planId] || STRIPE_PLANS.pro;

  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [expiry, setExpiry] = useState('12 / 28');
  const [cvc, setCvc] = useState('123');
  const [cardHolder, setCardHolder] = useState(company || 'Dr. Martin Renaud');
  const [isProcessing, setIsProcessing] = useState(false);

  const billedAmount = interval === 'annual' ? plan.annualBilledTotal : plan.monthlyPrice;
  const tva = Math.round(billedAmount * 0.2 * 100) / 100;
  const totalTtc = (billedAmount + tva).toFixed(2);

  const handlePay = () => {
    setIsProcessing(true);
    setTimeout(() => {
      router.push(
        `/checkout/success?session_id=${encodeURIComponent(sessionId)}&plan=${encodeURIComponent(plan.id)}&interval=${encodeURIComponent(interval)}&email=${encodeURIComponent(email || '')}&demo=true`
      );
    }, 1200);
  };

  return (
    <div className="max-w-xl mx-auto w-full space-y-6">
      {/* Notice Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs space-y-1.5 shadow-2xs">
        <div className="flex items-center gap-2 font-bold text-amber-800">
          <span className="text-base">ℹ️</span>
          <span>Mode Démonstration Stripe Actif</span>
        </div>
        <p className="leading-relaxed text-amber-800/90">
          Vos clés Stripe (<code className="font-mono bg-amber-100/80 px-1 py-0.5 rounded">STRIPE_SECRET_KEY</code>) ne sont pas encore renseignées dans votre fichier <code className="font-mono bg-amber-100/80 px-1 py-0.5 rounded">.env</code>. Cette page vous permet de tester le flux complet de souscription. Dès que vos clés seront ajoutées, la redirection vers l&apos;interface officielle de Stripe sera 100% automatique.
        </p>
      </div>

      {/* Mock Stripe Checkout Window */}
      <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/60">
        {/* Stripe Simulator Header */}
        <div className="bg-linear-to-r from-slate-900 to-slate-800 text-white p-6 sm:p-7 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎙️</span>
              <span className="font-extrabold tracking-tight text-white text-base">
                VoxFlow AI Technologies
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Abonnement : {plan.name} &bull; {interval === 'annual' ? 'Facturation annuelle' : 'Facturation mensuelle'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-amber-400">{totalTtc} €</div>
            <div className="text-2xs text-slate-400">TVA 20% incluse</div>
          </div>
        </div>

        {/* Card Form */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-3">
            <span className="font-semibold text-slate-700">Paiement par carte bancaire</span>
            <div className="flex items-center gap-1.5 font-mono text-2xs text-slate-400">
              <span>TEST MODE</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Adresse email du titulaire</label>
              <input
                type="email"
                disabled
                value={email || 'contact@votre-entreprise.fr'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Informations de carte</label>
              <div className="border border-slate-300 rounded-xl overflow-hidden focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20">
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="1234 1234 1234 1234"
                  className="w-full px-3.5 py-2.5 text-xs text-slate-900 border-b border-slate-200 focus:outline-none"
                />
                <div className="grid grid-cols-2">
                  <input
                    type="text"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    placeholder="MM / AA"
                    className="px-3.5 py-2.5 text-xs text-slate-900 border-r border-slate-200 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                    placeholder="CVC"
                    className="px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Nom sur la carte</label>
              <input
                type="text"
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value)}
                placeholder="Dr. Martin Renaud"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Quick preset helpers */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-2xs text-slate-500 flex items-center justify-between">
            <span>Carte de test standard Stripe :</span>
            <span className="font-mono font-bold text-slate-700">4242 4242 4242 4242</span>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handlePay}
              disabled={isProcessing}
              className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Validation de la transaction de test...</span>
                </>
              ) : (
                <>
                  <span>Payer {totalTtc} € TTC (Simulation)</span>
                  <span>➔</span>
                </>
              )}
            </button>

            <Link
              href={`/checkout/cancel?plan=${encodeURIComponent(plan.id)}`}
              className="w-full block text-center py-2 text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              Annuler et revenir au choix des formules
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
