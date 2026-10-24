'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-slate-50 text-slate-600 border-t border-slate-200/90 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-200">
          {/* Brand Info & Mission */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                🎙️
              </div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900">
                VoxFlow <span className="text-amber-600">AI</span>
              </span>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed max-w-sm">
              La solution d&apos;accueil téléphonique par intelligence vocale. Ne manquez plus aucun appel, 
              planifiez vos rendez-vous en direct et envoyez vos devis 24h/24 sans interrompre vos journées.
            </p>

            {/* Trust Badges */}
            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold shadow-2xs">
                <span className="text-emerald-600">✓</span> Conforme RGPD &amp; Données Protégées
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold shadow-2xs">
                <span className="text-amber-600">⚡</span> Décrochage Instantané 24/7
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold shadow-2xs">
                <span className="text-blue-600">🔒</span> Infrastructure Hébergée en France
              </span>
            </div>
          </div>

          {/* Column 1: Solutions Métiers */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Solutions Métiers
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/solutions#sante" className="hover:text-amber-600 transition-colors">
                  🏥 Cabinets Médicaux &amp; Soins
                </Link>
              </li>
              <li>
                <Link href="/solutions#btp" className="hover:text-amber-600 transition-colors">
                  🏗️ BTP, Artisans &amp; Rénovation
                </Link>
              </li>
              <li>
                <Link href="/solutions#avocats" className="hover:text-amber-600 transition-colors">
                  ⚖️ Avocats &amp; Professions Libérales
                </Link>
              </li>
              <li>
                <Link href="/solutions#immobilier" className="hover:text-amber-600 transition-colors">
                  🏢 Agences Immobilières
                </Link>
              </li>
              <li>
                <Link href="/solutions#pme" className="hover:text-amber-600 transition-colors">
                  💼 Entreprises &amp; Services
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Product & Value */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Plateforme
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/demo" className="hover:text-amber-600 transition-colors font-medium text-slate-900">
                  Démonstration en Ligne
                </Link>
              </li>
              <li>
                <Link href="/#roi-calculator" className="hover:text-amber-600 transition-colors">
                  Calculateur de Rentabilité
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-amber-600 transition-colors">
                  Grille Tarifaire
                </Link>
              </li>
              <li>
                <Link href="/#comment-ca-marche" className="hover:text-amber-600 transition-colors">
                  Fonctionnement &amp; Déploiement
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Contact & Accès */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Espace &amp; Contact
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/login" className="text-slate-900 hover:text-amber-600 font-bold flex items-center gap-1.5">
                  🔑 Espace Client
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-amber-600 transition-colors">
                  Demande d&apos;Audit Téléphonique
                </Link>
              </li>
              <li>
                <a href="mailto:contact@voxflow-ai.fr" className="hover:text-amber-600 transition-colors">
                  contact@voxflow-ai.fr
                </a>
              </li>
              <li>
                <div className="pt-2 text-xs text-slate-500">
                  Accompagnement et configuration sur votre numéro existant
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © 2026 VoxFlow AI Technologies. Tous droits réservés.
          </div>

          <div className="flex items-center gap-6">
            <span className="hover:text-slate-800 cursor-pointer">Mentions Légales</span>
            <span className="hover:text-slate-800 cursor-pointer">Politique de Confidentialité</span>
            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Service Opérationnel
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
