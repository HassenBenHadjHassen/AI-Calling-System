import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata = {
  title: 'Dani Bâtiment — Portail Devis & Démonstration',
  description: 'Portail de gestion et transmission de devis Dani Bâtiment',
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
    <div className="min-h-screen bg-linear-to-b from-amber-50/50 via-slate-50 to-slate-100 text-slate-900 flex flex-col justify-center items-center px-4 py-12 font-sans">
      <div className="max-w-xl w-full bg-white border border-slate-200/90 rounded-3xl p-8 shadow-xl shadow-slate-200/50 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mx-auto flex items-center justify-center text-3xl shadow-sm">
            🏗️
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Portail Devis &bull; Dani Bâtiment
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Validation et suivi des demandes de devis
            </p>
          </div>
        </div>

        {/* Demo Examples Selector */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Exemples de Démonstration disponibles :
          </h2>

          <div className="space-y-2.5">
            {/* Example 1: Active Form */}
            <Link
              href="/devis/call_demo_devis_001"
              className="group block p-4 rounded-2xl bg-slate-50 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-400 transition-all shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 group-hover:text-amber-800 transition-colors">
                      1. Formulaire Client Interactif
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      À remplir
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Client: Jean-Luc Moreau &bull; Rénovation Salle de Bain & Cuisine (75m²)
                  </p>
                </div>
                <span className="text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all text-base">
                  ➔
                </span>
              </div>
            </Link>

            {/* Example 2: Completed / Confirmed Screen */}
            <Link
              href="/devis/call_demo_completed_002"
              className="group block p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-400 transition-all shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-800 transition-colors">
                      2. Écran de Confirmation Devis
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Déjà soumis
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Client: Sophie Bernard &bull; 42 Avenue de la République, 75011 Paris
                  </p>
                </div>
                <span className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all text-base">
                  ➔
                </span>
              </div>
            </Link>

            {/* Example 3: Internal Calendar Planning */}
            <Link
              href="/dashboard?tab=calendar"
              className="group block p-4 rounded-2xl bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-400 transition-all shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 group-hover:text-blue-800 transition-colors">
                      3. Planning Calendrier Interne
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                      Cabinet Michelle
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Visualisation du planning, rendez-vous urgents et gestion des disponibilités
                  </p>
                </div>
                <span className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all text-base">
                  ➔
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* Navigation & Help */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <Link
            href="/dashboard"
            className="text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1 font-semibold"
          >
            ← Accéder au Tableau de Bord
          </Link>
          <span className="text-2xs text-slate-400">Enregistrement sécurisé</span>
        </div>
      </div>
    </div>
  );
}
