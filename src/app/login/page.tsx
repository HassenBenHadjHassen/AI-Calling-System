'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
          setErrorMsg(res.error.message || 'Identifiants invalides. Veuillez vérifier votre email et mot de passe.');
          setLoading(false);
          return;
        }

        window.location.href = callbackUrl;
      } else {
        const res = await signUp.email({
          name: name.trim() || 'Client',
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

  return (
    <div className="client-page min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between py-8 sm:py-12 sm:px-6 lg:px-8 font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* Top Header Bar with Return link */}
      <div className="max-w-4xl mx-auto w-full px-4 flex items-center justify-between pb-6">
        <Link
          href="/"
          className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
        >
          <span>←</span> Retour au site public
        </Link>

        <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Espace Sécurisé
        </div>
      </div>

      {/* Main Login Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="text-center mb-6 space-y-2">
          {/* Brand Icon */}
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform text-xl">
              🎙️
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-900">
              VoxFlow <span className="text-amber-600">AI</span>
            </span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Espace Client
          </h1>
          <p className="text-xs text-slate-500">
            Consultez vos appels, rendez-vous confirmés et demandes de devis.
          </p>
        </div>

        <div className="bg-white py-8 px-6 sm:px-8 shadow-xl shadow-slate-200/50 rounded-3xl border border-slate-200/90 space-y-6">
          {/* Mode Switch Tabs */}
          <div className="flex p-1 bg-slate-100 border border-slate-200 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
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
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Créer un compte
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
                <label className="text-xs font-bold text-slate-700">Nom complet ou Entreprise</label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Dr. Martin ou Sophie Rénovation"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Adresse Email professionnelle</label>
              <input
                type="email"
                required
                placeholder="votre.email@entreprise.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none"
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
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none font-mono"
              />
              {mode === 'signup' && (
                <p className="text-[10px] text-slate-400">8 caractères minimum.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span>Connexion en cours...</span>
              ) : mode === 'signin' ? (
                <span>Accéder à mon tableau de bord ➔</span>
              ) : (
                <span>Créer mon accès et continuer ➔</span>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              Besoin d&apos;assistance ou identifiant oublié ?{' '}
              <a href="mailto:contact@voxflow-ai.fr" className="text-amber-700 hover:underline font-semibold">
                Contactez le support
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Footer link */}
      <div className="text-center pt-8 text-xs text-slate-400">
        © 2026 VoxFlow AI Technologies &bull; Plateforme sécurisée pour professionnels
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500 font-medium">
          Chargement de l&apos;authentification...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
