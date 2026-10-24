import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata = {
  title: 'Portail Devis & Formulaires — VoxFlow AI',
  description: 'Portail sécurisé pour la finalisation et validation de vos demandes de devis.',
};

export const instant = false;

export default async function DevisGeneralPage({
  searchParams,
}: {
  searchParams: Promise<{ callId?: string }>;
}) {
  const { callId } = await searchParams;

  if (callId) {
    redirect(`/devis/${encodeURIComponent(callId)}`);
  }

  return (
    <div className="quote-demo-shell min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-100 text-slate-900 flex flex-col justify-center items-center px-4 py-12 font-sans">
      <div className="max-w-md w-full bg-white border border-slate-200/90 rounded-3xl p-8 shadow-xl shadow-slate-200/50 space-y-6 text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mx-auto flex items-center justify-center text-3xl shadow-xs">
          📋
        </div>

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Portail Devis & Suivi
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Pour accéder à votre formulaire de devis personnalisé, veuillez cliquer sur le lien sécurisé reçu par SMS sur votre mobile suite à votre échange téléphonique.
          </p>
        </div>

        {/* Security badge */}
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-500 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Lien unique chiffré à validité temporaire
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md shadow-amber-500/20 transition-all"
          >
            Espace Professionnel & Client ➔
          </Link>
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
          >
            ← Retour à l&apos;accueil
          </Link>
        </div>

        {/* Footer info */}
        <p className="text-2xs text-slate-400 pt-2 border-t border-slate-100">
          VoxFlow AI &bull; Standard Téléphonique & Secrétariat Autonome
        </p>
      </div>
    </div>
  );
}
