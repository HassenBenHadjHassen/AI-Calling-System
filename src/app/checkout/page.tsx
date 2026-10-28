import { Suspense } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CheckoutForm from './checkout-form';
import Link from 'next/link';

export const metadata = {
  title: 'Souscription & Paiement Sécurisé Stripe — VoxFlow AI',
  description: 'Finalisez votre souscription d’agent téléphonique par intelligence vocale 24/7.',
};

export const instant = false;

function CheckoutContent({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
          <svg className="animate-spin h-6 w-6 text-amber-500 mr-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          Chargement de votre session de commande sécurisée...
        </div>
      }
    >
      <AsyncCheckout searchParams={searchParams} />
    </Suspense>
  );
}

import { StripeConfigService } from '@/lib/services/stripe-config.service';

async function AsyncCheckout({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string }>;
}) {
  const { plan, interval } = await searchParams;
  const plans = StripeConfigService.getPlans();
  return <CheckoutForm plans={plans} initialPlanId={plan} initialInterval={interval} />;
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string }>;
}) {
  return (
    <div className="client-page min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-12 space-y-8">
        {/* Top Breadcrumb */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Link href="/" className="hover:text-slate-800 transition-colors">
              Accueil
            </Link>
            <span>/</span>
            <Link href="/pricing" className="hover:text-slate-800 transition-colors">
              Tarifs
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-900">Paiement Sécurisé</span>
          </div>

          <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-semibold">Serveur Sécurisé TLS 1.3</span>
          </div>
        </div>

        {/* Page Title */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-2xs font-bold uppercase tracking-wider">
            <span>💳</span>
            <span>Finalisation de votre souscription</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Activez votre Standard Téléphonique IA
          </h1>
          <p className="text-sm text-slate-600">
            Prise en charge immédiate, sans frais de mise en service et sans engagement.
          </p>
        </div>

        {/* Main Content with Suspense */}
        <CheckoutContent searchParams={searchParams} />
      </main>

      <Footer />
    </div>
  );
}
