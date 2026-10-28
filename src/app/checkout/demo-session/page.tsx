import { Suspense } from 'react';
import DemoCheckoutClient from './demo-checkout-client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Simulation de Paiement Stripe — VoxFlow AI',
  description: 'Portail de démonstration interactive Stripe Checkout pour votre abonnement.',
};

export const instant = false;

function AsyncDemoCheckout({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    plan?: string;
    interval?: string;
    email?: string;
    company?: string;
  }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
          Chargement de l&apos;interface de simulation...
        </div>
      }
    >
      <DemoCheckoutLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function DemoCheckoutLoader({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    plan?: string;
    interval?: string;
    email?: string;
    company?: string;
  }>;
}) {
  const params = await searchParams;
  const sessionId = params.session_id || 'demo_cs_preview';
  const planId = params.plan || 'pro';
  const interval = (params.interval === 'annual' ? 'annual' : 'monthly') as any;

  return (
    <DemoCheckoutClient
      sessionId={sessionId}
      planId={planId}
      interval={interval}
      email={params.email}
      company={params.company}
    />
  );
}

export default async function DemoCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    plan?: string;
    interval?: string;
    email?: string;
    company?: string;
  }>;
}) {
  return (
    <div className="client-page min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col items-center justify-center">
        <AsyncDemoCheckout searchParams={searchParams} />
      </main>
      <Footer />
    </div>
  );
}
