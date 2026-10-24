'use client';

import { useState } from 'react';

export default function ContactForm({ initialPlan }: { initialPlan?: string }) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [sector, setSector] = useState('sante');
  const [callVolume, setCallVolume] = useState('150-500');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
  };

  if (submitted) {
    return (
      <div className="bg-white border border-emerald-300 rounded-3xl p-8 sm:p-12 text-center text-slate-900 shadow-xl shadow-slate-200/50 space-y-5 animate-fadeIn">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center text-3xl mx-auto">
          ✓
        </div>
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">
            Votre demande d&apos;agent vocal est enregistrée !
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto mt-2 leading-relaxed">
            Merci <strong className="text-amber-700">{name}</strong>. Notre équipe étudie les besoins de{' '}
            <strong className="text-slate-900">{company || 'votre établissement'}</strong> pour préparer votre scénario d&apos;accueil personnalisé.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 max-w-md mx-auto space-y-1">
          <div className="font-bold text-slate-800">Prochaine étape :</div>
          <p>
            Nous vous contacterons par email ({email}) ou téléphone sous 24h ouvrées avec une démonstration sur-mesure.
          </p>
        </div>

        <button
          onClick={() => {
            setSubmitted(false);
            setName('');
            setCompany('');
            setPhone('');
            setEmail('');
            setNotes('');
          }}
          className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 border border-slate-200 transition-colors cursor-pointer"
        >
          Envoyer une autre demande
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 text-slate-900 shadow-xl shadow-slate-200/50 space-y-6"
    >
      <div className="border-b border-slate-100 pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
          Audit Gratuit &amp; Démonstration
        </span>
        <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2 tracking-tight">
          Demandez votre agent téléphonique sur-mesure
        </h3>
        <p className="text-xs sm:text-sm text-slate-500">
          Remplissez ce formulaire pour recevoir un scénario vocal adapté à votre métier sous 24h ouvrées.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Full Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">
            Votre Nom &amp; Prénom *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Dr. Martin ou Sophie Rénovation"
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Company / Cabinet */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">
            Nom de votre Cabinet ou Entreprise *
          </label>
          <input
            type="text"
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Cabinet Médical du Parc ou Rénov Habitat"
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">
            Numéro de téléphone de contact *
          </label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="06 00 00 00 00"
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">
            Adresse email professionnelle *
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@mon-entreprise.fr"
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Sector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">
            Secteur d&apos;activité
          </label>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-amber-500"
          >
            <option value="sante">Santé, Soins &amp; Cabinets Médicaux</option>
            <option value="btp">BTP, Rénovation &amp; Artisans du Bâtiment</option>
            <option value="depannage">Dépannage d&apos;Urgence (Plomberie, Serrurerie)</option>
            <option value="avocats">Avocats, Notaires &amp; Conseil Juridique</option>
            <option value="immobilier">Agences Immobilières &amp; Syndics</option>
            <option value="autre">PME, Commerce &amp; Autres Services</option>
          </select>
        </div>

        {/* Monthly Call Volume */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">
            Volume d&apos;appels mensuels estimé
          </label>
          <select
            value={callVolume}
            onChange={(e) => setCallVolume(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-amber-500"
          >
            <option value="lt-150">Moins de 150 appels / mois</option>
            <option value="150-500">150 à 500 appels / mois</option>
            <option value="500-1500">500 à 1 500 appels / mois</option>
            <option value="1500-plus">Plus de 1 500 appels / mois</option>
          </select>
        </div>
      </div>

      {/* Special Requests / Notes */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700">
          Besoins spécifiques ou particularités de votre accueil (optionnel)
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex : Synchronisation avec notre agenda Google/Doctolib, envoi de SMS pour les devis, gestion des urgences le soir..."
          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
        />
      </div>

      {initialPlan && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
          <span>🏷️</span> Formule sélectionnée :{' '}
          <strong className="text-slate-900 uppercase font-bold">{initialPlan}</strong>
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm transition-all shadow-md shadow-amber-500/20 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
        >
          {loading ? 'Enregistrement en cours...' : 'Demander mon Scénario & Audit Gratuit ➔'}
        </button>
        <p className="text-[11px] text-center text-slate-500 mt-2">
          🔒 Vos coordonnées restent strictement confidentielles. Zéro démarchage intempestif.
        </p>
      </div>
    </form>
  );
}
