import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PricingTable from '@/components/PricingTable';
import RoiCalculator from '@/components/RoiCalculator';
import { StripeConfigService } from '@/lib/services/stripe-config.service';

export const metadata = {
  title: 'Tarifs & Forfaits — VoxFlow AI',
  description:
    'Des formules simples, claires et transparentes. Choisissez la formule adaptée au volume d’appels de votre activité pour automatiser votre accueil téléphonique.',
};

export default function PricingPage() {
  const plans = StripeConfigService.getPlans();
  const comparisonRows = [
    {
      feature: "Minutes d'appels incluses par mois",
      starter: '200 min',
      pro: '650 min',
      enterprise: 'Sur-mesure (2 000+ min)',
    },
    {
      feature: 'Lignes d’appels simultanées',
      starter: '1 ligne',
      pro: '3 lignes simultanées',
      enterprise: 'Illimité multi-agences',
    },
    {
      feature: 'Accueil 24h/24 & 7j/7 avec voix française naturelle',
      starter: '✓',
      pro: '✓',
      enterprise: '✓',
    },
    {
      feature: 'Synthèse d’appels par email & notification SMS',
      starter: '✓',
      pro: '✓',
      enterprise: '✓',
    },
    {
      feature: 'Synchronisation agenda en direct (Google, Outlook, Doctolib)',
      starter: '—',
      pro: '✓ (Inclus)',
      enterprise: '✓ (Multi-calendriers)',
    },
    {
      feature: 'Portail de devis interactif par SMS pour vos prospects',
      starter: '—',
      pro: '✓ (Inclus)',
      enterprise: '✓ (Sur-mesure)',
    },
    {
      feature: 'Triage des urgences & transfert prioritaire sur mobile',
      starter: '—',
      pro: '✓ (Inclus)',
      enterprise: '✓ (Règles avancées)',
    },
    {
      feature: 'Reconnaissance prioritaire de vos clients habituels',
      starter: '—',
      pro: '✓ (Inclus)',
      enterprise: '✓ (Gestion avancée)',
    },
    {
      feature: 'Tableau de bord de suivi & historique des appels',
      starter: 'Standard',
      pro: 'Complet avec statistiques',
      enterprise: 'Multi-accès & export',
    },
    {
      feature: 'Connexion à votre logiciel métier ou CRM existant',
      starter: '—',
      pro: 'En option',
      enterprise: '✓ (Inclus sur-mesure)',
    },
    {
      feature: 'Support & accompagnement',
      starter: 'Email (24h)',
      pro: 'Prioritaire 7j/7 (<2h)',
      enterprise: 'Dédié 24/7 + Référent unique',
    },
  ];

  return (
    <div className="client-page bg-slate-50 text-slate-900 min-h-screen selection:bg-amber-100 selection:text-amber-900">
      <Navbar />

      <main className="pt-32 pb-24">
        {/* Header */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 pb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            Investissement Rentable
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight">
            Des tarifs transparents, rentabilisés dès le 1er appel sauvé
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Sans frais d’installation cachés. Choisissez l’offre qui correspond au volume d’appels de votre activité.
          </p>
        </section>

        {/* Pricing Table Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <PricingTable initialPlans={plans} />
        </section>

        {/* Comparison Matrix Table */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Comparatif Détaillé des Fonctionnalités
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Découvrez en un coup d’œil ce qui est inclus dans chaque formule.
            </p>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="p-4 sm:p-5 font-bold">Fonctionnalité</th>
                    <th className="p-4 sm:p-5 font-bold text-center w-1/4">Starter / Artisan</th>
                    <th className="p-4 sm:p-5 font-bold text-center w-1/4 text-amber-800 bg-amber-50/50">
                      Pro / Cabinet ★
                    </th>
                    <th className="p-4 sm:p-5 font-bold text-center w-1/4">Entreprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comparisonRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4 sm:p-5 text-slate-800 font-semibold">{row.feature}</td>
                      <td className="p-4 sm:p-5 text-center text-slate-600">{row.starter}</td>
                      <td className="p-4 sm:p-5 text-center text-amber-800 font-bold bg-amber-50/30">
                        {row.pro}
                      </td>
                      <td className="p-4 sm:p-5 text-center text-slate-800 font-semibold">{row.enterprise}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ROI Reminder */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-6">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Simulateur Financier
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Vérifiez la rentabilité pour votre structure
            </h2>
          </div>

          <RoiCalculator />
        </section>

        {/* Pricing FAQ */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
          <h2 className="text-2xl font-black text-slate-900 text-center">
            Questions Fréquentes sur la Facturation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-2 shadow-2xs">
              <h4 className="font-bold text-slate-900">Que se passe-t-il si je dépasse mon quota de minutes ?</h4>
              <p className="text-slate-600 leading-relaxed">
                Votre standard téléphonique ne coupe jamais. Les minutes supplémentaires sont simplement facturées au tarif avantageux
                indiqué dans votre forfait (de 0,10 € à 0,18 € / min), sans interruption de service.
              </p>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-2 shadow-2xs">
              <h4 className="font-bold text-slate-900">Y a-t-il un engagement de durée ?</h4>
              <p className="text-slate-600 leading-relaxed">
                Non. Avec la facturation mensuelle, vous êtes libre de résilier ou modifier votre formule à tout
                moment d&apos;un simple clic. La facturation annuelle vous fait bénéficier de 2 mois offerts (-20%).
              </p>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-2 shadow-2xs">
              <h4 className="font-bold text-slate-900">La configuration initiale est-elle payante ?</h4>
              <p className="text-slate-600 leading-relaxed">
                Non. Zéro frais de mise en route. Notre équipe vous accompagne pour paramétrer vos règles d&apos;accueil,
                vos horaires et connecter vos agendas existants.
              </p>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-2 shadow-2xs">
              <h4 className="font-bold text-slate-900">Puis-je tester avant de m&apos;engager ?</h4>
              <p className="text-slate-600 leading-relaxed">
                Oui. Nous proposons une période d&apos;essai sans risque pour mesurer concrètement les rendez-vous et devis sauvés
                sur votre propre standard.
              </p>
            </div>
          </div>

          <div className="text-center pt-6">
            <Link
              href="/contact"
              className="inline-block px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm shadow-md shadow-amber-500/20"
            >
              Démarrer mon Essai sans Engagement ➔
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
