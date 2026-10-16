'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn, signUp } from '@/lib/auth-client';

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const res = await signIn.email({
          email,
          password,
        });

        if (res.error) {
          setErrorMsg(res.error.message || 'Identifiants invalides. Veuillez réessayer.');
          setLoading(false);
          return;
        }

        // Hard redirect to dashboard to clear client cache and ensure fresh session cookies
        window.location.href = callbackUrl;
      } else {
        const res = await signUp.email({
          name: name.trim() || 'Opérateur',
          email,
          password,
        });

        if (res.error) {
          setErrorMsg(res.error.message || "Erreur lors de la création de l'accès.");
          setLoading(false);
          return;
        }

        window.location.href = callbackUrl;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg || 'Une erreur est survenue lors de la connexion.');
      setLoading(false);
    }
  };

  const handleDemoFillAdmin = () => {
    setEmail('admin@moncabinet.fr');
    setPassword('AdminPassword2026!');
    setErrorMsg(null);
    setLoading(false);
  };

  const handleDemoFillMichelle = () => {
    setEmail('michelle@moncabinet.fr');
    setPassword('MichellePassword2026!');
    setErrorMsg(null);
    setLoading(false);
  };

  const handleDemoFillDani = () => {
    setEmail('dani@danibatiment.fr');
    setPassword('DaniPassword2026!');
    setErrorMsg(null);
    setLoading(false);
  };

  return (
    <div className="login-shell min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Icon */}
        <div className="brand-mark inline-flex items-center justify-center font-black text-xl mb-5" aria-hidden="true">
          A/
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          Ligne de conduite
        </h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-xl shadow-slate-200/50 rounded-3xl border border-slate-200/80 space-y-6">
          {/* Mode Switch Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${mode === 'signin'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              Créer un accès
            </button>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
              <span className="text-sm">⚠️</span>
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Nom complet</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dr. Martin ou Infirmière Michelle"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-hidden bg-slate-50/50"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Adresse Email</label>
              <input
                type="email"
                required
                placeholder="votre.email@cabinet.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-hidden bg-slate-50/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Mot de passe</label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-hidden bg-slate-50/50 font-mono"
              />
              {mode === 'signup' && (
                <p className="text-2xs text-slate-400">8 caractères minimum.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-md shadow-slate-900/10 cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    ></path>
                  </svg>
                  <span>Validation en cours...</span>
                </>
              ) : mode === 'signin' ? (
                <span>Se connecter au Dashboard</span>
              ) : (
                <span>Créer mon accès et continuer</span>
              )}
            </button>
          </form>

          {/* Demo Accounts Quick-fill Helpers */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <p className="text-3xs uppercase tracking-wider text-slate-400 font-bold text-center">
              Comptes de test & démonstration
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={handleDemoFillAdmin}
                className="w-full py-1.5 px-3 rounded-lg text-2xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>ADM · Tous les établissements</span>
                <span className="font-mono text-3xs text-purple-500">admin@moncabinet.fr</span>
              </button>
              <button
                type="button"
                onClick={handleDemoFillMichelle}
                className="w-full py-1.5 px-3 rounded-lg text-2xs font-semibold bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>CM · Cabinet Michelle</span>
                <span className="font-mono text-3xs text-teal-500">michelle@moncabinet.fr</span>
              </button>
              <button
                type="button"
                onClick={handleDemoFillDani}
                className="w-full py-1.5 px-3 rounded-lg text-2xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>DB · Dani Bâtiment</span>
                <span className="font-mono text-3xs text-amber-500">dani@danibatiment.fr</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400 font-medium">
          Chargement de l&apos;authentification...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
