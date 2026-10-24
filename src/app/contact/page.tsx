import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ContactForm from '@/components/ContactForm';

export const metadata = {
  title: 'Contact & Audit Téléphonique — VoxFlow AI',
  description:
    'Prenez contact avec notre équipe pour configurer votre assistant vocal sur-mesure ou obtenir un audit gratuit de votre accueil téléphonique.',
};

export const instant = false;

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; sector?: string }>;
}) {
  const { plan } = await searchParams;

  return (
    <div className="client-page bg-slate-50 text-slate-900 min-h-screen selection:bg-amber-100 selection:text-amber-900">
      <Navbar />

      <main className="pt-32 pb-24">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left: Contact Info & Value props (5 cols) */}
            <div className="lg:col-span-5 space-y-8">
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                  Équipe &amp; Déploiement
                </span>
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  Parlons de votre accueil téléphonique
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Que vous soyez un professionnel de santé, un artisan ou une entreprise multisite, notre équipe
                  vous accompagne pour configurer l&apos;assistant vocal idéal en moins de 48 heures.
                </p>
              </div>

              {/* Direct Reach Cards */}
              <div className="space-y-3">
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    ✉️ Équipe Intégration &amp; Support
                  </span>
                  <a
                    href="mailto:contact@voxflow-ai.fr"
                    className="text-base font-bold text-slate-900 hover:text-amber-600 transition-colors block"
                  >
                    contact@voxflow-ai.fr
                  </a>
                  <p className="text-xs text-slate-500">
                    Réponse en moins de 2 heures ouvrées pour toute question ou demande de devis.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                    🏢 Hébergement &amp; Sécurité
                  </span>
                  <div className="text-xs font-bold text-slate-900">Infrastructures en France &bull; UE</div>
                  <p className="text-xs text-slate-500">
                    Conformité stricte au RGPD et confidentialité des données professionnelles.
                  </p>
                </div>
              </div>

              {/* Deployment Process Timeline */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                  Déroulement de la mise en service :
                </span>
                <div className="space-y-2.5 text-xs text-slate-600">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      1
                    </span>
                    <span>Analyse de vos consignes, horaires et questions fréquentes</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      2
                    </span>
                    <span>Personnalisation de la voix et connexion de vos agendas</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      3
                    </span>
                    <span>Appel test de validation et ouverture de votre ligne</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Interactive Form (7 cols) */}
            <div className="lg:col-span-7">
              <ContactForm initialPlan={plan} />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
