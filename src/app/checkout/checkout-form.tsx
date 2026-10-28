'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { STRIPE_PLANS, BillingInterval, PlanConfig } from '@/lib/stripe/plans';

interface CheckoutFormProps {
  initialPlanId?: string;
  initialInterval?: string;
  plans?: Record<string, PlanConfig>;
}

export default function CheckoutForm({
  initialPlanId = 'pro',
  initialInterval = 'annual',
  plans: initialPlans,
}: CheckoutFormProps) {
  const router = useRouter();

  const [plans, setPlans] = useState<Record<string, PlanConfig>>(initialPlans || STRIPE_PLANS);

  useEffect(() => {
    fetch('/api/plans')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.plans) {
          setPlans(data.plans);
        }
      })
      .catch(() => {});
  }, []);

  const [selectedPlanId, setSelectedPlanId] = useState<'starter' | 'pro' | 'enterprise'>(
    initialPlanId in plans ? (initialPlanId as any) : 'pro'
  );
  const [interval, setInterval] = useState<BillingInterval>(
    initialInterval === 'monthly' ? 'monthly' : 'annual'
  );

  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const plan: PlanConfig = plans[selectedPlanId] || plans.pro || STRIPE_PLANS.pro;

  // Financial calculations
  const monthlyDisplay = interval === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;
  const billedAmount = interval === 'annual' ? plan.annualBilledTotal : plan.monthlyPrice;
  const tvaAmount = Math.round(billedAmount * 0.2 * 100) / 100;
  const totalTtc = Math.round((billedAmount + tvaAmount) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !email.includes('@')) {
      setErrorMessage('Veuillez renseigner une adresse email valide.');
      return;
    }

    if (!agreeTerms) {
      setErrorMessage('Veuillez accepter les conditions générales de vente pour continuer.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          interval,
          customerEmail: email,
          businessName: businessName || fullName,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.url) {
        throw new Error(data.message || data.error || 'Erreur lors de la redirection Stripe');
      }

      // Redirect user to Stripe hosted checkout or demo session
      window.location.href = data.url;
    } catch (err: any) {
      setErrorMessage(err.message || 'Une erreur inattendue est survenue.');
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Column: Plan Overview & Order Summary */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 uppercase tracking-wider">
              Récapitulatif de votre commande
            </span>
            <span className="text-xs text-slate-500 font-medium">Étape 1/2</span>
          </div>

          {/* Plan Selector Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Formule sélectionnée :
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['starter', 'pro', 'enterprise'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedPlanId(id)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    selectedPlanId === id
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {id === 'starter' ? 'Starter' : id === 'pro' ? 'Pro ⭐' : 'Entreprise'}
                </button>
              ))}
            </div>
          </div>

          {/* Billing Interval Toggle */}
          <div className="p-1 bg-slate-100 rounded-2xl flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setInterval('monthly')}
              className={`flex-1 py-2 font-bold rounded-xl transition-all ${
                interval === 'monthly'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mensuel ({plan.monthlyPrice} €/m)
            </button>
            <button
              type="button"
              onClick={() => setInterval('annual')}
              className={`flex-1 py-2 font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                interval === 'annual'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Annuel</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-black">
                -20%
              </span>
            </button>
          </div>

          {/* Plan Details Card */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">{plan.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{plan.tagline}</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-slate-900">{monthlyDisplay} €</span>
                <span className="text-2xs text-slate-500 block">HT / mois</span>
              </div>
            </div>

            <ul className="pt-3 border-t border-slate-200/80 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span><strong>{plan.minutesIncluded} minutes</strong> d&apos;appels incluses par mois</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span><strong>{plan.simultaneousLines}</strong> ligne(s) simultanée(s) sans attente</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Accueil téléphonique 24h/24 & 7j/7</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Synchronisation agenda & envoi devis par SMS</span>
              </li>
            </ul>
          </div>

          {/* Price Breakdown */}
          <div className="space-y-2.5 pt-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Sous-total HT ({interval === 'annual' ? 'Facturé annuellement' : 'Facturation mensuelle'}) :</span>
              <span className="font-semibold text-slate-900">{billedAmount} €</span>
            </div>
            <div className="flex justify-between">
              <span>TVA (20%) :</span>
              <span className="font-semibold text-slate-900">{tvaAmount.toFixed(2)} €</span>
            </div>
            {interval === 'annual' && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Économie annuelle réalisée :</span>
                <span>-{(plan.monthlyPrice * 12 - plan.annualBilledTotal)} €</span>
              </div>
            )}
            <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
              <span className="font-extrabold text-sm text-slate-900">Total à payer TTC :</span>
              <span className="text-2xl font-black text-slate-900">{totalTtc.toFixed(2)} €</span>
            </div>
            {interval === 'annual' && (
              <p className="text-2xs text-slate-400 text-right">
                Correspond à {plan.annualMonthlyPrice} € HT / mois facturés en un règlement annuel.
              </p>
            )}
          </div>
        </div>

        {/* Guarantees Box */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-emerald-800">
            <span>🛡️</span>
            <span>Garantie Satisfait ou Remboursé 14 jours</span>
          </div>
          <p className="text-[11px] text-emerald-800/90 leading-relaxed">
            Testez votre agent vocal en conditions réelles sur vos appels. Si vous n&apos;êtes pas entièrement satisfait, nous vous remboursons intégralement sur simple demande.
          </p>
        </div>
      </div>

      {/* Right Column: Checkout Form & Stripe Trigger */}
      <div className="lg:col-span-7">
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6"
        >
          {/* Header */}
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Paiement Sécurisé Stripe SSL 256 bits
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Coordonnées de Facturation & Souscription
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Renseignez vos coordonnées pour finaliser votre abonnement et recevoir vos accès.
            </p>
          </div>

          {/* Error alert */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
              <span className="text-base">⚠️</span>
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Votre Nom & Prénom <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dr. Martin ou Sophie Renaud"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Nom du Cabinet ou Entreprise
                </label>
                <input
                  type="text"
                  placeholder="Ex: Cabinet Médical Renaud ou BâtiPro"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Adresse Email Professionnelle <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="votre.email@cabinet-pro.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
                />
                <p className="text-2xs text-slate-400">
                  Votre reçu Stripe et vos identifiants d&apos;accès y seront envoyés.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Numéro de Mobile pour Alertes
                </label>
                <input
                  type="tel"
                  placeholder="06 00 00 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
                />
                <p className="text-2xs text-slate-400">
                  Utilisé pour recevoir les notifications d&apos;appels urgents.
                </p>
              </div>
            </div>
          </div>

          {/* Payment Method Presentation */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Mode de règlement :</span>
              <span className="text-xs font-semibold text-slate-500">Stripe Checkout</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs">
                💳 Carte Bancaire
              </span>
              <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs">
                Visa
              </span>
              <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs">
                Mastercard
              </span>
              <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs">
                Apple Pay
              </span>
              <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs">
                Google Pay
              </span>
            </div>
            <p className="text-2xs text-slate-400">
              Vos informations bancaires sont chiffrées de bout en bout et traitées directement sur les serveurs certifiés PCI-DSS de Stripe. Aucun numéro de carte ne transite sur nos serveurs.
            </p>
          </div>

          {/* Consent Checkbox */}
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
              />
              <span>
                J&apos;accepte les <Link href="/conditions" className="text-amber-600 underline">Conditions Générales de Vente</Link> et la politique de confidentialité. Mon abonnement est sans engagement de durée et résiliable en 1 clic.
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-amber-500/25 hover:shadow-amber-500/35 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Connexion sécurisée à Stripe...</span>
                </>
              ) : (
                <>
                  <span>Payer {totalTtc.toFixed(2)} € TTC via Stripe</span>
                  <span>➔</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-4 text-2xs text-slate-400">
              <span className="flex items-center gap-1">🔒 3D Secure 2.0</span>
              <span>•</span>
              <span className="flex items-center gap-1">⚡ Activation en 24h</span>
              <span>•</span>
              <span className="flex items-center gap-1">📄 Facture avec TVA</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
