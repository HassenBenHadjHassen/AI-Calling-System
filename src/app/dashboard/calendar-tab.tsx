'use client';

import { useState } from 'react';

interface AppointmentData {
  id: string;
  date: string;
  time: string;
  startTime: Date | string;
  endTime: Date | string;
  status: string;
  urgency: boolean;
  serviceType: string;
  notes?: string | null;
  googleCalendarEventId?: string | null;
  contact?: {
    name: string;
    phoneNumber: string;
  } | null;
}

export default function DashboardCalendarTab({
  appointments,
}: {
  appointments: AppointmentData[];
}) {
  const [copied, setCopied] = useState(false);
  const [isDownloadingIcs, setIsDownloadingIcs] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockTitle, setBlockTitle] = useState('Indisponible / Déplacement');
  const [blockDate, setBlockDate] = useState(new Date().toISOString().split('T')[0]);
  const [blockStartTime, setBlockStartTime] = useState('14:00');
  const [blockEndTime, setBlockEndTime] = useState('15:00');
  const [blockNotes, setBlockNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'confirmed' | 'urgent' | 'pending'>('all');

  const icalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/calendar/michelle.ics`
    : '/api/calendar/michelle.ics';

  const handleCopyIcal = async () => {
    try {
      await navigator.clipboard.writeText(icalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // fallback
    }
  };

  const handleDownloadIcs = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDownloadingIcs(true);
    try {
      const res = await fetch('/api/calendar/michelle.ics');
      if (!res.ok) throw new Error('Téléchargement échoué');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'michelle-calendar.ics');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (err) {
      console.error('Erreur téléchargement iCal:', err);
      window.open('/api/calendar/michelle.ics', '_blank');
    } finally {
      setIsDownloadingIcs(false);
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const startIso = `${blockDate}T${blockStartTime}:00Z`;
      const endIso = `${blockDate}T${blockEndTime}:00Z`;

      const res = await fetch('/api/calendar/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: blockTitle,
          start: startIso,
          end: endIso,
          notes: blockNotes,
        }),
      });

      if (res.ok) {
        setShowBlockModal(false);
        window.location.reload();
      } else {
        alert('Erreur lors du blocage du créneau');
      }
    } catch {
      alert('Erreur réseau');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = appointments.filter((a) => {
    if (activeFilter === 'confirmed') return a.status === 'CONFIRMED' || a.status === 'CONFIRMED_URGENT';
    if (activeFilter === 'urgent') return a.urgency || a.status === 'CONFIRMED_URGENT';
    if (activeFilter === 'pending') return a.status === 'PENDING';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Calendar Top Control Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
              Calendrier & Disponibilités Internes
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1">
            Planning Infirmier &bull; Cabinet Michelle
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Géré directement dans PostgreSQL. Zéro dépendance Google Calendar requise.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* S'abonner / Télécharger iCal Button */}
          <button
            id="btn-download-ical"
            type="button"
            onClick={handleDownloadIcs}
            disabled={isDownloadingIcs}
            className={`cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-2xs border ${
              downloadSuccess
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
            }`}
            title="Télécharger directement le fichier michelle-calendar.ics"
          >
            {isDownloadingIcs ? (
              <>
                <svg className="animate-spin -ml-0.5 mr-1 h-3.5 w-3.5 text-emerald-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Téléchargement en cours...</span>
              </>
            ) : downloadSuccess ? (
              <>
                <span>✅</span>
                <span>Fichier michelle-calendar.ics téléchargé !</span>
              </>
            ) : (
              <>
                <span>📱</span>
                <span>S’abonner sur iPhone/Android (iCal)</span>
              </>
            )}
          </button>

          {/* Copier URL du flux pour synchronisation continue */}
          <button
            id="btn-copy-ical"
            type="button"
            onClick={handleCopyIcal}
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors shadow-2xs"
            title="Copier l'URL directe du flux iCal pour synchronisation continue dans Google Agenda ou Apple Calendar"
          >
            <span>{copied ? '✅' : '🔗'}</span>
            <span>{copied ? 'Lien copié !' : 'Copier l’URL du flux'}</span>
          </button>

          {/* Bloquer Créneau Button */}
          <button
            id="btn-block-slot"
            type="button"
            onClick={() => setShowBlockModal(true)}
            className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors shadow-2xs"
          >
            <span>🔒</span>
            <span>Bloquer un créneau</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {[
          { id: 'all', label: `Tous (${appointments.length})` },
          { id: 'confirmed', label: 'Confirmés' },
          { id: 'urgent', label: 'Urgents' },
          { id: 'pending', label: 'En attente SMS' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActiveFilter(f.id as typeof activeFilter)}
            className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeFilter === f.id
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline Schedule Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
          <p className="text-3xl">🗓️</p>
          <p className="text-sm font-semibold text-slate-700">Aucun rendez-vous sur ce filtre.</p>
          <p className="text-xs text-slate-400">Les consultations confirmées par l&apos;assistante vocale s&apos;afficheront automatiquement.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((appt) => {
            const isConfirmed = appt.status === 'CONFIRMED' || appt.status === 'CONFIRMED_URGENT';
            const isUrgent = appt.urgency || appt.status === 'CONFIRMED_URGENT';
            const isBlocked = appt.serviceType?.startsWith('INDISPONIBLE');

            return (
              <div
                key={appt.id}
                className={`bg-white rounded-2xl border p-5 shadow-2xs hover:shadow-md transition-shadow space-y-3 ${
                  isUrgent
                    ? 'border-rose-300 ring-1 ring-rose-200'
                    : isBlocked
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      📅 {appt.date} {appt.time && `à ${appt.time}`}
                    </span>
                    <h3 className="font-bold text-base text-slate-900 leading-tight">
                      {isBlocked ? 'Créneau Bloqué' : (appt.contact?.name || 'Patient')}
                    </h3>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-2xs font-bold ${
                      isUrgent
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : isBlocked
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : isConfirmed
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {isUrgent ? 'Urgent' : isBlocked ? 'Bloqué' : isConfirmed ? 'Confirmé' : 'En attente'}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Prestation</span>
                    <span className="font-medium text-slate-800">{appt.serviceType || 'Soins'}</span>
                  </div>
                  {appt.contact?.phoneNumber && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Téléphone</span>
                      <span className="font-mono text-slate-700">{appt.contact.phoneNumber}</span>
                    </div>
                  )}
                  {appt.notes && (
                    <div className="pt-1 text-slate-500 border-t border-slate-200/60 line-clamp-2">
                      {appt.notes}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-2xs text-slate-400 pt-1">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    PostgreSQL Calendrier
                  </span>
                  <span className="font-mono">Réf: {appt.id.slice(0, 8)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Block Slot Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <span>🔒</span> Bloquer un créneau horaire
              </h3>
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Ce créneau sera immédiatement considéré comme indisponible par l&apos;assistante vocale lors des vérifications de rendez-vous.
            </p>

            <form onSubmit={handleCreateBlock} className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Motif du blocage</label>
                <input
                  type="text"
                  required
                  value={blockTitle}
                  onChange={(e) => setBlockTitle(e.target.value)}
                  placeholder="Ex: Pause déjeuner, Congés, Réunion"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Date</label>
                <input
                  type="date"
                  required
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Heure Début</label>
                  <input
                    type="time"
                    required
                    value={blockStartTime}
                    onChange={(e) => setBlockStartTime(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Heure Fin</label>
                  <input
                    type="time"
                    required
                    value={blockEndTime}
                    onChange={(e) => setBlockEndTime(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Notes facultatives</label>
                <input
                  type="text"
                  value={blockNotes}
                  onChange={(e) => setBlockNotes(e.target.value)}
                  placeholder="Détails internes..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBlockModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Confirmer le blocage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
