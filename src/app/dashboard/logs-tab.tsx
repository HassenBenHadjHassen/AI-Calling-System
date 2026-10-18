'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface SystemLogEntry {
  id: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  module: string;
  message: string;
  correlationId: string | null;
  businessId: string | null;
  business?: { id: string; name: string; slug: string } | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface LogStats {
  total24h: number;
  errors24h: number;
  warnings24h: number;
  webhooks24h: number;
}

export default function DashboardLogsTab({
  initialLogs = [],
  initialStats = { total24h: 0, errors24h: 0, warnings24h: 0, webhooks24h: 0 },
}: {
  initialLogs?: SystemLogEntry[];
  initialStats?: LogStats;
}) {
  const [logs, setLogs] = useState<SystemLogEntry[]>(initialLogs);
  const [stats, setStats] = useState<LogStats>(initialStats);
  const [loading, setLoading] = useState(false);
  const isMounted = useRef(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshInterval = 5000; // 5s

  // Expanded row details
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
      });

      if (selectedLevel !== 'ALL') params.set('level', selectedLevel);
      if (selectedModule !== 'ALL') params.set('module', selectedModule);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      if (!res.ok) throw new Error('Erreur lors du chargement des logs');

      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Erreur chargement logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, selectedLevel, selectedModule, search]);

  // Load logs on filter/page changes (server passes initialLogs on mount)
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    void fetchLogs();
  }, [fetchLogs]);

  // Periodic polling when autoRefresh is enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchLogs]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFilterCorrelation = (corrId: string) => {
    setSearch(corrId);
    setPage(1);
  };

  const errorRate =
    stats.total24h > 0 ? ((stats.errors24h / stats.total24h) * 100).toFixed(1) : '0.0';

  return (
    <div className="system-logs space-y-6">
      {/* Header and Live Status */}
      <div className="logs-header flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>📜</span> Journal Système & Traçabilité Webhooks
            </h2>
            <div
              className={`logs-live-indicator flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold ${
                autoRefresh
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              {autoRefresh ? 'Actualiser toutes les 5 secondes' : 'En Pause'}
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Inspection en temps réel des appels Vapi, webhooks Twilio, workers PM2 et erreurs applicatives.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Auto Refresh */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              autoRefresh
                ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {autoRefresh ? '⏸️ Suspendre' : '▶️ Reprendre le flux'}
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="cursor-pointer px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 transition disabled:opacity-50 shadow-2xs"
          >
            🔄 Actualiser
          </button>

          {/* Download Logs */}
          <div className="relative group">
            <button className="cursor-pointer px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 transition shadow-2xs">
              📥 Télécharger (.log)
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 text-xs">
              <a
                href="/api/admin/logs/download?type=combined"
                download="combined.log"
                className="block px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              >
                combined.log (Complet)
              </a>
              <a
                href="/api/admin/logs/download?type=webhooks"
                download="webhooks.log"
                className="block px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              >
                webhooks.log (Vapi/Twilio)
              </a>
              <a
                href="/api/admin/logs/download?type=error"
                download="error.log"
                className="block px-3.5 py-2 text-rose-700 hover:bg-rose-50"
              >
                error.log (Erreurs & Avertissements)
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="logs-stats grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="logs-stat bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="text-2xs uppercase tracking-wider font-bold text-slate-400">Logs Générés (24h)</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total24h.toLocaleString()}</div>
          <div className="text-2xs text-slate-500 mt-0.5">En base & fichiers rotation</div>
        </div>

        <div className="logs-stat bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="text-2xs uppercase tracking-wider font-bold text-indigo-500">Traces Webhooks (24h)</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.webhooks24h.toLocaleString()}</div>
          <div className="text-2xs text-slate-500 mt-0.5">Vapi Voice & Twilio SMS</div>
        </div>

        <div className="logs-stat bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="text-2xs uppercase tracking-wider font-bold text-amber-500">Avertissements (24h)</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.warnings24h.toLocaleString()}</div>
          <div className="text-2xs text-slate-500 mt-0.5">Dédoublonnages ou latences</div>
        </div>

        <div className="logs-stat bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="text-2xs uppercase tracking-wider font-bold text-rose-500">Erreurs / Taux d’échec</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-slate-900">{stats.errors24h}</span>
            <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
              {errorRate}%
            </span>
          </div>
          <div className="text-2xs text-slate-500 mt-0.5">Exceptions capturées</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="logs-filter bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xs">
        <div className="flex-1 flex flex-col sm:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Rechercher par message, correlationId, téléphone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="cursor-pointer absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Level Filter */}
          <select
            value={selectedLevel}
            onChange={(e) => {
              setSelectedLevel(e.target.value);
              setPage(1);
            }}
            className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Tous les niveaux (DEBUG, INFO, WARN, ERROR)</option>
            <option value="ERROR">🔴 ERROR uniquement</option>
            <option value="WARN">🟡 WARN uniquement</option>
            <option value="INFO">🟢 INFO uniquement</option>
            <option value="DEBUG">🟣 DEBUG uniquement</option>
          </select>

          {/* Module Filter */}
          <select
            value={selectedModule}
            onChange={(e) => {
              setSelectedModule(e.target.value);
              setPage(1);
            }}
            className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Tous les modules</option>
            <option value="WEBHOOK_VAPI">Vapi Webhooks</option>
            <option value="WEBHOOK_TWILIO">Twilio SMS Webhooks</option>
            <option value="CALENDAR">Calendrier Interne & iCal</option>
            <option value="DEVIS">Portail Devis</option>
            <option value="WORKER">Worker Notifications</option>
            <option value="AUTH">Authentification</option>
            <option value="SYSTEM">Système Global</option>
          </select>
        </div>

        {(search || selectedLevel !== 'ALL' || selectedModule !== 'ALL') && (
          <button
            onClick={() => {
              setSearch('');
              setSelectedLevel('ALL');
              setSelectedModule('ALL');
              setPage(1);
            }}
            className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-800 underline self-center whitespace-nowrap"
          >
            Réinitialiser filtres
          </button>
        )}
      </div>

      {/* Logs Table / List */}
      <div className="logs-table-wrap bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-2xs">
                <th className="py-3 px-4 w-32">Horodatage</th>
                <th className="py-3 px-3 w-24">Niveau</th>
                <th className="py-3 px-3 w-44">Module</th>
                <th className="py-3 px-3 w-44">Trace ID</th>
                <th className="py-3 px-4">Message</th>
                <th className="py-3 px-3 w-20 text-center">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    {loading ? 'Chargement des événements...' : 'Aucun log ne correspond aux critères sélectionnés.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const dateObj = new Date(log.createdAt);
                  const timeFormatted = dateObj.toLocaleTimeString('fr-FR', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded
                            ? 'bg-slate-100/70'
                            : log.level === 'ERROR'
                            ? 'bg-rose-50/60 hover:bg-rose-100/50'
                            : log.level === 'WARN'
                            ? 'bg-amber-50/60 hover:bg-amber-100/50'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Timestamp */}
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-xs">
                          <span title={dateObj.toISOString()}>{timeFormatted}</span>
                        </td>

                        {/* Level badge */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {log.level === 'ERROR' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              ERROR
                            </span>
                          )}
                          {log.level === 'WARN' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              WARN
                            </span>
                          )}
                          {log.level === 'INFO' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              INFO
                            </span>
                          )}
                          {log.level === 'DEBUG' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              DEBUG
                            </span>
                          )}
                        </td>

                        {/* Module */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="text-slate-700 font-semibold">{log.module}</span>
                        </td>

                        {/* Correlation ID */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {log.correlationId ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFilterCorrelation(log.correlationId!);
                              }}
                              title="Cliquer pour filtrer uniquement cette trace de requête"
                              className="cursor-pointer text-slate-500 hover:text-slate-900 hover:underline flex items-center gap-1"
                            >
                              <span>🔗</span>
                              <span className="truncate max-w-[130px] font-mono text-2xs">{log.correlationId}</span>
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Message - High contrast for readability */}
                        <td className="py-3 px-4 text-slate-900 font-medium font-sans">
                          <div className="line-clamp-2 text-slate-900 text-xs leading-relaxed">{log.message}</div>
                        </td>

                        {/* Expand toggle */}
                        <td className="py-3 px-3 text-center text-slate-400">
                          <span className="text-2xs">{isExpanded ? '▲' : '▼'}</span>
                        </td>
                      </tr>

                      {/* Expanded row with light mode styling matching theme */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-y border-slate-200">
                          <td colSpan={6} className="p-5">
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                                <div className="flex flex-wrap items-center gap-4 text-slate-600 text-xs font-sans">
                                  <span>
                                    <strong className="text-slate-800">Horodatage ISO :</strong>{' '}
                                    <span className="font-mono text-slate-700">{log.createdAt}</span>
                                  </span>
                                  {log.business && (
                                    <span>
                                      <strong className="text-slate-800">Établissement :</strong>{' '}
                                      <span className="text-slate-700">{log.business.name}</span>
                                    </span>
                                  )}
                                  {log.correlationId && (
                                    <span>
                                      <strong className="text-slate-800">Correlation ID :</strong>{' '}
                                      <span className="font-mono text-slate-700">{log.correlationId}</span>
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(
                                        JSON.stringify(log, null, 2),
                                        log.id
                                      )
                                    }
                                    className="cursor-pointer px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 shadow-2xs transition-colors"
                                  >
                                    {copiedId === log.id ? '✓ Copié !' : '📋 Copier JSON'}
                                  </button>
                                </div>
                              </div>

                              {/* Formatted Metadata & Payload */}
                              {log.metadata && Object.keys(log.metadata).length > 0 ? (
                                <div>
                                  <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">
                                    Métadonnées & Charge Utile (Payload) :
                                  </div>
                                  <pre className="bg-white border border-slate-200/90 rounded-xl p-4 text-xs text-slate-800 font-mono overflow-x-auto max-h-80 shadow-2xs leading-relaxed">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500 italic font-sans">
                                  Aucune métadonnée additionnelle pour cet événement.
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="py-3 px-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <div>
            Affichage de <strong className="text-slate-800">{logs.length}</strong> sur <strong className="text-slate-800">{totalCount}</strong> événement(s)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="cursor-pointer px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold border border-slate-300 shadow-2xs transition-colors"
            >
              ◀ Précédent
            </button>
            <span className="px-2 font-medium">
              Page {page} sur {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="cursor-pointer px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold border border-slate-300 shadow-2xs transition-colors"
            >
              Suivant ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
