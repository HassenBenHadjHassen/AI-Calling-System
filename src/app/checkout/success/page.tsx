import { Suspense } from 'react';
import SuccessClient from './success-client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Paiement Confirmé — VoxFlow AI',
  description: 'Confirmation de votre souscription d’agent téléphonique par intelligence vocale.',
};

export const instant = false;

function AsyncSuccess({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    plan?: string;
    interval?: string;
    email?: string;
  }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
          Génération de votre confirmation de commande...
        </div>
      }
    >
      <SuccessLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function SuccessLoader({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    plan?: string;
    interval?: string;
    email?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <SuccessClient
      sessionId={params.session_id}
      planId={params.plan}
      interval={params.interval as any}
      email={params.email}
    />
  );
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    plan?: string;
    interval?: string;
    email?: string;
  }>;
}) {
  return (
    <div className="client-page min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col items-center justify-center">
        <AsyncSuccess searchParams={searchParams} />
      </main>
      <Footer />
    </div>
  );
}
