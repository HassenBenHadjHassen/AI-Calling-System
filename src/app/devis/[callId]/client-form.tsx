'use client';

import { useState } from 'react';
import { isRealPhoneNumber } from '@/lib/validation/phone';

interface DevisContext {
  callId: string;
  status: string;
  name: string;
  phoneNumber: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  serviceType: string;
  message: string;
}

export default function DevisClientForm({
  callId,
  initialContext,
}: {
  callId: string;
  initialContext: DevisContext | null;
}) {
  const [formData, setFormData] = useState({
    name: initialContext?.name || '',
    phone: isRealPhoneNumber(initialContext?.phoneNumber) ? initialContext!.phoneNumber : '',
    email: initialContext?.email || '',
    address: initialContext?.address || '',
    postalCode: initialContext?.postalCode || '',
    city: initialContext?.city || '',
    serviceType: initialContext?.serviceType || 'Devis & Travaux',
    message: initialContext?.message || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(initialContext?.status === 'COMPLETED');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/forms/devis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId,
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          postalCode: formData.postalCode,
          city: formData.city,
          serviceType: formData.serviceType,
          message: formData.message,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de l’enregistrement de votre devis');
      }

      setIsCompleted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur inattendue est survenue.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return (
      <div
        id="devis-success-card"
        className="bg-white border border-emerald-200/90 rounded-3xl p-8 sm:p-10 shadow-xl shadow-emerald-500/5 text-center space-y-6 animate-fade-in"
      >
        <div className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 mx-auto flex items-center justify-center text-4xl shadow-sm">
          ✓
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Demande de Devis Enregistrée !
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Merci <span className="font-semibold text-amber-700">{formData.name || initialContext?.name}</span>. Vos coordonnées ont été transmises directement à nos conducteurs de travaux.
          </p>
        </div>

        <div className="bg-slate-50/90 rounded-2xl p-5 border border-slate-200/80 text-left space-y-3 text-xs text-slate-700">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <span className="text-slate-500 font-medium">Référence Dossier</span>
            <span className="font-mono text-amber-700 font-bold">{callId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Prestation</span>
            <span className="text-slate-900 font-semibold">{formData.serviceType}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Chantier</span>
            <span className="text-slate-900 font-semibold">
              {formData.address || initialContext?.address || 'Adresse validée'} ({formData.postalCode || initialContext?.postalCode})
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Statut</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
              En cours de traitement
            </span>
          </div>
        </div>

        <div className="pt-2 text-xs text-slate-500 space-y-1">
          <p>📞 Notre équipe technique vous contactera sous 24h ouvrées.</p>
          <p>Un SMS récapitulatif a été généré pour le suivi de votre chantier.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Introduction Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Suite à votre appel téléphonique
          </span>
          <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
            Réf: {callId.slice(-10)}
          </span>
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">
          Complétez vos coordonnées pour votre devis
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Afin que notre équipe puisse étudier les spécificités de votre chantier et vous transmettre une proposition chiffrée, merci de renseigner ci-dessous l&apos;adresse d&apos;intervention et votre email.
        </p>
      </div>

      {errorMessage && (
        <div
          id="devis-error-alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2"
        >
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Interactive Form */}
      <form
        id="devis-intake-form"
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Nom / Raison Sociale */}
          <div className="space-y-1.5">
            <label htmlFor="input-name" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              Nom complet ou Entreprise <span className="text-amber-600">*</span>
            </label>
            <input
              id="input-name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Lucie Bernard"
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all outline-hidden"
            />
          </div>

          {/* Numéro de Téléphone */}
          <div className="space-y-1.5">
            <label htmlFor="input-phone" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              Numéro de contact
            </label>
            <input
              id="input-phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+33 6 12 34 56 78"
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all outline-hidden"
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="input-email" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            Adresse email (pour la réception du devis) <span className="text-amber-600">*</span>
          </label>
          <input
            id="input-email"
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="exemple@domaine.fr"
            className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all outline-hidden"
          />
        </div>

        {/* Adresse Chantier */}
        <div className="space-y-1.5">
          <label htmlFor="input-address" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            Adresse exacte du chantier / Travaux <span className="text-amber-600">*</span>
          </label>
          <input
            id="input-address"
            type="text"
            required
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="N°, rue, bâtiment, étage ou précisions d'accès"
            className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all outline-hidden"
          />
        </div>

        {/* Code Postal & Ville */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="input-postal" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              Code Postal <span className="text-amber-600">*</span>
            </label>
            <input
              id="input-postal"
              type="text"
              required
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              placeholder="Ex: 75015"
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all outline-hidden"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="input-city" className="text-xs font-semibold text-slate-700">
              Ville
            </label>
            <input
              id="input-city"
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Ex: Paris"
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all outline-hidden"
            />
          </div>
        </div>

        {/* Prestation / Motif */}
        <div className="space-y-1.5">
          <label htmlFor="input-servicetype" className="text-xs font-semibold text-slate-700">
            Type de prestation envisagée
          </label>
          <input
            id="input-servicetype"
            type="text"
            value={formData.serviceType}
            onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
            placeholder="Ex: Rénovation salle de bain, peinture, plomberie..."
            className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all outline-hidden"
          />
        </div>

        {/* Message / Détails */}
        <div className="space-y-1.5">
          <label htmlFor="input-message" className="text-xs font-semibold text-slate-700">
            Précisions sur vos travaux (surface, contraintes, délais)
          </label>
          <textarea
            id="input-message"
            rows={3}
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            placeholder="Indiquez tous les détails utiles pour que nous puissions affiner notre chiffrage..."
            className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all outline-hidden resize-none"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            id="submit-devis-btn"
            type="submit"
            disabled={isSubmitting}
            className="w-full cursor-pointer py-3.5 px-6 rounded-2xl bg-linear-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 active:scale-[0.99] text-white font-bold text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Envoi en cours...</span>
              </>
            ) : (
              <>
                <span>Transmettre mes Coordonnées pour Devis</span>
                <span>➔</span>
              </>
            )}
          </button>
        </div>

        <p className="text-center text-[11px] text-slate-400">
          🔒 Envoi chiffré et direct vers nos serveurs sécurisés. Pas d&apos;intermédiaire tiers.
        </p>
      </form>
    </div>
  );
}
