import { DevisIntakeService } from '@/lib/services/devis-intake.service';
import DevisClientForm from './client-form';

export const metadata = {
  title: 'Dani Bâtiment — Finalisation de votre Demande de Devis',
  description: 'Portail sécurisé pour transmettre vos coordonnées et adresse de chantier suite à votre appel.',
};

export const instant = false;

export default async function DevisCallPage({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  const { callId } = await params;
  const context = await DevisIntakeService.getSubmissionContext(callId);

  return (
    <div className="min-h-screen bg-linear-to-b from-amber-50/40 via-slate-50 to-slate-100 text-slate-900 flex flex-col justify-between selection:bg-amber-100 selection:text-amber-900 font-sans">
      {/* Decorative ambient background glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl"></div>
      </div>

      {/* Top Branding Bar */}
      <header className="relative z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur-md shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-white font-black text-xl shadow-md shadow-amber-500/20">
              🏗️
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                DANI BÂTIMENT
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-semibold">
                  Espace Devis
                </span>
              </h1>
              <p className="text-xs text-slate-500">Rénovation &bull; Construction &bull; Aménagement</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 bg-slate-100/80 px-3 py-1.5 rounded-full border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Connexion Sécurisée
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="relative z-10 max-w-2xl w-full mx-auto px-4 py-8 sm:py-12 flex-1">
        <DevisClientForm callId={callId} initialContext={context} />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 space-y-1">
          <p className="font-medium text-slate-600">© {new Date().getFullYear()} Dani Bâtiment &bull; Tous droits réservés.</p>
          <p className="text-[11px] text-slate-400">
            Vos informations sont strictement confidentielles et utilisées uniquement pour l&apos;établissement de votre devis.
          </p>
        </div>
      </footer>
    </div>
  );
}
