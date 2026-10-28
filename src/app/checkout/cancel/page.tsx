import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Souscription non finalisée — VoxFlow AI',
  description: 'Votre paiement a été interrompu et aucun débit n’a été effectué.',
};

export const instant = false;

export default async function CheckoutCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;

  return (
    <div className="client-page min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-12 flex flex-col items-center justify-center">
        <div className="bg-white border border-slate-200/90 rounded-3xl p-8 shadow-xl shadow-slate-200/50 space-y-6 text-center w-full">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mx-auto flex items-center justify-center text-3xl shadow-2xs">
            ↩️
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
              Paiement Annulé
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Votre commande n&apos;a pas été débitée
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              Vous avez interrompu la transaction sur Stripe. Aucun prélèvement n&apos;a été effectué sur votre compte bancaire.
            </p>
          </div>

          {/* Assurance note */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 text-left space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-2">
              <span>💡</span>
              <span>Besoin d&apos;informations complémentaires ?</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Si vous avez des questions sur l&apos;intégration avec vos logiciels métiers, les options de paiement par virement SEPA ou la période d&apos;essai, nos experts sont à votre disposition.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <Link
              href={plan ? `/checkout?plan=${encodeURIComponent(plan)}` : '/pricing'}
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm shadow-md shadow-amber-500/20 transition-all"
            >
              Reprendre ma souscription ➔
            </Link>

            <Link
              href="/contact"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
            >
              Échanger avec un conseiller technique
            </Link>

            <Link
              href="/"
              className="block text-2xs text-slate-400 hover:text-slate-600 pt-2 transition-colors"
            >
              ← Retour à la page d&apos;accueil
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
