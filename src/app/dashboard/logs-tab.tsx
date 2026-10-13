'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';

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
  const [isPending, startTransition] = useTransition();

  // Filters
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5s

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

  // Initial load or filter change
  useEffect(() => {
    fetchLogs();
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
    <div className="space-y-6">
      {/* Header and Live Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>📜</span> Journal Système & Traçabilité Webhooks
            </h2>
            <div
              className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ${
                autoRefresh
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                }`}
              />
              {autoRefresh ? 'Flux en Direct (5s)' : 'En Pause'}
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Inspection en temps réel des appels Vapi, webhooks Twilio, workers PM2 et erreurs applicatives.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Auto Refresh */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              autoRefresh
                ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500'
            }`}
          >
            {autoRefresh ? '⏸️ Suspendre' : '▶️ Reprendre le flux'}
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition disabled:opacity-50"
          >
            🔄 Actualiser
          </button>

          {/* Download Logs */}
          <div className="relative group">
            <button className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 transition">
              📥 Télécharger (.log)
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 py-1 text-xs">
              <a
                href="/api/admin/logs/download?type=combined"
                download="combined.log"
                className="block px-3 py-2 text-slate-300 hover:bg-slate-800"
              >
                combined.log (Complet)
              </a>
              <a
                href="/api/admin/logs/download?type=webhooks"
                download="webhooks.log"
                className="block px-3 py-2 text-slate-300 hover:bg-slate-800"
              >
                webhooks.log (Vapi/Twilio)
              </a>
              <a
                href="/api/admin/logs/download?type=error"
                download="error.log"
                className="block px-3 py-2 text-rose-300 hover:bg-slate-800"
              >
                error.log (Erreurs & Avertissements)
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-medium">Logs Générés (24h)</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{stats.total24h.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">En base & fichiers rotation</div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4">
          <div className="text-xs text-indigo-400 font-medium">Traces Webhooks (24h)</div>
          <div className="text-2xl font-bold text-indigo-300 mt-1">{stats.webhooks24h.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Vapi Voice & Twilio SMS</div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4">
          <div className="text-xs text-amber-400 font-medium">Avertissements (24h)</div>
          <div className="text-2xl font-bold text-amber-300 mt-1">{stats.warnings24h.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Dédoublonnages ou latences</div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4">
          <div className="text-xs text-rose-400 font-medium">Erreurs / Taux d’échec</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-rose-300">{stats.errors24h}</span>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-rose-950/70 text-rose-400 border border-rose-800/50">
              {errorRate}%
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Exceptions capturées</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
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
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-200"
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
            className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
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
            className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
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
            className="text-xs text-slate-400 hover:text-slate-200 underline self-center whitespace-nowrap"
          >
            Réinitialiser filtres
          </button>
        )}
      </div>

      {/* Logs Table / List */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4 w-32">Horodatage</th>
                <th className="py-3 px-3 w-24">Niveau</th>
                <th className="py-3 px-3 w-40">Module</th>
                <th className="py-3 px-3 w-44">Trace ID</th>
                <th className="py-3 px-4">Message</th>
                <th className="py-3 px-3 w-20 text-center">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
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
                        className={`cursor-pointer transition hover:bg-slate-800/50 ${
                          isExpanded ? 'bg-slate-800/70' : ''
                        } ${
                          log.level === 'ERROR'
                            ? 'bg-rose-950/15'
                            : log.level === 'WARN'
                            ? 'bg-amber-950/10'
                            : ''
                        }`}
                      >
                        {/* Timestamp */}
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          <span title={dateObj.toISOString()}>{timeFormatted}</span>
                        </td>

                        {/* Level badge */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {log.level === 'ERROR' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                              ERROR
                            </span>
                          )}
                          {log.level === 'WARN' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                              WARN
                            </span>
                          )}
                          {log.level === 'INFO' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                              INFO
                            </span>
                          )}
                          {log.level === 'DEBUG' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                              DEBUG
                            </span>
                          )}
                        </td>

                        {/* Module */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="text-indigo-400 font-semibold">{log.module}</span>
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
                              className="text-slate-400 hover:text-cyan-300 hover:underline flex items-center gap-1"
                            >
                              <span>🔗</span>
                              <span className="truncate max-w-[130px]">{log.correlationId}</span>
                            </button>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Message */}
                        <td className="py-3 px-4 text-slate-200">
                          <div className="line-clamp-2">{log.message}</div>
                        </td>

                        {/* Expand toggle */}
                        <td className="py-3 px-3 text-center text-slate-400">
                          <span className="text-xs">{isExpanded ? '▲' : '▼'}</span>
                        </td>
                      </tr>

                      {/* Expanded row with complete structured details */}
                      {isExpanded && (
                        <tr className="bg-slate-950/90 border-b border-slate-800">
                          <td colSpan={6} className="p-4">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                                <div className="flex items-center gap-4 text-slate-400 text-xs">
                                  <span>
                                    <strong>Horodatage ISO:</strong> {log.createdAt}
                                  </span>
                                  {log.business && (
                                    <span>
                                      <strong>Établissement:</strong> {log.business.name}
                                    </span>
                                  )}
                                  {log.correlationId && (
                                    <span>
                                      <strong>Correlation ID:</strong> {log.correlationId}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      copyToClipboard(
                                        JSON.stringify(log, null, 2),
                                        log.id
                                      )
                                    }
                                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700"
                                  >
                                    {copiedId === log.id ? '✓ Copié !' : '📋 Copier JSON'}
                                  </button>
                                </div>
                              </div>

                              {/* Formatted Metadata & Payload */}
                              {log.metadata && Object.keys(log.metadata).length > 0 ? (
                                <div>
                                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                                    Métadonnées & Charge Utile (Payload) :
                                  </div>
                                  <pre className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-emerald-400 overflow-x-auto max-h-72">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500 italic">
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
        <div className="py-3 px-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Affichage de <strong>{logs.length}</strong> sur <strong>{totalCount}</strong> événement(s)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700"
            >
              ◀ Précédent
            </button>
            <span className="px-2">
              Page {page} sur {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700"
            >
              Suivant ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
