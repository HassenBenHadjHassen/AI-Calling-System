import { db } from '@/lib/db';
import Link from 'next/link';

export const instant = false;

import { Prisma, WebhookEvent, NotificationJob } from '@prisma/client';

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
  searchParams: Promise<{ tab?: string; category?: string; status?: string }>;
}) {
  const params = await searchParams;
  const currentTab = params.tab || 'overview';

  let appointments: AppointmentWithRelations[] = [];
  let serviceRequests: ServiceRequestWithContact[] = [];
  let callRecords: CallRecordWithContact[] = [];
  let webhookEvents: WebhookEvent[] = [];
  let notificationJobs: NotificationJob[] = [];
  let dbError = '';

  try {
    const results = await Promise.all([
      db.business.findMany({ include: { assistants: true } }),
      db.appointment.findMany({
        include: { contact: true, patient: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.serviceRequest.findMany({
        include: { contact: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.callRecord.findMany({
        include: { contact: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.webhookEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.notificationJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    appointments = results[1];
    serviceRequests = results[2];
    callRecords = results[3];
    webhookEvents = results[4];
    notificationJobs = results[5];
  } catch (err: unknown) {
    dbError = err instanceof Error ? err.message : 'Database connection error';
  }

  // Calculate high-level KPIs
  const pendingAppointments = appointments.filter((a) => a.status === 'PENDING').length;
  const confirmedAppointments = appointments.filter(
    (a) => a.status === 'CONFIRMED' || a.status === 'CONFIRMED_URGENT'
  ).length;
  const pendingDevis = serviceRequests.filter(
    (r) => r.category === 'DEVIS' && r.status === 'NOT_COMPLETED'
  ).length;
  const completedDevis = serviceRequests.filter((r) => r.status === 'COMPLETED').length;
  const failedWebhooks = webhookEvents.filter((w) => w.status === 'FAILED').length;
  const failedNotifications = notificationJobs.filter((n) => n.status === 'FAILED').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between pb-8 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              AI Calling System — Mission Control
            </h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Supervision opérationnelle des flux d&apos;appels Cabinet Michelle & Dani Bâtiment
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            Node: {process.env.NODE_ENV || 'development'}
          </span>
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
            Prisma 7 Adapter
          </span>
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-950 text-amber-300 border border-amber-800">
            DRY_RUN: Active
          </span>
        </div>
      </header>

      {/* Database Connection Alert */}
      {dbError && (
        <div className="mt-6 p-4 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200">
          <h3 className="font-semibold text-amber-100 flex items-center gap-2">
            ⚠️ Base de données non connectée ou en attente d&apos;initialisation
          </h3>
          <p className="text-sm mt-1">
            Erreur: {dbError}. Assurez-vous que PostgreSQL est lancé et exécutez{' '}
            <code className="bg-amber-900/50 px-2 py-0.5 rounded text-amber-300 font-mono">
              npm run db:seed
            </code>
            .
          </p>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">RDV en attente</p>
          <p className="text-2xl font-bold text-amber-400 mt-2">{pendingAppointments}</p>
          <span className="text-xs text-slate-500">Cabinet Michelle</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">RDV confirmés</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{confirmedAppointments}</p>
          <span className="text-xs text-slate-500">Google Calendar</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Devis en attente</p>
          <p className="text-2xl font-bold text-cyan-400 mt-2">{pendingDevis}</p>
          <span className="text-xs text-slate-500">Lien JotForm envoyé</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Devis complétés</p>
          <p className="text-2xl font-bold text-blue-400 mt-2">{completedDevis}</p>
          <span className="text-xs text-slate-500">JotForm → CRM</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Erreurs Webhook</p>
          <p className="text-2xl font-bold text-rose-400 mt-2">{failedWebhooks}</p>
          <span className="text-xs text-slate-500">Événements en échec</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Erreurs SMS</p>
          <p className="text-2xl font-bold text-red-400 mt-2">{failedNotifications}</p>
          <span className="text-xs text-slate-500">File de retries</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <nav className="flex items-center gap-2 border-b border-slate-800 mt-10 pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Vue d’ensemble' },
          { id: 'appointments', label: `Rendez-vous (${appointments.length})` },
          { id: 'requests', label: `Dani Bâtiment (${serviceRequests.length})` },
          { id: 'calls', label: `Appels (${callRecords.length})` },
          { id: 'webhooks', label: `Webhooks (${webhookEvents.length})` },
          { id: 'notifications', label: `Notifications (${notificationJobs.length})` },
        ].map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={`/dashboard?tab=${tab.id}`}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Tab Contents */}
      <div className="mt-6">
        {/* TAB 1: OVERVIEW */}
        {currentTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cabinet Michelle Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg text-white">Cabinet Michelle (Infirmière)</h3>
                  <span className="px-2.5 py-0.5 rounded text-xs bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Santé
                  </span>
                </div>
                <div className="text-sm text-slate-400 space-y-2 mt-4">
                  <p>Assistant Vapi: <code className="text-xs font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-300">97808c43-384a-4f40-a8dd-9149ba4988f5</code></p>
                  <p>Téléphone d&apos;alerte (Infirmière): <span className="text-slate-200 font-mono">+33612857915</span></p>
                  <p>Calendrier Google: <span className="text-slate-200">monaldi2b@gmail.com</span></p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between text-xs text-slate-400">
                  <span>Derniers RDV reçus: {appointments.slice(0, 3).length}</span>
                  <Link href="/dashboard?tab=appointments" className="text-emerald-400 hover:underline">
                    Voir les rendez-vous →
                  </Link>
                </div>
              </div>

              {/* Dani Bâtiment Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg text-white">Dani Bâtiment (Travaux & Devis)</h3>
                  <span className="px-2.5 py-0.5 rounded text-xs bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Bâtiment
                  </span>
                </div>
                <div className="text-sm text-slate-400 space-y-2 mt-4">
                  <p>Assistant Vapi: <code className="text-xs font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-300">38a56410-a3b6-49d5-96f1-8cd572b3f81c</code></p>
                  <p>Numéro émetteur SMS: <span className="text-slate-200 font-mono">+33939036462</span></p>
                  <p>Formulaire JotForm: <span className="text-slate-200 truncate">https://form.jotform.com/260901590611047</span></p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between text-xs text-slate-400">
                  <span>Demandes actives: {serviceRequests.slice(0, 3).length}</span>
                  <Link href="/dashboard?tab=requests" className="text-cyan-400 hover:underline">
                    Voir les demandes →
                  </Link>
                </div>
              </div>
            </div>

            {/* Recent Live Activity */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-lg text-white mb-4">Dernières Activités Système</h3>
              {callRecords.length === 0 ? (
                <p className="text-sm text-slate-500">Aucun appel enregistré pour l&apos;instant.</p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {callRecords.slice(0, 5).map((call) => (
                    <div key={call.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-mono text-slate-300">{call.callerNumber}</span>
                        <span className="text-slate-500 mx-2">•</span>
                        <span className="text-slate-400">{call.summary || 'Appel vocal Vapi'}</span>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        {new Date(call.createdAt).toLocaleTimeString('fr-FR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: APPOINTMENTS */}
        {currentTab === 'appointments' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-semibold text-white">Rendez-vous Cabinet Michelle</h3>
              <span className="text-xs text-slate-400">{appointments.length} enregistrements</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Téléphone</th>
                    <th className="py-3 px-4">Date & Heure</th>
                    <th className="py-3 px-4">Soin</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4">Scam / Urgence</th>
                    <th className="py-3 px-4">Google Cal ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {appointments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Aucun rendez-vous trouvé dans la base de données.
                      </td>
                    </tr>
                  ) : (
                    appointments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-medium text-white">{a.contact?.name || 'Inconnu'}</td>
                        <td className="py-3 px-4 font-mono text-xs">{a.contact?.phoneNumber}</td>
                        <td className="py-3 px-4">{a.date} à {a.time}</td>
                        <td className="py-3 px-4">{a.serviceType}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              a.status === 'CONFIRMED' || a.status === 'CONFIRMED_URGENT'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : a.status === 'PENDING'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : a.status === 'SCAM'
                                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}
                          >
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1.5 items-center">
                            {a.urgency && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-red-950 text-red-300 border border-red-800">
                                URGENT
                              </span>
                            )}
                            <span className="text-xs text-slate-400">Score: {a.scamScore ?? 'N/A'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400 truncate max-w-[150px]">
                          {a.googleCalendarEventId || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SERVICE REQUESTS */}
        {currentTab === 'requests' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-semibold text-white">Demandes Dani Bâtiment</h3>
              <span className="text-xs text-slate-400">{serviceRequests.length} demandes</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Téléphone</th>
                    <th className="py-3 px-4">Motif</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4">Adresse</th>
                    <th className="py-3 px-4">Call ID</th>
                    <th className="py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {serviceRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Aucune demande trouvée.
                      </td>
                    </tr>
                  ) : (
                    serviceRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-medium text-white">{r.contact?.name || 'Client'}</td>
                        <td className="py-3 px-4 font-mono text-xs">{r.contact?.phoneNumber}</td>
                        <td className="py-3 px-4 font-semibold text-cyan-300">{r.category}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              r.status === 'COMPLETED'
                                ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                : r.status === 'NOT_COMPLETED'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400 max-w-[200px] truncate">
                          {r.address || '—'} {r.postalCode && `(${r.postalCode})`}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400 truncate max-w-[140px]">
                          {r.vapiCallId}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400">
                          {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: CALLS */}
        {currentTab === 'calls' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">Journal des Appels Vapi</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Call ID</th>
                    <th className="py-3 px-4">Numéro</th>
                    <th className="py-3 px-4">Assistant</th>
                    <th className="py-3 px-4">Résumé</th>
                    <th className="py-3 px-4">Date & Heure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {callRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Aucun appel enregistré.
                      </td>
                    </tr>
                  ) : (
                    callRecords.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono text-xs text-slate-400">{c.vapiCallId}</td>
                        <td className="py-3 px-4 font-mono text-xs text-white">{c.callerNumber}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400 truncate max-w-[120px]">{c.assistantId}</td>
                        <td className="py-3 px-4 text-xs text-slate-300 max-w-[300px] truncate">{c.summary || '—'}</td>
                        <td className="py-3 px-4 text-xs text-slate-400 font-mono">
                          {new Date(c.createdAt).toLocaleString('fr-FR')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: WEBHOOKS */}
        {currentTab === 'webhooks' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">Événements Webhook & Idempotence</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Clé d’Idempotence</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4">Essais</th>
                    <th className="py-3 px-4">Erreur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {webhookEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Aucun événement webhook reçu.
                      </td>
                    </tr>
                  ) : (
                    webhookEvents.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-semibold text-slate-200">{w.provider}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400 truncate max-w-[200px]">{w.eventKey}</td>
                        <td className="py-3 px-4 text-xs">{w.eventType}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              w.status === 'PROCESSED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : w.status === 'FAILED'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {w.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">{w.attemptCount}</td>
                        <td className="py-3 px-4 text-xs text-rose-400 max-w-[250px] truncate">{w.error || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: NOTIFICATIONS */}
        {currentTab === 'notifications' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">File de Notifications & Retries (Worker)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Canal</th>
                    <th className="py-3 px-4">Destinataire</th>
                    <th className="py-3 px-4">Message</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4">Essais</th>
                    <th className="py-3 px-4">Provider ID</th>
                    <th className="py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {notificationJobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Aucune notification dans la file.
                      </td>
                    </tr>
                  ) : (
                    notificationJobs.map((n) => (
                      <tr key={n.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-semibold text-slate-200">{n.channel}</td>
                        <td className="py-3 px-4 font-mono text-xs">{n.recipient}</td>
                        <td className="py-3 px-4 text-xs text-slate-300 max-w-[250px] truncate">{n.message}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              n.status === 'SENT'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : n.status === 'FAILED'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {n.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">{n.attemptCount}/{n.maxAttempts}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400 truncate max-w-[120px]">
                          {n.providerMessageId || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400 font-mono">
                          {new Date(n.createdAt).toLocaleTimeString('fr-FR')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
