import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import VoiceSimulator from '@/components/VoiceSimulator';
import RoiCalculator from '@/components/RoiCalculator';
import PricingTable from '@/components/PricingTable';
import FaqAccordion from '@/components/FaqAccordion';
import ContactForm from '@/components/ContactForm';
import { StripeConfigService } from '@/lib/services/stripe-config.service';

export const metadata = {
  title: 'VoxFlow AI — Standard Téléphonique & Accueil Intelligent par IA 24/7',
  description:
    'Ne manquez plus aucun appel client. Standard téléphonique intelligent par IA pour professionnels de santé, artisans du bâtiment et cabinets de conseil. Prise de RDV et devis par SMS instantanés.',
};

export default function HomePage() {
  const plans = StripeConfigService.getPlans();
  return (
    <div className="client-page bg-slate-50 text-slate-900 min-h-screen selection:bg-amber-100 selection:text-amber-900">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-gradient-to-b from-amber-50/40 via-slate-50 to-white">
        {/* Subtle Decorative Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-amber-200/30 via-orange-100/20 to-teal-100/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Top Pill / Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white border border-amber-200 text-xs text-amber-800 font-bold mb-8 shadow-xs">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>STANDARD TÉLÉPHONIQUE AUTONOME • DÉCROCHAGE IMMÉDIAT 24/7</span>
          </div>

          {/* Main Hero Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.08] max-w-5xl mx-auto">
            Ne manquez plus aucun appel.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700">
              Transformez chaque sonnerie en client 24h/24.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Un assistant téléphonique par IA dédié à votre activité, qui décroche dès la première sonnerie, comprend parfaitement vos clients, 
            verrouille vos rendez-vous dans votre agenda et envoie vos devis par SMS.
          </p>

          {/* Dual CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#demo"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm sm:text-base transition-all shadow-lg shadow-amber-500/25 hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🎙️</span> Tester la Démonstration Vocale
            </a>
            <a
              href="#roi-calculator"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm sm:text-base border border-slate-200 hover:border-slate-300 transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>📊</span> Estimer Mes Revenus Récupérés
            </a>
          </div>

          {/* Trust Metrics Ribbon */}
          <div className="mt-16 pt-10 border-t border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-slate-900">&lt; 1 sec</div>
              <div className="text-xs text-slate-500 font-medium">Décrochage instantané sans attente</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-emerald-700">100%</div>
              <div className="text-xs text-slate-500 font-medium">Des appels accueillis 24h/24 &amp; 7j/7</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-amber-700">+35%</div>
              <div className="text-xs text-slate-500 font-medium">De rendez-vous &amp; devis convertis</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-slate-900">RGPD</div>
              <div className="text-xs text-slate-500 font-medium">Données protégées &amp; serveurs en France</div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Voice Demo Simulator Section */}
      <section id="demo" className="py-16 md:py-24 bg-white border-t border-slate-200/80 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              🎙️ Démonstration Interactive en Direct
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Testez notre assistant vocal intelligent en direct
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Décrochez le standard virtuel, parlez à la voix ou par message : découvrez comment l&apos;IA comprend instantanément vos clients,
              consulte vos disponibilités et déclenche les devis par SMS sans interrompre vos journées.
            </p>
          </div>

          <VoiceSimulator />
        </div>
      </section>

      {/* How It Works (Comment ça marche) */}
      <section id="comment-ca-marche" className="py-20 bg-slate-50 border-t border-slate-200/80 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Simplicité &amp; Efficacité
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Comment notre solution automatise votre standard
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Trois étapes sans friction pour transformer chaque sonnerie en opportunité concrète.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-xl font-black">
                1
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Décrochage Immédiat &amp; Échange Naturel
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Votre ligne sonne, l&apos;assistant répond immédiatement. Avec une voix française chaleureuse et naturelle, 
                il accueille le client, comprend les besoins et répond avec précision selon vos consignes.
              </p>
              <div className="pt-2 text-xs font-semibold text-amber-700">
                ✓ Aucune attente • Zéro répondeur
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-xl font-black">
                2
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Prise de RDV dans Votre Agenda
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                L&apos;assistant consulte vos disponibilités réelles dans votre calendrier habituel (Google, Outlook, Doctolib). 
                Il propose un créneau adapté à l&apos;appelant et le bloque immédiatement sans conflit d&apos;horaire.
              </p>
              <div className="pt-2 text-xs font-semibold text-emerald-700">
                ✓ Compatible avec tous vos calendriers
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center text-xl font-black">
                3
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                SMS Instantané &amp; Suivi Automatique
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Pendant l&apos;appel, le client reçoit un SMS de confirmation ou son lien pour finaliser son devis. 
                Si une urgence est détectée, votre équipe est alertée instantanément sur mobile.
              </p>
              <div className="pt-2 text-xs font-semibold text-blue-700">
                ✓ Alertes urgentes &amp; portail devis direct
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solutions Showcase */}
      <section id="solutions" className="py-20 bg-white border-t border-slate-200/80 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Solutions Métiers
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Pensé pour les professionnels où chaque appel compte
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Une solution adaptée aux spécificités de votre secteur pour ne plus jamais manquer une opportunité.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Sector 1: Santé */}
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 sm:p-10 space-y-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  🏥 Santé &amp; Soins à Domicile
                </span>
                <span className="text-xs text-slate-500 font-semibold">Accueil Patients 24/7</span>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-slate-900">
                  Prise en charge patient continue &amp; Alerte soignant en tournée
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                  Pendant les consultations et tournées de soins, décrocher le téléphone est impossible sans interrompre vos patients. 
                  L&apos;assistant qualifie la demande, vérifie l&apos;ordonnance, bloque le créneau exact dans votre agenda et vous alerte en cas d&apos;urgence.
                </p>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-200 text-xs text-slate-700 font-medium">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Triage des urgences vitales avec consigne SAMU si nécessaire</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Validation du passage selon vos horaires de tournée réels</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Alerte SMS immédiate sur le mobile de garde en cas d&apos;urgence</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/solutions#sante"
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1.5 transition-colors"
                >
                  Découvrir la formule Santé &amp; Paramédical ➔
                </Link>
              </div>
            </div>

            {/* Sector 2: BTP */}
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 sm:p-10 space-y-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                  🏗️ BTP &amp; Artisans du Bâtiment
                </span>
                <span className="text-xs text-slate-500 font-semibold">Devis Chantiers Express</span>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-slate-900">
                  Qualification du chantier &amp; Envoi du formulaire devis par SMS
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                  Sur un chantier bruyant ou en déplacement, un appel manqué est un chantier qui part chez un confrère. 
                  L&apos;assistant pose les bonnes questions (nature des travaux, surface, code postal) et transmet immédiatement au client un lien pour envoyer photos et plans.
                </p>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-200 text-xs text-slate-700 font-medium">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Portail devis web sécurisé sans aucun formulaire papier</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Collecte immédiate des photos et de l&apos;adresse du chantier</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Fiche prospect qualifiée transmise directement à votre équipe</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/solutions#btp"
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1.5 transition-colors"
                >
                  Découvrir la formule BTP &amp; Artisans ➔
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Calculator Section */}
      <section id="roi-calculator" className="py-20 bg-slate-50 border-t border-slate-200/80 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Rentabilité Immédiate
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Calculez les revenus que vous récupérez chaque mois
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              En moyenne, 28% des appels de professionnels restent sans réponse lorsqu&apos;ils sont en intervention. 
              Visualisez le retour sur investissement instantané d&apos;un accueil téléphonique par IA.
            </p>
          </div>

          <RoiCalculator />
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Retours d&apos;Expérience
            </span>
            <h2 className="text-3xl font-black text-slate-900">Ce que nos utilisateurs constatent</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 space-y-4 shadow-sm">
              <div className="flex items-center gap-1 text-amber-500 text-sm">
                ★★★★★
              </div>
              <p className="text-sm text-slate-700 italic leading-relaxed">
                &laquo; En tournée auprès des patients, il m&apos;était impossible de décrocher. Je perdais une quinzaine d&apos;appels
                par jour. Désormais, chaque appelant est accueilli calmement, les rendez-vous sont planifiés directement
                dans mon agenda, et si une urgence se présente, mon téléphone sonne avec le motif précis par SMS.
                C&apos;est une sérénité totale au quotidien. &raquo;
              </p>
              <div className="pt-2 border-t border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm border border-emerald-200">
                  SL
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Dr. Sophie L.</div>
                  <div className="text-[11px] text-slate-500">Praticienne de santé libérale</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 space-y-4 shadow-sm">
              <div className="flex items-center gap-1 text-amber-500 text-sm">
                ★★★★★
              </div>
              <p className="text-sm text-slate-700 italic leading-relaxed">
                &laquo; Dans notre métier, si on ne répond pas rapidement, le client appelle une autre entreprise.
                Avec cet assistant téléphonique, le prospect reçoit un SMS pendant l&apos;appel et dépose ses photos de chantier
                en 2 minutes. Notre taux de concrétisation de devis a bondi et nous ne perdons plus de temps au volant. &raquo;
              </p>
              <div className="pt-2 border-t border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-sm border border-amber-200">
                  MV
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Marc V.</div>
                  <div className="text-[11px] text-slate-500">Dirigeant d&apos;entreprise générale de bâtiment</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-slate-50 border-t border-slate-200/80 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Formules Claires
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Des forfaits transparents, sans coûts cachés
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Rentabilisé dès le premier client ou devis sauvé. Choisissez la formule adaptée au volume d&apos;appels de votre structure.
            </p>
          </div>

          <PricingTable initialPlans={plans} />
        </div>
      </section>

      {/* Consultation & Custom Setup Form Section */}
      <section id="contact" className="py-20 bg-white border-t border-slate-200/80 scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Audit Gratuit &amp; Mise en Route
            </span>
            <h2 className="text-3xl font-black text-slate-900">
              Demandez votre assistant vocal personnalisé
            </h2>
            <p className="text-sm text-slate-600">
              Nos spécialistes préparent votre scénario d&apos;accueil adapté à votre métier sous 24h ouvrées.
            </p>
          </div>

          <ContactForm />
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-slate-50 border-t border-slate-200/80 scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Questions Fréquentes
            </span>
            <h2 className="text-3xl font-black text-slate-900">
              Tout ce que vous devez savoir avant de démarrer
            </h2>
          </div>

          <FaqAccordion />
        </div>
      </section>

      {/* Final Call To Action Banner */}
      <section className="py-16 bg-gradient-to-r from-amber-500/15 via-orange-500/20 to-amber-500/15 border-t border-amber-200 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Prêt à ne plus jamais perdre un appel client ?
          </h2>
          <p className="text-sm sm:text-base text-slate-700 max-w-2xl mx-auto leading-relaxed">
            Rejoignez les professionnels qui ont automatisé leur standard téléphonique et augmenté leurs prises
            de rendez-vous dès la première semaine.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <a
              href="#contact"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm shadow-md shadow-amber-500/25 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              Demander Mon Audit Téléphonique Gratuit ➔
            </a>
            <Link
              href="/demo"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border border-slate-200 transition-all shadow-xs"
            >
              Écouter la Démo en Ligne
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
