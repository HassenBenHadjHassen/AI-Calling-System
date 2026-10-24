import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Solutions Métiers — VoxFlow AI',
  description:
    'Découvrez nos solutions d’accueil téléphonique par IA adaptées à votre secteur : Santé & Cabinets Médicaux, BTP & Artisans, Professions Juridiques et Agences Immobilières.',
};

export default function SolutionsPage() {
  const verticals = [
    {
      id: 'sante',
      title: 'Santé, Soins & Cabinets Médicaux',
      tagline: 'Zéro appel perdu pendant vos soins et consultations',
      icon: '🏥',
      challenge:
        'En consultation ou en tournée auprès des patients, décrocher le téléphone est impossible sans perturber la qualité des soins. Les répondeurs classiques saturent et les urgences restent sans réponse.',
      solution:
        'L’assistant vocal accueille le patient chaleureusement, prend note du motif et de l’ordonnance, consulte votre planning en temps réel et bloque le rendez-vous. En cas d’urgence, une alerte vous est immédiatement transmise.',
      features: [
        'Vérification du motif de soin et des ordonnances',
        'Distinction automatique entre urgence médicale et soin de routine',
        'Notification prioritaire immédiate sur votre mobile en cas d’urgence',
        'Synchronisation directe avec vos agendas (Doctolib, Google Calendar, Outlook)',
        'Conformité stricte à la confidentialité des données de santé',
      ],
      metrics: ['100% des patients accueillis', 'Moins de rendez-vous manqués grâce aux rappels', 'Sérénité totale pendant vos soins'],
    },
    {
      id: 'btp',
      title: 'BTP, Rénovation & Artisans du Bâtiment',
      tagline: 'Transformez chaque appel de chantier en devis qualifié',
      icon: '🏗️',
      challenge:
        'Sur un chantier, avec le bruit des machines ou en hauteur, vous ne pouvez pas répondre. Un client qui tombe sur un répondeur appelle immédiatement un autre artisan.',
      solution:
        'L’assistant prend l’appel en moins d’une seconde, pose les questions clés sur le projet (surface, type de travaux, délai) et envoie automatiquement au prospect un SMS avec un lien sécurisé pour transmettre photos et adresse.',
      features: [
        'Envoi instantané d’un portail de devis par SMS pendant l’appel',
        'Collecte immédiate des photos du chantier et de l’adresse d’intervention',
        'Qualification automatique de l’urgence (dépannage urgent vs chantier planifié)',
        'Fiche prospect enrichie transmise directement à votre équipe',
        'Relance automatique par SMS si le devis n’a pas été finalisé',
      ],
      metrics: ['+35% de devis concrétisés', 'Dossier reçu en moins de 2 minutes', 'Zéro prospect perdu sur le terrain'],
    },
    {
      id: 'avocats',
      title: 'Cabinets d’Avocats & Conseil Juridique',
      tagline: 'Accueil d’excellence, confidentialité et réservation de créneaux',
      icon: '⚖️',
      challenge:
        'Pendant les audiences et réunions de travail, le secrétariat est fréquemment submergé. Vos clients clés attendent un accueil fluide et une prise en charge rapide.',
      solution:
        'Accueil personnalisé de vos clients réguliers, orientation selon le type de dossier, qualification du besoin et réservation directe de créneaux de consultation dans les agendas des associés.',
      features: [
        'Reconnaissance prioritaire de vos clients habituels et partenaires',
        'Filtrage rigoureux des démarchages et sollicitations non souhaitées',
        'Réservation automatisée des consultations juridiques',
        'Envoi de synthèses claires par email après chaque appel',
        'Respect strict du secret professionnel et confidentialité absolue',
      ],
      metrics: ['Filtrage de 95% des appels parasites', 'Rendez-vous qualifiés', 'Disponibilité 24h/24'],
    },
    {
      id: 'immobilier',
      title: 'Agences Immobilières & Gestion Locative',
      tagline: 'Ne ratez aucun acquéreur ni aucune urgence locative',
      icon: '🏢',
      challenge:
        'Les conseillers sont en visite sur le terrain toute la journée. Un acquéreur motivé qui ne parvient pas à joindre l’agence passe à l’annonce suivante.',
      solution:
        'L’assistant identifie la référence du bien, répond aux questions de premier niveau, qualifie le projet et le budget de l’acquéreur, et réserve un créneau de visite dans l’agenda du négociateur concerné.',
      features: [
        'Prise de renseignement par référence d’annonce ou localisation',
        'Qualification préalable du projet d’achat et de son financement',
        'Planification des créneaux de visite avec confirmation par SMS',
        'Gestion des urgences pour les locataires et syndics (fuites, pannes)',
        'Fiche acquéreur complète transmise directement à votre négociateur',
      ],
      metrics: ['Multiplication des visites planifiées', 'Qualification précise des acheteurs', 'Standard joignable le soir et week-end'],
    },
  ];

  return (
    <div className="client-page bg-slate-50 text-slate-900 min-h-screen selection:bg-amber-100 selection:text-amber-900">
      <Navbar />

      <main className="pt-32 pb-24">
        {/* Header Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 pb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            Expertise Sectorielle
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight">
            Des assistants vocaux adaptés aux spécificités de votre métier
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Chaque activité a ses propres règles, son vocabulaire et ses urgences. 
            Nos agents sont configurés pour s&apos;intégrer parfaitement à votre fonctionnement quotidien.
          </p>
        </section>

        {/* Verticals List */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {verticals.map((vert) => (
            <div
              key={vert.id}
              id={vert.id}
              className="bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-12 shadow-xl shadow-slate-200/50 space-y-8 scroll-mt-28"
            >
              {/* Vertical Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-3xl shadow-xs">
                    {vert.icon}
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900">{vert.title}</h2>
                    <p className="text-xs sm:text-sm text-amber-700 font-semibold mt-0.5">{vert.tagline}</p>
                  </div>
                </div>

                <div className="px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-700 font-semibold self-start md:self-auto">
                  Déploiement en 48h
                </div>
              </div>

              {/* Challenge vs Solution */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                    <span>⚠️</span> La Problématique Rencontrée
                  </span>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{vert.challenge}</p>
                </div>

                <div className="bg-amber-50/50 border border-amber-200 p-6 rounded-2xl space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <span>✨</span> La Solution Apportée
                  </span>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{vert.solution}</p>
                </div>
              </div>

              {/* Key Features & Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
                <div className="lg:col-span-8 space-y-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Bénéfices &amp; Fonctionnalités Clés :
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {vert.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2 text-xs text-slate-600">
                        <span className="text-emerald-600 font-bold flex-shrink-0 mt-0.5">✓</span>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-4 bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Résultats Constatés :
                  </span>
                  <div className="space-y-2">
                    {vert.metrics.map((m, mIdx) => (
                      <div
                        key={mIdx}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 flex items-center gap-2 shadow-2xs"
                      >
                        <span className="text-amber-600">📈</span> {m}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-slate-500">
                  Besoin d&apos;adapter le scénario à vos spécificités ou vos logiciels ?
                </p>
                <Link
                  href={`/contact?sector=${vert.id}`}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs transition-colors shadow-sm"
                >
                  Configurer un assistant pour {vert.title} ➔
                </Link>
              </div>
            </div>
          ))}
        </section>

        {/* Bottom Banner */}
        <section className="max-w-4xl mx-auto px-4 mt-20 text-center space-y-6">
          <h2 className="text-3xl font-black text-slate-900">Votre métier a des besoins particuliers ?</h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-xl mx-auto">
            Nous concevons des agents vocaux personnalisés pour tout secteur professionnel (cabinets d’expertise-comptable,
            cliniques vétérinaires, centres de formation, services d&apos;assistance).
          </p>
          <Link
            href="/contact"
            className="inline-block px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm shadow-md shadow-amber-500/20"
          >
            Échanger sur mon projet avec un spécialiste ➔
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
