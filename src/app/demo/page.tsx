import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import VoiceSimulator from '@/components/VoiceSimulator';

export const metadata = {
  title: 'Démonstration Vocale Interactive — VoxFlow AI',
  description:
    'Testez la réactivité, le naturel et la fluidité de nos assistants téléphoniques par IA en direct. Découvrez les scénarios métiers et leurs actions automatiques.',
};

export default function DemoPage() {
  return (
    <div className="client-page bg-slate-50 text-slate-900 min-h-screen selection:bg-amber-100 selection:text-amber-900">
      <Navbar />

      <main className="pt-32 pb-24">
        {/* Header */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 pb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            🎙️ Démonstration Vocale Interactive
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight">
            Vivez l&apos;expérience d&apos;un accueil téléphonique par IA en direct
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Testez la fluidité de nos agents vocaux en temps réel. Parlez à la voix ou écrivez : observez comment l&apos;IA comprend chaque phrase, 
            verrouille les créneaux dans vos agendas et transmet des devis par SMS sans délai.
          </p>
        </section>

        {/* Interactive Web Voice Simulator */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <VoiceSimulator />
        </section>

        {/* Value Proposition Cards (Solution-oriented, no technical jargon) */}
        <section className="max-w-5xl mx-auto px-4 pt-20">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/50 space-y-6">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                Pourquoi Nos Clients Choisissent VoxFlow ?
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                Une expérience téléphonique aussi naturelle qu&apos;avec un collaborateur
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
                Fini les standards rigides avec des touches numériques. Vos clients dialoguent librement avec une voix française attentive.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-2 text-center">
                <div className="text-2xl">⚡</div>
                <h4 className="text-sm font-bold text-slate-900">Décrochage Instantané</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  L&apos;IA répond dès la première sonnerie, 24h/24. Plus aucun client ne raccroche déçu.
                </p>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-2 text-center">
                <div className="text-2xl">📅</div>
                <h4 className="text-sm font-bold text-slate-900">Agendas Synchronisés</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Réservation en temps réel selon vos créneaux réels, sans aucun risque de double réservation.
                </p>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-2 text-center">
                <div className="text-2xl">📱</div>
                <h4 className="text-sm font-bold text-slate-900">Suivi SMS Immédiat</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Envoi de confirmations et de liens sécurisés pour finaliser les demandes de devis avec photos.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-4xl mx-auto px-4 pt-16 text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            Prêt à équiper votre propre standard ?
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Nous configurons un scénario de test adapté à vos horaires et à votre activité sous 24h ouvrées.
          </p>
          <div className="pt-2">
            <Link
              href="/contact"
              className="inline-block px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm shadow-md shadow-amber-500/20"
            >
              Créer mon assistant personnalisé ➔
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
