'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DateTime } from 'luxon';
import { formatDisplayPhoneNumber, isRealPhoneNumber } from '@/lib/validation/phone';

const TIMEZONE = 'Europe/Paris';

export interface AppointmentData {
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
  proposedNewTime?: string | null;
  scamScore?: number | null;
  createdAt?: Date | string;
  contact?: {
    id?: string;
    name: string;
    phoneNumber: string;
    email?: string | null;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    lineType?: string | null;
  } | null;
  patient?: {
    id?: string;
    medicalNotes?: string | null;
    isAllowlisted?: boolean;
  } | null;
}

type CalendarViewMode = 'agenda' | 'day' | 'week';
type AppointmentFilter = 'all' | 'confirmed' | 'pending' | 'urgent' | 'blocked';

interface StatusDisplayInfo {
  label: string;
  badgeClass: string;
  dotColor: string;
  borderAccent: string;
  isUrgent: boolean;
  isBlocked: boolean;
  isPending: boolean;
  isConfirmed: boolean;
}

// ==============================================================================
// ICONS (Consistent Inline SVG Icons)
// ==============================================================================

function CalendarIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v7.5" />
    </svg>
  );
}

function ClockIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function LockIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}

function PhoneIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
    </svg>
  );
}

function MapPinIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  );
}

function ChevronLeftIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  );
}

function ChevronRightIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function SearchIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function DownloadIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function CopyIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
    </svg>
  );
}

function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

function AlertTriangleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  );
}

function PlusIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function ListIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function UserIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

function CloseIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

// ==============================================================================
// BUSINESS HELPERS & STATUS CLASSIFIER
// ==============================================================================

function isBlockedTimeSlot(appt: AppointmentData): boolean {
  const st = (appt.serviceType || '').toUpperCase();
  return st.startsWith('INDISPONIBLE') || st.startsWith('BLOQUÉ') || st.startsWith('BLOQUE');
}

function getBlockedSlotDetails(appt: AppointmentData): { title: string; reason: string } {
  const raw = appt.serviceType || 'Créneau indisponible';
  const title = raw.replace(/^(INDISPONIBLE|BLOQUÉ|BLOQUE)\s*:\s*/i, '').trim() || 'Indisponibilité';
  const reason = (appt.notes || '').trim() || 'Créneau bloqué pour le cabinet';
  return { title, reason };
}

function getAppointmentDisplayStatus(appt: AppointmentData): StatusDisplayInfo {
  const blocked = isBlockedTimeSlot(appt);

  if (blocked) {
    return {
      label: 'Indisponible',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 font-medium',
      dotColor: 'bg-slate-400',
      borderAccent: 'border-l-slate-400',
      isUrgent: false,
      isBlocked: true,
      isPending: false,
      isConfirmed: false,
    };
  }

  const isUrgent = Boolean(appt.urgency || appt.status === 'CONFIRMED_URGENT');

  if (isUrgent) {
    return {
      label: appt.status === 'CONFIRMED' || appt.status === 'CONFIRMED_URGENT' ? 'Confirmé • Urgent' : 'Urgent',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 font-semibold',
      dotColor: 'bg-rose-500',
      borderAccent: 'border-l-rose-500',
      isUrgent: true,
      isBlocked: false,
      isPending: appt.status === 'PENDING' || appt.status === 'PENDING_LANDLINE',
      isConfirmed: appt.status === 'CONFIRMED' || appt.status === 'CONFIRMED_URGENT',
    };
  }

  switch (appt.status) {
    case 'CONFIRMED':
      return {
        label: 'Confirmé',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-medium',
        dotColor: 'bg-emerald-500',
        borderAccent: 'border-l-emerald-500',
        isUrgent: false,
        isBlocked: false,
        isPending: false,
        isConfirmed: true,
      };

    case 'PENDING':
      return {
        label: 'En attente SMS',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 font-medium',
        dotColor: 'bg-amber-500',
        borderAccent: 'border-l-amber-500',
        isUrgent: false,
        isBlocked: false,
        isPending: true,
        isConfirmed: false,
      };

    case 'PENDING_LANDLINE':
      return {
        label: 'À valider (Fixe)',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 font-medium',
        dotColor: 'bg-amber-500',
        borderAccent: 'border-l-amber-500',
        isUrgent: false,
        isBlocked: false,
        isPending: true,
        isConfirmed: false,
      };

    case 'RESCHEDULE_PROPOSED':
      return {
        label: 'Report proposé',
        badgeClass: 'bg-sky-50 text-sky-800 border-sky-200 font-medium',
        dotColor: 'bg-sky-500',
        borderAccent: 'border-l-sky-500',
        isUrgent: false,
        isBlocked: false,
        isPending: true,
        isConfirmed: false,
      };

    case 'REFUSED':
      return {
        label: 'Refusé',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 font-medium',
        dotColor: 'bg-slate-400',
        borderAccent: 'border-l-slate-300',
        isUrgent: false,
        isBlocked: false,
        isPending: false,
        isConfirmed: false,
      };

    case 'CANCELLED':
      return {
        label: 'Annulé',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 font-medium',
        dotColor: 'bg-slate-400',
        borderAccent: 'border-l-slate-300',
        isUrgent: false,
        isBlocked: false,
        isPending: false,
        isConfirmed: false,
      };

    case 'SCAM':
      return {
        label: 'Spam / Bloqué',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 font-medium',
        dotColor: 'bg-slate-500',
        borderAccent: 'border-l-slate-400',
        isUrgent: false,
        isBlocked: false,
        isPending: false,
        isConfirmed: false,
      };

    default:
      return {
        label: appt.status || 'À valider',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 font-medium',
        dotColor: 'bg-amber-500',
        borderAccent: 'border-l-amber-400',
        isUrgent: false,
        isBlocked: false,
        isPending: true,
        isConfirmed: false,
      };
  }
}

// ==============================================================================
// TIMEZONE & LOCALIZATION (Europe/Paris)
// ==============================================================================

function getAppointmentStartDateTime(appt: AppointmentData): DateTime {
  if (appt.startTime) {
    if (typeof appt.startTime === 'string') {
      const parsed = DateTime.fromISO(appt.startTime, { zone: TIMEZONE });
      if (parsed.isValid) return parsed;
    } else if (appt.startTime instanceof Date) {
      const parsed = DateTime.fromJSDate(appt.startTime, { zone: TIMEZONE });
      if (parsed.isValid) return parsed;
    }
  }

  const cleanDate = appt.date || DateTime.now().setZone(TIMEZONE).toFormat('yyyy-MM-dd');
  const cleanTime = (appt.time || '09:00').replace(/h/i, ':');
  const [h = '09', m = '00'] = cleanTime.split(':');
  const combined = `${cleanDate}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`;
  const parsed = DateTime.fromISO(combined, { zone: TIMEZONE });
  return parsed.isValid ? parsed : DateTime.now().setZone(TIMEZONE);
}

function getAppointmentEndDateTime(appt: AppointmentData, startDt: DateTime): DateTime {
  if (appt.endTime) {
    if (typeof appt.endTime === 'string') {
      const parsed = DateTime.fromISO(appt.endTime, { zone: TIMEZONE });
      if (parsed.isValid) return parsed;
    } else if (appt.endTime instanceof Date) {
      const parsed = DateTime.fromJSDate(appt.endTime, { zone: TIMEZONE });
      if (parsed.isValid) return parsed;
    }
  }
  return startDt.plus({ hours: 1 });
}

function formatFrenchDateHeading(dateStr: string): string {
  const dt = DateTime.fromISO(dateStr, { zone: TIMEZONE }).setLocale('fr');
  if (!dt.isValid) return dateStr;
  const formatted = dt.toFormat("cccc d MMMM yyyy");
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getRelativeDateLabel(dateStr: string): string | null {
  const now = DateTime.now().setZone(TIMEZONE);
  const target = DateTime.fromISO(dateStr, { zone: TIMEZONE });
  if (!target.isValid) return null;
  if (target.hasSame(now, 'day')) return "Aujourd'hui";
  if (target.hasSame(now.plus({ days: 1 }), 'day')) return 'Demain';
  if (target.hasSame(now.minus({ days: 1 }), 'day')) return 'Hier';
  return null;
}

function formatDuration(startDt: DateTime, endDt: DateTime): string {
  const mins = Math.max(15, Math.round(endDt.diff(startDt, 'minutes').minutes));
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hours}h${remMins.toString().padStart(2, '0')}` : `${hours}h00`;
  }
  return `${mins} min`;
}

// ==============================================================================
// MAIN COMPONENT
// ==============================================================================

export default function DashboardCalendarTab({
  appointments,
}: {
  appointments: AppointmentData[];
}) {
  const todayParis = useMemo(() => DateTime.now().setZone(TIMEZONE).toFormat('yyyy-MM-dd'), []);

  // View & Navigation State
  const [activeView, setActiveView] = useState<CalendarViewMode>('agenda');
  const [selectedDate, setSelectedDate] = useState<string>(todayParis);
  const [activeFilter, setActiveFilter] = useState<AppointmentFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Panels
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showSyncMenu, setShowSyncMenu] = useState(false);
  const syncMenuRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Sync Actions State
  const [copied, setCopied] = useState(false);
  const [isDownloadingIcs, setIsDownloadingIcs] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Block Modal Form State
  const [blockTitle, setBlockTitle] = useState('Indisponible / Déplacement');
  const [blockDate, setBlockDate] = useState(todayParis);
  const [blockStartTime, setBlockStartTime] = useState('14:00');
  const [blockEndTime, setBlockEndTime] = useState('15:00');
  const [blockNotes, setBlockNotes] = useState('');
  const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  const icalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/calendar/michelle.ics`
    : '/api/calendar/michelle.ics';

  // Close sync menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (syncMenuRef.current && !syncMenuRef.current.contains(event.target as Node)) {
        setShowSyncMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      link.setAttribute('download', 'cabinet-michel-planning.ics');
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
    setIsSubmittingBlock(true);
    setBlockError(null);
    try {
      // Safe conversion using Europe/Paris to ensure no UTC displacement
      const startDt = DateTime.fromFormat(`${blockDate} ${blockStartTime}`, 'yyyy-MM-dd HH:mm', { zone: TIMEZONE });
      const endDt = DateTime.fromFormat(`${blockDate} ${blockEndTime}`, 'yyyy-MM-dd HH:mm', { zone: TIMEZONE });

      if (!startDt.isValid || !endDt.isValid) {
        throw new Error('Date ou horaires invalides');
      }

      if (endDt <= startDt) {
        throw new Error("L'heure de fin doit être postérieure à l'heure de début");
      }

      const res = await fetch('/api/calendar/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: blockTitle.trim(),
          start: startDt.toUTC().toISO(),
          end: endDt.toUTC().toISO(),
          notes: blockNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Erreur lors de l’enregistrement du créneau');
      }

      setShowBlockModal(false);
      window.location.reload();
    } catch (err: unknown) {
      setBlockError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsSubmittingBlock(false);
    }
  };

  // Date navigation handlers
  const handleJumpToToday = () => {
    setSelectedDate(todayParis);
  };

  const handlePrevDate = () => {
    const current = DateTime.fromISO(selectedDate, { zone: TIMEZONE });
    if (activeView === 'week') {
      setSelectedDate(current.minus({ weeks: 1 }).toFormat('yyyy-MM-dd'));
    } else {
      setSelectedDate(current.minus({ days: 1 }).toFormat('yyyy-MM-dd'));
    }
  };

  const handleNextDate = () => {
    const current = DateTime.fromISO(selectedDate, { zone: TIMEZONE });
    if (activeView === 'week') {
      setSelectedDate(current.plus({ weeks: 1 }).toFormat('yyyy-MM-dd'));
    } else {
      setSelectedDate(current.plus({ days: 1 }).toFormat('yyyy-MM-dd'));
    }
  };

  // Counts for filter pills
  const counts = useMemo(() => {
    let confirmed = 0;
    let pending = 0;
    let urgent = 0;
    let blocked = 0;

    for (const a of appointments) {
      if (isBlockedTimeSlot(a)) {
        blocked++;
      } else {
        const isUrg = Boolean(a.urgency || a.status === 'CONFIRMED_URGENT');
        if (isUrg) urgent++;
        if (a.status === 'CONFIRMED' || a.status === 'CONFIRMED_URGENT') confirmed++;
        if (a.status === 'PENDING' || a.status === 'PENDING_LANDLINE' || a.status === 'RESCHEDULE_PROPOSED') pending++;
      }
    }

    return { total: appointments.length, confirmed, pending, urgent, blocked };
  }, [appointments]);

  // Master Filter & Search
  const filteredAppointments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return appointments.filter((appt) => {
      const blocked = isBlockedTimeSlot(appt);
      const isUrgent = Boolean(appt.urgency || appt.status === 'CONFIRMED_URGENT');

      // Status Filter
      if (activeFilter === 'confirmed') {
        if (blocked || (!isUrgent && appt.status !== 'CONFIRMED')) return false;
        if (appt.status !== 'CONFIRMED' && appt.status !== 'CONFIRMED_URGENT') return false;
      } else if (activeFilter === 'pending') {
        if (blocked) return false;
        if (appt.status !== 'PENDING' && appt.status !== 'PENDING_LANDLINE' && appt.status !== 'RESCHEDULE_PROPOSED') return false;
      } else if (activeFilter === 'urgent') {
        if (blocked || !isUrgent) return false;
      } else if (activeFilter === 'blocked') {
        if (!blocked) return false;
      }

      // Search Query Filter
      if (query) {
        const patientName = (appt.contact?.name || '').toLowerCase();
        const phone = (appt.contact?.phoneNumber || '').toLowerCase();
        const service = (appt.serviceType || '').toLowerCase();
        const postal = (appt.contact?.postalCode || '').toLowerCase();
        const city = (appt.contact?.city || '').toLowerCase();
        const notes = (appt.notes || '').toLowerCase();

        const match =
          patientName.includes(query) ||
          phone.includes(query) ||
          service.includes(query) ||
          postal.includes(query) ||
          city.includes(query) ||
          notes.includes(query);

        if (!match) return false;
      }

      return true;
    });
  }, [appointments, activeFilter, searchQuery]);

  // Chronological Grouping by Date
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, AppointmentData[]>();

    for (const appt of filteredAppointments) {
      const startDt = getAppointmentStartDateTime(appt);
      const dateKey = startDt.toFormat('yyyy-MM-dd');

      const existing = groups.get(dateKey) || [];
      existing.push(appt);
      groups.set(dateKey, existing);
    }

    // Sort entries within each day chronologically
    for (const [key, items] of groups.entries()) {
      items.sort((a, b) => {
        const startA = getAppointmentStartDateTime(a).toMillis();
        const startB = getAppointmentStartDateTime(b).toMillis();
        return startA - startB;
      });
      groups.set(key, items);
    }

    // Sort dates chronologically
    const sortedDates = Array.from(groups.keys()).sort();
    return sortedDates.map((date) => ({
      date,
      items: groups.get(date) || [],
    }));
  }, [filteredAppointments]);

  // Appointments for the Single Day View
  const singleDayItems = useMemo(() => {
    return filteredAppointments
      .filter((appt) => {
        const startDt = getAppointmentStartDateTime(appt);
        return startDt.toFormat('yyyy-MM-dd') === selectedDate;
      })
      .sort((a, b) => {
        return getAppointmentStartDateTime(a).toMillis() - getAppointmentStartDateTime(b).toMillis();
      });
  }, [filteredAppointments, selectedDate]);

  // Days for the Week View
  const weekDays = useMemo(() => {
    const selectedDt = DateTime.fromISO(selectedDate, { zone: TIMEZONE });
    const weekStart = selectedDt.startOf('week'); // Monday in France

    const days = [];
    for (let i = 0; i < 7; i++) {
      const dayDt = weekStart.plus({ days: i });
      const dateStr = dayDt.toFormat('yyyy-MM-dd');

      const dayItems = filteredAppointments
        .filter((appt) => {
          const startDt = getAppointmentStartDateTime(appt);
          return startDt.toFormat('yyyy-MM-dd') === dateStr;
        })
        .sort((a, b) => getAppointmentStartDateTime(a).toMillis() - getAppointmentStartDateTime(b).toMillis());

      days.push({
        dt: dayDt,
        dateStr,
        dayName: dayDt.setLocale('fr').toFormat('EEE'),
        dayNumber: dayDt.toFormat('d'),
        monthName: dayDt.setLocale('fr').toFormat('MMM'),
        isToday: dateStr === todayParis,
        isSelected: dateStr === selectedDate,
        items: dayItems,
      });
    }

    return days;
  }, [selectedDate, filteredAppointments, todayParis]);

  // Selected date heading text for navigation bar
  const navigationDateLabel = useMemo(() => {
    const dt = DateTime.fromISO(selectedDate, { zone: TIMEZONE }).setLocale('fr');
    if (activeView === 'week') {
      const start = dt.startOf('week');
      const end = dt.endOf('week');
      return `Semaine du ${start.toFormat('d MMMM')} au ${end.toFormat('d MMMM yyyy')}`;
    }
    if (activeView === 'day') {
      const formatted = dt.toFormat("cccc d MMMM yyyy");
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
    return `Agenda &bull; ${filteredAppointments.length} intervention${filteredAppointments.length > 1 ? 's' : ''}`;
  }, [selectedDate, activeView, filteredAppointments.length]);

  return (
    <div className="space-y-6 text-slate-800">
      {/* ============================================================================== */}
      {/* 1. PAGE HEADER & CONTROL BAR */}
      {/* ============================================================================== */}
      <header className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          {/* Title & Medical Identity */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                Planning Médical
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Planning des soins
            </h2>
            <p className="text-xs text-slate-500">
              Tournées de soins infirmiers, consultations et gestion des disponibilités
            </p>
          </div>

          {/* Primary & Secondary Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Primary Action: Bloquer un créneau */}
            <button
              id="btn-block-slot"
              type="button"
              onClick={() => {
                setBlockDate(selectedDate || todayParis);
                setShowBlockModal(true);
              }}
              className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-xs focus:ring-2 focus:ring-slate-900/20"
            >
              <LockIcon className="w-3.5 h-3.5 text-slate-300" />
              <span>Bloquer un créneau</span>
            </button>

            {/* Unobtrusive Synchronization Menu */}
            <div className="relative" ref={syncMenuRef}>
              <button
                id="btn-sync-menu"
                type="button"
                onClick={() => setShowSyncMenu(!showSyncMenu)}
                className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors shadow-2xs focus:ring-2 focus:ring-slate-400/20"
                aria-expanded={showSyncMenu}
                title="Options de synchronisation"
              >
                <CalendarIcon className="w-4 h-4 text-slate-500" />
                <span>Synchronisation</span>
                <ChevronRightIcon className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showSyncMenu ? 'rotate-90' : ''}`} />
              </button>

              {showSyncMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-30 space-y-1">
                  <div className="px-3 py-2 text-2xs text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-100">
                    Synchronisation de l’agenda
                  </div>

                  <button
                    id="btn-download-ics"
                    type="button"
                    onClick={handleDownloadIcs}
                    disabled={isDownloadingIcs}
                    className="w-full cursor-pointer flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <DownloadIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-800">
                        {isDownloadingIcs ? 'Téléchargement...' : downloadSuccess ? 'Fichier téléchargé !' : 'Télécharger le calendrier'}
                      </p>
                      <p className="text-2xs text-slate-400">Pour Apple Agenda, Google ou Outlook</p>
                    </div>
                  </button>

                  <button
                    id="btn-copy-ical-link"
                    type="button"
                    onClick={handleCopyIcal}
                    className="w-full cursor-pointer flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {copied ? (
                      <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <CopyIcon className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold text-slate-800">{copied ? 'Lien copié !' : 'Copier le lien de synchronisation'}</p>
                      <p className="text-2xs text-slate-400">Pour synchronisation automatique en direct</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Date Navigation & View Switcher Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleJumpToToday}
              className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              Aujourd&apos;hui
            </button>

            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5">
              <button
                type="button"
                onClick={handlePrevDate}
                className="cursor-pointer p-1.5 rounded-md hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                title="Période précédente"
                aria-label="Période précédente"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextDate}
                className="cursor-pointer p-1.5 rounded-md hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                title="Période suivante"
                aria-label="Période suivante"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Date Display and Direct Picker Trigger */}
            <div className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={() => dateInputRef.current?.showPicker ? dateInputRef.current.showPicker() : dateInputRef.current?.focus()}
                className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                title="Choisir une date spécifique"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate max-w-[240px] sm:max-w-none">{navigationDateLabel}</span>
              </button>

              {/* Hidden Native Date Input for Direct Picker */}
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value);
                }}
                className="sr-only"
                aria-label="Sélectionner une date"
              />
            </div>
          </div>

          {/* View Switcher: Jour, Semaine, Liste */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveView('agenda')}
              className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'agenda'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span>Liste</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('day')}
              className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'day'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClockIcon className="w-3.5 h-3.5" />
              <span>Jour</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('week')}
              className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'week'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Semaine</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================================== */}
      {/* 2. FILTERS & SEARCH ROW */}
      {/* ============================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Semantic Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Tous ({counts.total})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('confirmed')}
            className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeFilter === 'confirmed'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeFilter === 'confirmed' ? 'bg-white' : 'bg-emerald-500'}`} />
            Confirmés ({counts.confirmed})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('pending')}
            className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeFilter === 'pending'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeFilter === 'pending' ? 'bg-white' : 'bg-amber-500'}`} />
            En attente SMS ({counts.pending})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('urgent')}
            className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeFilter === 'urgent'
                ? 'bg-rose-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeFilter === 'urgent' ? 'bg-white' : 'bg-rose-500'}`} />
            Urgents ({counts.urgent})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('blocked')}
            className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeFilter === 'blocked'
                ? 'bg-slate-700 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <LockIcon className="w-3 h-3 text-slate-400" />
            Indisponibilités ({counts.blocked})
          </button>
        </div>

        {/* Live Search Input */}
        <div className="relative w-full md:w-64">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un patient, soin, CP..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 placeholder-slate-400 text-slate-800 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              title="Effacer"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ============================================================================== */}
      {/* 3. VIEW RENDERER (Agenda, Day, or Week) */}
      {/* ============================================================================== */}

      {/* VIEW: AGENDA (Chronological List - Default) */}
      {activeView === 'agenda' && (
        <div className="space-y-8">
          {groupedByDate.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-semibold text-slate-800">Aucun rendez-vous sur ce filtre</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchQuery
                  ? `Aucun résultat pour "${searchQuery}". Essayez un autre terme de recherche.`
                  : "Les rendez-vous confirmés par l'assistante vocale ou programmés s'afficheront ici."}
              </p>
              {(searchQuery || activeFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFilter('all');
                  }}
                  className="cursor-pointer text-xs font-semibold text-slate-900 underline hover:text-slate-700 pt-1 inline-block"
                >
                  Réinitialiser tous les filtres
                </button>
              )}
            </div>
          ) : (
            groupedByDate.map(({ date, items }) => {
              const dateHeading = formatFrenchDateHeading(date);
              const relativeBadge = getRelativeDateLabel(date);
              const hasUrgent = items.some((i) => i.urgency || i.status === 'CONFIRMED_URGENT');

              return (
                <section key={date} className="space-y-3">
                  {/* Date Section Header */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-sm font-bold text-slate-900">{dateHeading}</h3>
                      {relativeBadge && (
                        <span className={`px-2 py-0.5 rounded-full text-2xs font-bold border ${
                          relativeBadge === "Aujourd'hui"
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {relativeBadge}
                        </span>
                      )}
                      {hasUrgent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangleIcon className="w-3 h-3 text-rose-600" />
                          Urgence
                        </span>
                      )}
                    </div>
                    <span className="text-2xs font-semibold text-slate-400">
                      {items.length} entrée{items.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Chronological Entries */}
                  <div className="space-y-2.5">
                    {items.map((appt) => {
                      const blocked = isBlockedTimeSlot(appt);
                      const statusInfo = getAppointmentDisplayStatus(appt);
                      const startDt = getAppointmentStartDateTime(appt);
                      const endDt = getAppointmentEndDateTime(appt, startDt);
                      const startTimeStr = startDt.toFormat('HH:mm');
                      const endTimeStr = endDt.toFormat('HH:mm');
                      const durationStr = formatDuration(startDt, endDt);

                      if (blocked) {
                        const { title, reason } = getBlockedSlotDetails(appt);
                        return (
                          <div
                            key={appt.id}
                            className="bg-slate-50/80 hover:bg-slate-100/80 rounded-xl border border-slate-200 border-l-4 border-l-slate-400 p-3.5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                          >
                            <div className="flex items-start sm:items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-slate-200/80 text-slate-600 flex items-center justify-center shrink-0">
                                <LockIcon className="w-4 h-4 text-slate-600" />
                              </div>
                              <div className="space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-slate-900">
                                    {startTimeStr} &mdash; {endTimeStr}
                                  </span>
                                  <span className="text-2xs text-slate-500 font-medium">({durationStr})</span>
                                  <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-slate-200 text-slate-700 border border-slate-300">
                                    Indisponible
                                  </span>
                                </div>
                                <h4 className="text-xs font-bold text-slate-800">{title}</h4>
                                {reason && <p className="text-2xs text-slate-500 line-clamp-1">{reason}</p>}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center">
                              <button
                                type="button"
                                onClick={() => setSelectedAppointment(appt)}
                                className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
                              >
                                Détails
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // Patient Appointment Row
                      const formattedPhone = formatDisplayPhoneNumber(appt.contact?.phoneNumber);
                      const isRealPhone = isRealPhoneNumber(appt.contact?.phoneNumber);

                      return (
                        <div
                          key={appt.id}
                          className={`bg-white hover:bg-slate-50/60 rounded-xl border border-slate-200 border-l-4 ${statusInfo.borderAccent} p-4 transition-all shadow-2xs hover:shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3`}
                        >
                          {/* Time Column + Patient Main Information */}
                          <div className="flex items-start gap-4 flex-1">
                            {/* Prominent Start Time */}
                            <div className="w-16 shrink-0 text-left pt-0.5">
                              <span className="font-mono text-base font-extrabold text-slate-900 block leading-tight">
                                {startTimeStr}
                              </span>
                              <span className="font-mono text-2xs text-slate-500 block">
                                {endTimeStr} &bull; {durationStr}
                              </span>
                            </div>

                            {/* Center Content: Patient, Service, Phone, Postal Code */}
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-bold text-sm text-slate-900 leading-snug">
                                  {appt.contact?.name || 'Patient'}
                                </h4>

                                {/* Status Badge */}
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs border ${statusInfo.badgeClass}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
                                  <span>{statusInfo.label}</span>
                                </span>

                                {statusInfo.isUrgent && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                    <AlertTriangleIcon className="w-3 h-3 text-rose-600" />
                                    Prioritaire
                                  </span>
                                )}
                              </div>

                              {/* Care / Service Type */}
                              <p className="text-xs font-semibold text-slate-700 truncate">
                                {appt.serviceType || 'Soins Infirmiers'}
                              </p>

                              {/* Metadata Row: Phone, Postal Code, Notes Preview */}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-0.5">
                                {/* Sanitized Phone */}
                                {isRealPhone && formattedPhone ? (
                                  <a
                                    href={`tel:${appt.contact?.phoneNumber}`}
                                    className="inline-flex items-center gap-1 font-mono text-slate-600 hover:text-blue-600 transition-colors"
                                    title="Appeler le patient"
                                  >
                                    <PhoneIcon className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{formattedPhone}</span>
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-slate-400 italic">
                                    <PhoneIcon className="w-3.5 h-3.5 text-slate-300" />
                                    <span>Numéro non renseigné</span>
                                  </span>
                                )}

                                {/* Postal Code Badge */}
                                {appt.contact?.postalCode && (
                                  <span className="inline-flex items-center gap-1 font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-2xs font-semibold border border-slate-200">
                                    <MapPinIcon className="w-3 h-3 text-slate-500" />
                                    <span>{appt.contact.postalCode}{appt.contact.city ? ` ${appt.contact.city}` : ''}</span>
                                  </span>
                                )}

                                {/* Notes Preview */}
                                {appt.notes && (
                                  <span className="text-slate-500 line-clamp-1 max-w-sm hidden lg:inline">
                                    &bull; {appt.notes}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Button: Inspect Details */}
                          <div className="flex items-center gap-2 self-end md:self-center shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 w-full md:w-auto justify-end">
                            <button
                              type="button"
                              onClick={() => setSelectedAppointment(appt)}
                              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 transition-colors"
                            >
                              <span>Détails</span>
                              <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>
      )}

      {/* VIEW: JOUR (Single Day Focus View) */}
      {activeView === 'day' && (
        <div className="space-y-4">
          {/* Day Header Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-2xs uppercase tracking-wider font-bold text-slate-400">Vue Journalière</span>
              <h3 className="text-lg font-bold text-slate-900">{formatFrenchDateHeading(selectedDate)}</h3>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-600 font-medium">
                {singleDayItems.length} intervention{singleDayItems.length > 1 ? 's' : ''} au planning
              </span>
              <button
                type="button"
                onClick={() => {
                  setBlockDate(selectedDate);
                  setShowBlockModal(true);
                }}
                className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>Bloquer un créneau</span>
              </button>
            </div>
          </div>

          {singleDayItems.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <ClockIcon className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-semibold text-slate-800">Aucun créneau ce jour-là</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Aucun soin ni indisponibilité enregistrée pour le {formatFrenchDateHeading(selectedDate)}.
              </p>
              <button
                type="button"
                onClick={handleJumpToToday}
                className="cursor-pointer text-xs font-semibold text-slate-900 underline hover:text-slate-700 pt-1 inline-block"
              >
                Revenir à aujourd&apos;hui
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {singleDayItems.map((appt) => {
                const blocked = isBlockedTimeSlot(appt);
                const statusInfo = getAppointmentDisplayStatus(appt);
                const startDt = getAppointmentStartDateTime(appt);
                const endDt = getAppointmentEndDateTime(appt, startDt);
                const startTimeStr = startDt.toFormat('HH:mm');
                const endTimeStr = endDt.toFormat('HH:mm');
                const durationStr = formatDuration(startDt, endDt);

                if (blocked) {
                  const { title, reason } = getBlockedSlotDetails(appt);
                  return (
                    <div
                      key={appt.id}
                      className="bg-slate-50/80 hover:bg-slate-100/80 rounded-xl border border-slate-200 border-l-4 border-l-slate-400 p-3.5 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <LockIcon className="w-4 h-4 text-slate-500" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900">{startTimeStr} - {endTimeStr}</span>
                            <span className="text-2xs text-slate-500 font-medium">({durationStr})</span>
                          </div>
                          <p className="text-xs font-bold text-slate-800">{title}</p>
                          {reason && <p className="text-2xs text-slate-500">{reason}</p>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedAppointment(appt)}
                        className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                      >
                        Détails
                      </button>
                    </div>
                  );
                }

                const formattedPhone = formatDisplayPhoneNumber(appt.contact?.phoneNumber);
                const isRealPhone = isRealPhoneNumber(appt.contact?.phoneNumber);

                return (
                  <div
                    key={appt.id}
                    className={`bg-white hover:bg-slate-50/60 rounded-xl border border-slate-200 border-l-4 ${statusInfo.borderAccent} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-16 shrink-0 pt-0.5">
                        <span className="font-mono text-base font-extrabold text-slate-900 block leading-tight">
                          {startTimeStr}
                        </span>
                        <span className="font-mono text-2xs text-slate-500 block">
                          {endTimeStr} &bull; {durationStr}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900">{appt.contact?.name || 'Patient'}</h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-2xs border ${statusInfo.badgeClass}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700">{appt.serviceType || 'Soins'}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          {isRealPhone && formattedPhone ? (
                            <span className="font-mono text-slate-600">{formattedPhone}</span>
                          ) : (
                            <span className="italic text-slate-400">Numéro non renseigné</span>
                          )}
                          {appt.contact?.postalCode && (
                            <span className="font-mono text-2xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {appt.contact.postalCode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAppointment(appt)}
                      className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 self-end sm:self-center"
                    >
                      Détails
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW: SEMAINE (Weekly Breakdown) */}
      {activeView === 'week' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((day) => {
              return (
                <div
                  key={day.dateStr}
                  className={`bg-white rounded-2xl border p-3 flex flex-col min-h-[220px] transition-all shadow-2xs ${
                    day.isToday
                      ? 'border-blue-400 ring-2 ring-blue-100'
                      : day.isSelected
                      ? 'border-slate-400'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Day Header */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(day.dateStr);
                      setActiveView('day');
                    }}
                    className="cursor-pointer text-left border-b border-slate-100 pb-2 mb-2 w-full hover:opacity-80 transition-opacity"
                  >
                    <span className="text-2xs uppercase tracking-wider font-bold text-slate-400 block">
                      {day.dayName}
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-lg font-extrabold ${day.isToday ? 'text-blue-600' : 'text-slate-900'}`}>
                        {day.dayNumber}
                      </span>
                      <span className="text-2xs text-slate-500 font-medium">{day.monthName}</span>
                    </div>
                    <span className="text-3xs text-slate-400 font-semibold block mt-0.5">
                      {day.items.length} soin{day.items.length > 1 ? 's' : ''}
                    </span>
                  </button>

                  {/* Day Items List */}
                  <div className="space-y-1.5 flex-1 overflow-y-auto max-h-80">
                    {day.items.length === 0 ? (
                      <p className="text-3xs text-slate-400 italic pt-2 text-center">Aucun soin</p>
                    ) : (
                      day.items.map((appt) => {
                        const blocked = isBlockedTimeSlot(appt);
                        const statusInfo = getAppointmentDisplayStatus(appt);
                        const startDt = getAppointmentStartDateTime(appt);
                        const timeStr = startDt.toFormat('HH:mm');

                        if (blocked) {
                          const { title } = getBlockedSlotDetails(appt);
                          return (
                            <button
                              key={appt.id}
                              type="button"
                              onClick={() => setSelectedAppointment(appt)}
                              className="w-full text-left cursor-pointer p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-3xs text-slate-700 transition-colors block"
                            >
                              <div className="flex items-center gap-1 font-mono font-bold text-slate-800">
                                <LockIcon className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                                <span>{timeStr}</span>
                              </div>
                              <p className="truncate text-slate-600">{title}</p>
                            </button>
                          );
                        }

                        return (
                          <button
                            key={appt.id}
                            type="button"
                            onClick={() => setSelectedAppointment(appt)}
                            className={`w-full text-left cursor-pointer p-1.5 rounded-lg border text-3xs transition-colors block ${
                              statusInfo.isUrgent
                                ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                                : statusInfo.isConfirmed
                                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                : 'bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold">{timeStr}</span>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
                            </div>
                            <p className="font-semibold truncate">{appt.contact?.name || 'Patient'}</p>
                            <p className="text-slate-500 truncate">{appt.serviceType || 'Soin'}</p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* 4. APPOINTMENT DETAIL INSPECTION MODAL */}
      {/* ============================================================================== */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <span className="text-2xs uppercase tracking-wider font-bold text-slate-400">
                  {isBlockedTimeSlot(selectedAppointment) ? 'Créneau d’indisponibilité' : 'Fiche de Soin Médical'}
                </span>
                <h3 className="text-xl font-bold text-slate-900 leading-tight">
                  {isBlockedTimeSlot(selectedAppointment)
                    ? getBlockedSlotDetails(selectedAppointment).title
                    : selectedAppointment.contact?.name || 'Patient'}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="cursor-pointer p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Fermer"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Status & Priority Badge */}
            <div className="flex items-center gap-2">
              {(() => {
                const statusInfo = getAppointmentDisplayStatus(selectedAppointment);
                return (
                  <>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${statusInfo.badgeClass}`}>
                      <span className={`w-2 h-2 rounded-full ${statusInfo.dotColor}`} />
                      <span>{statusInfo.label}</span>
                    </span>
                    {statusInfo.isUrgent && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        <AlertTriangleIcon className="w-3.5 h-3.5 text-rose-600" />
                        Urgence confirmée
                      </span>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Date & Time Block */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <CalendarIcon className="w-4 h-4 text-slate-500" />
                <span>
                  {formatFrenchDateHeading(getAppointmentStartDateTime(selectedAppointment).toFormat('yyyy-MM-dd'))}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-900">
                <ClockIcon className="w-4 h-4 text-slate-500" />
                <span>
                  {getAppointmentStartDateTime(selectedAppointment).toFormat('HH:mm')} &mdash;{' '}
                  {getAppointmentEndDateTime(selectedAppointment, getAppointmentStartDateTime(selectedAppointment)).toFormat('HH:mm')}
                </span>
                <span className="text-2xs font-normal text-slate-500">
                  ({formatDuration(getAppointmentStartDateTime(selectedAppointment), getAppointmentEndDateTime(selectedAppointment, getAppointmentStartDateTime(selectedAppointment)))})
                </span>
              </div>
            </div>

            {/* Specific Content: Blocked Slot vs Patient Appointment */}
            {isBlockedTimeSlot(selectedAppointment) ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Motif du blocage</span>
                  <p className="text-sm font-medium text-slate-800">
                    {getBlockedSlotDetails(selectedAppointment).title}
                  </p>
                </div>
                {getBlockedSlotDetails(selectedAppointment).reason && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes & Justification</span>
                    <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      {getBlockedSlotDetails(selectedAppointment).reason}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Prestation / Requested Service */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Prestation & Soin</span>
                  <p className="text-sm font-bold text-slate-900">
                    {selectedAppointment.serviceType || 'Soins Infirmiers'}
                  </p>
                </div>

                {/* Patient Contact Info */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                    Coordonnées du Patient
                  </span>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Téléphone</span>
                    {isRealPhoneNumber(selectedAppointment.contact?.phoneNumber) ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-900">
                          {formatDisplayPhoneNumber(selectedAppointment.contact?.phoneNumber)}
                        </span>
                        <a
                          href={`tel:${selectedAppointment.contact?.phoneNumber}`}
                          className="px-2.5 py-1 rounded-lg text-2xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        >
                          Appeler
                        </a>
                      </div>
                    ) : (
                      <span className="italic text-slate-400">Numéro non renseigné</span>
                    )}
                  </div>

                  {selectedAppointment.contact?.postalCode && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                      <span className="text-slate-500">Code Postal & Commune</span>
                      <span className="font-mono text-slate-800 font-semibold">
                        {selectedAppointment.contact.postalCode} {selectedAppointment.contact.city || ''}
                      </span>
                    </div>
                  )}

                  {selectedAppointment.contact?.address && (
                    <div className="flex items-start justify-between text-xs pt-1 border-t border-slate-200">
                      <span className="text-slate-500 shrink-0">Adresse</span>
                      <span className="text-right text-slate-800 font-medium">
                        {selectedAppointment.contact.address}
                      </span>
                    </div>
                  )}
                </div>

                {/* Appointment Notes & Medical History */}
                {selectedAppointment.notes && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Transmissions & Notes</span>
                    <div className="text-xs text-slate-700 bg-amber-50/40 p-3 rounded-xl border border-amber-200/60 leading-relaxed whitespace-pre-wrap">
                      {selectedAppointment.notes}
                    </div>
                  </div>
                )}

                {selectedAppointment.patient?.medicalNotes && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dossier Patient & Antécédents</span>
                    <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed whitespace-pre-wrap">
                      {selectedAppointment.patient.medicalNotes}
                    </div>
                  </div>
                )}
              </div>
            )}


            {/* Modal Actions */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* 5. BLOCK TIME SLOT MODAL */}
      {/* ============================================================================== */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <LockIcon className="w-5 h-5 text-slate-700" />
                <span>Bloquer un créneau horaire</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer p-1"
                title="Fermer"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Ce créneau sera immédiatement considéré comme indisponible lors de la prise de rendez-vous.
            </p>

            {blockError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {blockError}
              </div>
            )}

            <form onSubmit={handleCreateBlock} className="space-y-4 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Motif du blocage</label>
                <input
                  type="text"
                  required
                  value={blockTitle}
                  onChange={(e) => setBlockTitle(e.target.value)}
                  placeholder="Ex: Pause déjeuner, Congés, Réunion, Tournée excentrée"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-900/10 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Date</label>
                <input
                  type="date"
                  required
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-900/10 outline-none"
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
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-900/10 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Heure Fin</label>
                  <input
                    type="time"
                    required
                    value={blockEndTime}
                    onChange={(e) => setBlockEndTime(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-900/10 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Notes facultatives</label>
                <textarea
                  rows={2}
                  value={blockNotes}
                  onChange={(e) => setBlockNotes(e.target.value)}
                  placeholder="Détails internes ou consignes pour le cabinet..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-900/10 outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBlockModal(false)}
                  className="cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBlock}
                  className="cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isSubmittingBlock && (
                    <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                  )}
                  <span>{isSubmittingBlock ? 'Enregistrement...' : 'Confirmer le blocage'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
