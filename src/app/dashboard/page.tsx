import { db } from '@/lib/db';
import Link from 'next/link';
import { Prisma } from '@prisma/client';

export const instant = false;

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: { contact: true; patient: true };
}>;
type ServiceRequestWithContact = Prisma.ServiceRequestGetPayload<{
  include: { contact: true };
}>;
type CallRecordWithContact = Prisma.CallRecordGetPayload<{
  include: { contact: true };
}>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const currentTab = params.tab || 'overview';
  const currentFilter = params.filter || 'all';

  let appointments: AppointmentWithRelations[] = [];
  let serviceRequests: ServiceRequestWithContact[] = [];
  let callRecords: CallRecordWithContact[] = [];

  try {
    const results = await Promise.all([
      db.appointment.findMany({
        include: { contact: true, patient: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      db.serviceRequest.findMany({
        include: { contact: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      db.callRecord.findMany({
        include: { contact: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    appointments = results[0];
    serviceRequests = results[1];
    callRecords = results[2];
  } catch (err: unknown) {
    console.error('Database query error on dashboard:', err);
  }

  // Filtered lists
  const filteredAppointments = appointments.filter((a) => {
    if (currentFilter === 'confirmed') return a.status === 'CONFIRMED' || a.status === 'CONFIRMED_URGENT';
    if (currentFilter === 'pending') return a.status === 'PENDING';
    if (currentFilter === 'urgent') return a.status === 'CONFIRMED_URGENT';
    return true;
  });

  const filteredRequests = serviceRequests.filter((r) => {
    if (currentFilter === 'completed') return r.status === 'COMPLETED';
    if (currentFilter === 'pending') return r.status === 'NOT_COMPLETED';
    return true;
  });

  // Calculate clean, high-level business metrics
  const confirmedCount = appointments.filter(
    (a) => a.status === 'CONFIRMED' || a.status === 'CONFIRMED_URGENT'
  ).length;
  const pendingAppointmentsCount = appointments.filter((a) => a.status === 'PENDING').length;
  const urgentCount = appointments.filter((a) => a.status === 'CONFIRMED_URGENT').length;
  const devisCompletedCount = serviceRequests.filter((r) => r.status === 'COMPLETED').length;
  const devisPendingCount = serviceRequests.filter((r) => r.status === 'NOT_COMPLETED').length;
  const totalCallsCount = callRecords.length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              AI
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                Centre de Gestion d&apos;Appels
              </h1>
              <p className="text-xs text-slate-500">
                Cabinet Michelle &bull; Dani Bâtiment
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Assistants Vocaux Actifs
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* KPI Cards Row */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Card 1: Rendez-vous confirmés */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                RDV Confirmés
              </span>
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 text-sm">
                📅
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{confirmedCount}</span>
              {urgentCount > 0 && (
                <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                  {urgentCount} urgent{urgentCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Cabinet Michelle (Inscrits au planning)</p>
          </div>

          {/* Card 2: En attente de confirmation */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                RDV En Attente SMS
              </span>
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600 text-sm">
                💬
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-slate-900">{pendingAppointmentsCount}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">En attente de réponse du patient</p>
          </div>

          {/* Card 3: Devis complétés */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Devis Reçus &bull; JotForm
              </span>
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600 text-sm">
                🏗️
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{devisCompletedCount}</span>
              {devisPendingCount > 0 && (
                <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  {devisPendingCount} en attente
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Dani Bâtiment (Coordonnées complètes)</p>
          </div>

          {/* Card 4: Total appels traités */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Appels Traités
              </span>
              <span className="p-2 rounded-xl bg-purple-50 text-purple-600 text-sm">
                📞
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-slate-900">{totalCallsCount}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Flux vocaux gérés par IA</p>
          </div>
        </section>

        {/* Tab Controls */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-2">
          <nav className="flex gap-2">
            {[
              { id: 'overview', label: 'Vue d’ensemble', icon: '📊' },
              { id: 'appointments', label: `Cabinet Michelle — Rendez-vous (${appointments.length})`, icon: '🩺' },
              { id: 'requests', label: `Dani Bâtiment — Devis (${serviceRequests.length})`, icon: '🏗️' },
              { id: 'calls', label: `Journal d’appels (${callRecords.length})`, icon: '📞' },
            ].map((tab) => {
              const active = currentTab === tab.id;
              return (
                <Link
                  key={tab.id}
                  href={`/dashboard?tab=${tab.id}`}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    active
                      ? 'bg-blue-50 text-blue-700 shadow-2xs border border-blue-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </section>

        {/* TAB 1: OVERVIEW (Clean summary of both businesses) */}
        {currentTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Michelle Recent Appointments */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-sm">
                    🩺
                  </span>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Cabinet Michelle &bull; Rendez-vous récents</h2>
                    <p className="text-xs text-slate-500">Soins infirmiers à domicile</p>
                  </div>
                </div>
                <Link
                  href="/dashboard?tab=appointments"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Voir tout &rarr;
                </Link>
              </div>

              {appointments.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-slate-400 text-sm">Aucun rendez-vous pour le moment.</p>
                  <p className="text-xs text-slate-400 mt-1">Les appels entrants du Cabinet Michelle apparaîtront ici.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {appointments.slice(0, 5).map((appt) => (
                    <div key={appt.id} className="p-4 hover:bg-slate-50/60 transition-colors flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900">
                            {appt.contact?.name || 'Patient'}
                          </span>
                          {appt.status === 'CONFIRMED_URGENT' && (
                            <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-rose-100 text-rose-800">
                              Urgent
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {appt.serviceType || 'Soins'} &bull; {appt.contact?.phoneNumber}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-medium text-slate-700 block">
                          {appt.date} {appt.time && `à ${appt.time}`}
                        </span>
                        <span
                          className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            appt.status === 'CONFIRMED' || appt.status === 'CONFIRMED_URGENT'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : appt.status === 'REFUSED'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {appt.status === 'CONFIRMED' || appt.status === 'CONFIRMED_URGENT'
                            ? 'Confirmé'
                            : appt.status === 'REFUSED'
                            ? 'Refusé'
                            : 'En attente SMS'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dani Batiment Recent Requests */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-sm">
                    🏗️
                  </span>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Dani Bâtiment &bull; Devis & Demandes</h2>
                    <p className="text-xs text-slate-500">Artisan bâtiment & travaux</p>
                  </div>
                </div>
                <Link
                  href="/dashboard?tab=requests"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Voir tout &rarr;
                </Link>
              </div>

              {serviceRequests.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-slate-400 text-sm">Aucune demande de devis enregistrée.</p>
                  <p className="text-xs text-slate-400 mt-1">Les prospects appelant Dani Bâtiment s&apos;afficheront ici.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {serviceRequests.slice(0, 5).map((req) => (
                    <div key={req.id} className="p-4 hover:bg-slate-50/60 transition-colors flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="font-semibold text-sm text-slate-900">
                          {req.contact?.name || 'Client'}
                        </span>
                        <p className="text-xs text-slate-500">
                          {req.serviceType || 'Devis'} &bull; {req.contact?.phoneNumber}
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            req.status === 'COMPLETED'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {req.status === 'COMPLETED' ? 'Formulaire Reçu' : 'Lien SMS Envoyé'}
                        </span>
                        <span className="text-2xs text-slate-400 block mt-1">
                          {new Date(req.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: APPOINTMENTS FULL TABLE */}
        {currentTab === 'appointments' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-slate-900 text-lg">Rendez-vous &bull; Cabinet Michelle</h2>
                <p className="text-xs text-slate-500">Suivi des rendez-vous et confirmation par SMS</p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                {[
                  { id: 'all', label: 'Tous' },
                  { id: 'confirmed', label: 'Confirmés' },
                  { id: 'pending', label: 'En attente' },
                  { id: 'urgent', label: 'Urgents' },
                ].map((f) => (
                  <Link
                    key={f.id}
                    href={`/dashboard?tab=appointments&filter=${f.id}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      currentFilter === f.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-2xs uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-6">Patient</th>
                    <th className="py-3 px-6">Téléphone</th>
                    <th className="py-3 px-6">Date & Heure</th>
                    <th className="py-3 px-6">Type de Soin</th>
                    <th className="py-3 px-6">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAppointments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        Aucun rendez-vous correspondant au filtre.
                      </td>
                    </tr>
                  ) : (
                    filteredAppointments.map((appt) => (
                      <tr key={appt.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-6 font-semibold text-slate-900">
                          {appt.contact?.name || 'Patient Inconnu'}
                        </td>
                        <td className="py-4 px-6 text-slate-600 font-mono text-xs">
                          {appt.contact?.phoneNumber}
                        </td>
                        <td className="py-4 px-6 text-slate-800">
                          {appt.date} {appt.time && <span className="text-slate-500">à {appt.time}</span>}
                        </td>
                        <td className="py-4 px-6 text-slate-600">
                          {appt.serviceType || 'Soins Infirmiers'}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                              appt.status === 'CONFIRMED' || appt.status === 'CONFIRMED_URGENT'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : appt.status === 'REFUSED'
                                ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {appt.status === 'CONFIRMED_URGENT' && '🚨'}
                            {appt.status === 'CONFIRMED' || appt.status === 'CONFIRMED_URGENT'
                              ? 'Confirmé'
                              : appt.status === 'REFUSED'
                              ? 'Refusé'
                              : 'En attente SMS'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: DANI BATIMENT FULL TABLE */}
        {currentTab === 'requests' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-slate-900 text-lg">Demandes de Devis &bull; Dani Bâtiment</h2>
                <p className="text-xs text-slate-500">Envoi du formulaire JotForm par SMS et enrichissement CRM</p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                {[
                  { id: 'all', label: 'Toutes' },
                  { id: 'completed', label: 'Formulaire reçu' },
                  { id: 'pending', label: 'Lien SMS envoyé' },
                ].map((f) => (
                  <Link
                    key={f.id}
                    href={`/dashboard?tab=requests&filter=${f.id}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      currentFilter === f.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-2xs uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-6">Client</th>
                    <th className="py-3 px-6">Téléphone</th>
                    <th className="py-3 px-6">Motif</th>
                    <th className="py-3 px-6">Coordonnées / Adresse</th>
                    <th className="py-3 px-6">Statut Devis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        Aucune demande correspondant au filtre.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-6 font-semibold text-slate-900">
                          {req.contact?.name || 'Client Inconnu'}
                        </td>
                        <td className="py-4 px-6 text-slate-600 font-mono text-xs">
                          {req.contact?.phoneNumber}
                        </td>
                        <td className="py-4 px-6 text-slate-800">
                          <span className="font-medium">{req.serviceType || 'Devis'}</span>
                          {req.message && (
                            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{req.message}</p>
                          )}
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-600">
                          {req.address ? (
                            <span>{req.address} {req.postalCode && `(${req.postalCode})`}</span>
                          ) : (
                            <span className="text-slate-400 italic">En attente de saisie JotForm</span>
                          )}
                          {req.email && <div className="text-slate-500 mt-0.5">{req.email}</div>}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                              req.status === 'COMPLETED'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {req.status === 'COMPLETED' ? 'Formulaire Reçu' : 'Lien SMS Envoyé'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: CALL LOGS */}
        {currentTab === 'calls' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h2 className="font-bold text-slate-900 text-lg">Journal des Appels Vocaux</h2>
              <p className="text-xs text-slate-500">Historique des communications enregistrées par les assistants Vapi</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-2xs uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-6">Date & Heure</th>
                    <th className="py-3 px-6">Appelant</th>
                    <th className="py-3 px-6">Numéro</th>
                    <th className="py-3 px-6">Résumé de l&apos;Appel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {callRecords.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400">
                        Aucun appel enregistré pour l&apos;instant.
                      </td>
                    </tr>
                  ) : (
                    callRecords.map((call) => (
                      <tr key={call.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-6 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(call.createdAt).toLocaleString('fr-FR')}
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-900">
                          {call.contact?.name || 'Inconnu'}
                        </td>
                        <td className="py-4 px-6 text-slate-600 font-mono text-xs">
                          {call.callerNumber}
                        </td>
                        <td className="py-4 px-6 text-slate-700 text-xs">
                          {call.summary || 'Appel vocal enregistré'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
