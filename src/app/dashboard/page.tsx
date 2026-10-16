import { db } from '@/lib/db';
import Link from 'next/link';
import { Prisma } from '@prisma/client';
import DashboardCalendarTab from './calendar-tab';
import DashboardRoutingTab, { BusinessRoutingOverview } from './routing-tab';
import DashboardUsersTab, { UserAccount } from './users-tab';
import DashboardLogsTab, { SystemLogEntry, LogStats } from './logs-tab';
import UserNav from './user-nav';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { logger } from '@/lib/logger';
import { formatDisplayPhoneNumber, isRealPhoneNumber } from '@/lib/validation/phone';

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

function getTwentyFourHoursAgo(): Date {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

function PhoneNumber({ phone }: { phone?: string | null }) {
  if (!isRealPhoneNumber(phone)) {
    return <span className="italic text-slate-400">Numéro non renseigné</span>;
  }

  return <>{formatDisplayPhoneNumber(phone)}</>;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; filter?: string }>;
}) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session) {
    redirect('/login?callbackUrl=/dashboard');
  }

  // 1. Retrieve full user record to inspect role, assigned business, and allowed sections
  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      assignedBusiness: true,
      allowedSections: true,
    },
  });

  const assignedBusiness = dbUser?.assignedBusiness || 'ALL';
  const isMichelleOnly = assignedBusiness === 'CABINET_MICHELLE';
  const isDaniOnly = assignedBusiness === 'DANI_BATIMENT';
  const isAdmin = dbUser?.role === 'ADMIN';

  // Parse allowed sections
  const userAllowedSectionsRaw = dbUser?.allowedSections || 'ALL';
  const allowedSectionsList =
    userAllowedSectionsRaw === 'ALL'
      ? ['overview', 'routing', 'calendar', 'appointments', 'requests', 'calls', 'users', 'logs']
      : userAllowedSectionsRaw.split(',').map((s) => s.trim());

  // 2. Fetch business tenant references
  const [michelleBiz, daniBiz] = await Promise.all([
    db.business.findUnique({ where: { slug: 'CABINET_MICHELLE' } }),
    db.business.findUnique({ where: { slug: 'DANI_BATIMENT' } }),
  ]);

  let appointments: AppointmentWithRelations[] = [];
  let serviceRequests: ServiceRequestWithContact[] = [];
  let callRecords: CallRecordWithContact[] = [];
  let allUsers: UserAccount[] = [];
  let allBusinesses: BusinessRoutingOverview[] = [];
  let initialLogs: SystemLogEntry[] = [];
  let initialLogStats: LogStats = { total24h: 0, errors24h: 0, warnings24h: 0, webhooks24h: 0 };

  try {
    const fetchPromises: Promise<unknown>[] = [];

    // All businesses (for routing configuration)
    fetchPromises.push(
      db.business.findMany({
        select: {
          id: true,
          slug: true,
          name: true,
          inboundPhoneNumber: true,
          outboundPhoneNumber: true,
          routingEnabled: true,
          priorityTransferNumber: true,
        },
        orderBy: { name: 'asc' },
      }).then((data) => {
        allBusinesses = data;
      })
    );

    // Appointments (only if not restricted to Dani Bâtiment)
    if (!isDaniOnly) {
      fetchPromises.push(
        db.appointment.findMany({
          where: michelleBiz ? { businessId: michelleBiz.id } : undefined,
          include: { contact: true, patient: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }).then((data) => {
          appointments = data;
        })
      );
    }

    // Service Requests (only if not restricted to Cabinet Michelle)
    if (!isMichelleOnly) {
      fetchPromises.push(
        db.serviceRequest.findMany({
          where: daniBiz ? { businessId: daniBiz.id } : undefined,
          include: { contact: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }).then((data) => {
          serviceRequests = data;
        })
      );
    }

    // Call Records (filtered by assigned business)
    let callFilter: Prisma.CallRecordWhereInput | undefined;
    if (isMichelleOnly && michelleBiz) {
      callFilter = { businessId: michelleBiz.id };
    } else if (isDaniOnly && daniBiz) {
      callFilter = { businessId: daniBiz.id };
    }

    fetchPromises.push(
      db.callRecord.findMany({
        where: callFilter,
        include: { contact: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }).then((data) => {
        callRecords = data;
      })
    );

    // If Admin and has access to users tab, fetch all users
    if (isAdmin && allowedSectionsList.includes('users')) {
      fetchPromises.push(
        db.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            assignedBusiness: true,
            allowedSections: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        }).then((usersData) => {
          allUsers = usersData.map((u) => ({
            ...u,
            createdAt: u.createdAt.toISOString(),
          }));
        })
      );
    }

    // If Admin or authorized, fetch initial logs data
    if (isAdmin || allowedSectionsList.includes('logs')) {
      const twentyFourHoursAgo = getTwentyFourHoursAgo();
      fetchPromises.push(
        Promise.all([
          db.systemLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { business: { select: { id: true, name: true, slug: true } } },
          }),
          db.systemLog.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
          db.systemLog.count({ where: { level: 'ERROR', createdAt: { gte: twentyFourHoursAgo } } }),
          db.systemLog.count({ where: { level: 'WARN', createdAt: { gte: twentyFourHoursAgo } } }),
          db.systemLog.count({
            where: {
              module: { contains: 'WEBHOOK', mode: 'insensitive' },
              createdAt: { gte: twentyFourHoursAgo },
            },
          }),
        ]).then(([logsData, total24h, errors24h, warnings24h, webhooks24h]) => {
          initialLogs = logsData.map((l) => ({
            id: l.id,
            level: l.level as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
            module: l.module,
            message: l.message,
            correlationId: l.correlationId,
            businessId: l.businessId,
            business: l.business,
            metadata: l.metadata as Record<string, unknown> | null,
            createdAt: l.createdAt.toISOString(),
          }));
          initialLogStats = { total24h, errors24h, warnings24h, webhooks24h };
        })
      );
    }

    await Promise.all(fetchPromises);
  } catch (err: unknown) {
    logger.error('Database query error on dashboard', { module: 'DASHBOARD', error: err });
  }

  // 3. Define permitted tabs based on role, business scope, and allowed sections
  const allTabDefinitions = [
    {
      id: 'overview',
      label: 'Vue d’ensemble',
      icon: '01',
      visible: allowedSectionsList.includes('overview'),
    },
    {
      id: 'calendar',
      label: 'Planning & Calendrier Interne',
      icon: '02',
      visible: !isDaniOnly && allowedSectionsList.includes('calendar'),
    },
    {
      id: 'appointments',
      label: `Cabinet Michelle — Rendez-vous (${appointments.length})`,
      icon: '03',
      visible: !isDaniOnly && allowedSectionsList.includes('appointments'),
    },
    {
      id: 'requests',
      label: `Dani Bâtiment — Devis (${serviceRequests.length})`,
      icon: '04',
      visible: !isMichelleOnly && allowedSectionsList.includes('requests'),
    },
    {
      id: 'calls',
      label: `Journal d’appels (${callRecords.length})`,
      icon: '05',
      visible: allowedSectionsList.includes('calls'),
    },
    {
      id: 'routing',
      label: 'Routage des appels',
      icon: '06',
      visible:
        isAdmin ||
        allowedSectionsList.includes('routing') ||
        allowedSectionsList.includes('ALL') ||
        allBusinesses.some((business) => business.id === assignedBusiness || business.slug === assignedBusiness),
    },
    {
      id: 'users',
      label: 'Gestion des Accès & Comptes',
      icon: '07',
      visible: isAdmin && allowedSectionsList.includes('users'),
    },
    {
      id: 'logs',
      label: 'Journal & Logs Système',
      icon: '08',
      visible: isAdmin || allowedSectionsList.includes('logs'),
    },
  ];

  const permittedTabs = allTabDefinitions.filter((t) => t.visible);

  // Validate active tab
  const params = await searchParams;
  let currentTab = params.tab || permittedTabs[0]?.id || 'overview';
  const isTabPermitted = permittedTabs.some((t) => t.id === currentTab);
  if (!isTabPermitted && permittedTabs.length > 0) {
    currentTab = permittedTabs[0].id;
  }

  const currentFilter = params.filter || 'all';

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

  // Business metrics
  const confirmedCount = appointments.filter(
    (a) => a.status === 'CONFIRMED' || a.status === 'CONFIRMED_URGENT'
  ).length;
  const pendingAppointmentsCount = appointments.filter((a) => a.status === 'PENDING').length;
  const urgentCount = appointments.filter((a) => a.status === 'CONFIRMED_URGENT').length;
  const devisCompletedCount = serviceRequests.filter((r) => r.status === 'COMPLETED').length;
  const devisPendingCount = serviceRequests.filter((r) => r.status === 'NOT_COMPLETED').length;
  const totalCallsCount = callRecords.length;

  return (
    <div className="dashboard-shell min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="brand-mark flex items-center justify-center font-bold" aria-hidden="true">
              A/
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                {isMichelleOnly
                  ? 'Cabinet Michelle — Espace Soins'
                  : isDaniOnly
                  ? 'Dani Bâtiment — Espace Devis'
                  : 'Centre de Gestion d’Appels Multi-Tenants'}
              </h1>
              <p className="text-xs text-slate-500">
                {isMichelleOnly
                  ? 'Soins Infirmiers & Planning Médical'
                  : isDaniOnly
                  ? 'Chantiers, Rénovation & Devis Clients'
                  : 'Cabinet Michelle • Dani Bâtiment'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <UserNav
              user={{
                name: dbUser?.name || session.user.name,
                email: dbUser?.email || session.user.email,
                role: dbUser?.role,
                assignedBusiness: dbUser?.assignedBusiness,
              }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        <section className="dashboard-intro" aria-label="Bienvenue">
          <div>
            <h2>Bonjour, {(dbUser?.name || session.user.name || 'équipe').trim().split(/\s+/)[0]}</h2>
            <p>Les conversations qui comptent, dans un espace conçu pour décider vite.</p>
          </div>
        </section>

        {/* KPI Cards Row (Adapts dynamically to the assigned business) */}
        <section className="dashboard-kpis grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Michelle-only KPIs */}
          {isMichelleOnly ? (
            <>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">RDV Confirmés</span>
                  <span className="p-2 rounded-xl bg-teal-50 text-teal-600 text-sm">01</span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900">{confirmedCount}</span>
                  {urgentCount > 0 && (
                    <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                      {urgentCount} urgent{urgentCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Inscrits au planning de tournée</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">RDV En Attente SMS</span>
                  <span className="p-2 rounded-xl bg-amber-50 text-amber-600 text-sm">02</span>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-slate-900">{pendingAppointmentsCount}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Réponse OUI/NON du patient attendue</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Soins Urgents</span>
                  <span className="p-2 rounded-xl bg-rose-50 text-rose-600 text-sm">03</span>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-rose-700">{urgentCount}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Alerte SMS transmise à l’infirmière</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Appels Soins Reçus</span>
                  <span className="p-2 rounded-xl bg-blue-50 text-blue-600 text-sm">04</span>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-slate-900">{totalCallsCount}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Prise en charge par l&apos;assistante Michelle</p>
              </div>
            </>
          ) : isDaniOnly ? (
            /* Dani-only KPIs */
            <>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Devis Reçus & Complétés</span>
                  <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 text-sm">01</span>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-slate-900">{devisCompletedCount}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Formulaires clients remplis</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Devis En Attente Lien</span>
                  <span className="p-2 rounded-xl bg-amber-50 text-amber-600 text-sm">02</span>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-slate-900">{devisPendingCount}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Lien SMS transmis au client</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Demandes</span>
                  <span className="p-2 rounded-xl bg-blue-50 text-blue-600 text-sm">03</span>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-slate-900">{serviceRequests.length}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Rénovations, chantiers et suivis</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Appels Chantiers Reçus</span>
                  <span className="p-2 rounded-xl bg-purple-50 text-purple-600 text-sm">04</span>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-slate-900">{totalCallsCount}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Prise en charge par l&apos;assistant Dani</p>
              </div>
            </>
          ) : (
            /* Multi-tenant Combined KPIs */
            <>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">RDV Confirmés</span>
                  <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 text-sm">01</span>
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

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">RDV En Attente SMS</span>
                  <span className="p-2 rounded-xl bg-amber-50 text-amber-600 text-sm">02</span>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-slate-900">{pendingAppointmentsCount}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">En attente de réponse du patient</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Devis Reçus &bull; Portail</span>
                  <span className="p-2 rounded-xl bg-blue-50 text-blue-600 text-sm">03</span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900">{devisCompletedCount}</span>
                  {devisPendingCount > 0 && (
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      {devisPendingCount} en attente
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Dani Bâtiment (Portail web natif)</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Appels Traités</span>
                  <span className="p-2 rounded-xl bg-purple-50 text-purple-600 text-sm">04</span>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-slate-900">{totalCallsCount}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Flux vocaux gérés par IA</p>
              </div>
            </>
          )}
        </section>

        {/* Tab Controls (Only shows allowed and scoped tabs) */}
        <section className="dashboard-tabs bg-white rounded-2xl border border-slate-200/80 shadow-xs p-2">
          <nav className="flex flex-wrap gap-2">
            {permittedTabs.map((tab) => {
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

        {/* TAB: OVERVIEW */}
        {currentTab === 'overview' && (
          <div className={`grid grid-cols-1 ${!isMichelleOnly && !isDaniOnly ? 'lg:grid-cols-2' : ''} gap-8`}>
            {/* Michelle Recent Appointments (Shown for Michelle or SuperAdmin) */}
            {!isDaniOnly && (
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
                  {allowedSectionsList.includes('appointments') && (
                    <Link
                      href="/dashboard?tab=appointments"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Voir tout &rarr;
                    </Link>
                  )}
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
                            {appt.serviceType || 'Soins'} &bull; <PhoneNumber phone={appt.contact?.phoneNumber} />
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
            )}

            {/* Dani Batiment Recent Requests (Shown for Dani or SuperAdmin) */}
            {!isMichelleOnly && (
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
                  {allowedSectionsList.includes('requests') && (
                    <Link
                      href="/dashboard?tab=requests"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Voir tout &rarr;
                    </Link>
                  )}
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
                            {req.serviceType || 'Devis'} &bull; <PhoneNumber phone={req.contact?.phoneNumber} />
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
            )}
          </div>
        )}

        {/* TAB: CALENDAR (Cabinet Michelle only) */}
        {currentTab === 'calendar' && !isDaniOnly && (
          <DashboardCalendarTab appointments={appointments} />
        )}

        {/* TAB: APPOINTMENTS FULL TABLE (Cabinet Michelle) */}
        {currentTab === 'appointments' && !isDaniOnly && (
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
                          <PhoneNumber phone={appt.contact?.phoneNumber} />
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

        {/* TAB: REQUESTS FULL TABLE (Dani Bâtiment) */}
        {currentTab === 'requests' && !isMichelleOnly && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-slate-900 text-lg">Demandes de Devis &bull; Dani Bâtiment</h2>
                <p className="text-xs text-slate-500">Gestion des demandes et liens formulaires clients</p>
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
                          <PhoneNumber phone={req.contact?.phoneNumber} />
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
                            <span className="text-slate-400 italic">En attente de saisie du client</span>
                          )}
                          {req.email && <div className="text-slate-500 mt-0.5">{req.email}</div>}
                        </td>
                        <td className="py-4 px-6 space-y-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                              req.status === 'COMPLETED'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {req.status === 'COMPLETED' ? 'Formulaire Reçu' : 'Lien SMS Envoyé'}
                          </span>
                          <div className="pt-1">
                            <Link
                              href={`/devis/${encodeURIComponent(req.vapiCallId)}`}
                              target="_blank"
                              className="text-2xs font-semibold text-amber-600 hover:text-amber-700 underline inline-flex items-center gap-1"
                            >
                              <span>Ouvrir formulaire client</span>
                              <span>↗</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: CALL LOGS */}
        {currentTab === 'calls' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h2 className="font-bold text-slate-900 text-lg">Journal des Appels Vocaux</h2>
              <p className="text-xs text-slate-500">
                {isMichelleOnly
                  ? 'Historique des appels pour le Cabinet Michelle'
                  : isDaniOnly
                  ? 'Historique des appels pour Dani Bâtiment'
                  : 'Historique des communications enregistrées par les assistants vocaux'}
              </p>
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
                          <PhoneNumber phone={call.callerNumber} />
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

        {/* TAB: CALL ROUTING & WHITELIST/BLACKLIST */}
        {currentTab === 'routing' && (
          <DashboardRoutingTab
            initialBusinesses={allBusinesses}
            userRole={dbUser?.role || 'USER'}
            userAssignedBusiness={dbUser?.assignedBusiness || 'ALL'}
          />
        )}

        {/* TAB: USERS & PERMISSIONS MANAGEMENT (ADMIN ONLY) */}
        {currentTab === 'users' && isAdmin && (
          <DashboardUsersTab initialUsers={allUsers} currentUserId={session.user.id} />
        )}

        {/* TAB: SYSTEM LOGS & AUDIT TRAIL */}
        {currentTab === 'logs' && (isAdmin || allowedSectionsList.includes('logs')) && (
          <DashboardLogsTab initialLogs={initialLogs} initialStats={initialLogStats} />
        )}
      </main>
    </div>
  );
}
