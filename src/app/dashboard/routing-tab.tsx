'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RoutingAction } from '@prisma/client';
import { formatDisplayPhoneNumber, normalizePhoneNumber, isValidE164 } from '@/lib/validation/phone';

export interface BusinessRoutingOverview {
  id: string;
  slug: string;
  name: string;
  inboundPhoneNumber?: string | null;
  outboundPhoneNumber?: string | null;
  routingEnabled: boolean;
  priorityTransferNumber?: string | null;
}

export interface RoutingRuleItem {
  id: string;
  businessId: string;
  phoneNumber: string;
  action: RoutingAction;
  label: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DashboardRoutingTabProps {
  initialBusinesses: BusinessRoutingOverview[];
  userRole: string;
  userAssignedBusiness: string;
}

export default function DashboardRoutingTab({
  initialBusinesses,
  userRole,
  userAssignedBusiness,
}: DashboardRoutingTabProps) {
  // Available businesses for the current user
  const availableBusinesses = initialBusinesses.filter((b) => {
    if (userRole === 'ADMIN' || userAssignedBusiness === 'ALL') return true;
    return userAssignedBusiness === b.slug || userAssignedBusiness === b.id;
  });

  const [selectedBusinessId, setSelectedBusinessId] = useState<string>(
    availableBusinesses[0]?.id || ''
  );

  const selectedBusiness =
    availableBusinesses.find((b) => b.id === selectedBusinessId) || availableBusinesses[0];

  // Business routing state
  const [routingEnabled, setRoutingEnabled] = useState<boolean>(
    selectedBusiness?.routingEnabled ?? false
  );
  const [priorityNumber, setPriorityNumber] = useState<string>(
    selectedBusiness?.priorityTransferNumber || ''
  );
  const [rules, setRules] = useState<RoutingRuleItem[]>([]);
  const [loadingRules, setLoadingRules] = useState<boolean>(true);

  // Filter & Search
  const [activeTab, setActiveTab] = useState<'ALL' | 'DIRECT' | 'BLOCK'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Forms
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<RoutingRuleItem | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<RoutingRuleItem | null>(null);

  // Form states
  const [formPhone, setFormPhone] = useState<string>('');
  const [formAction, setFormAction] = useState<RoutingAction>('DIRECT');
  const [formLabel, setFormLabel] = useState<string>('');
  const [formActive, setFormActive] = useState<boolean>(true);

  // Status feedback
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [isSubmittingRule, setIsSubmittingRule] = useState<boolean>(false);
  const [isDeletingRule, setIsDeletingRule] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 6000);
  };

  // Fetch routing configuration and rules for the selected business
  const fetchRoutingData = useCallback(async (businessId: string) => {
    if (!businessId) return;
    setLoadingRules(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/business/${businessId}/routing`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur de chargement des règles de routage');
      }
      const data = await res.json();
      setRoutingEnabled(data.routingEnabled);
      setPriorityNumber(data.priorityTransferNumber || '');
      setRules(data.rules || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showError(msg);
    } finally {
      setLoadingRules(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBusinessId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRoutingData(selectedBusinessId);
    }
  }, [selectedBusinessId, fetchRoutingData]);

  // Handle switching business
  const handleBusinessChange = (newBusinessId: string) => {
    setSelectedBusinessId(newBusinessId);
    const b = availableBusinesses.find((item) => item.id === newBusinessId);
    if (b) {
      setRoutingEnabled(b.routingEnabled);
      setPriorityNumber(b.priorityTransferNumber || '');
    }
  };

  // Toggle routingEnabled
  const handleToggleRouting = async () => {
    if (!selectedBusiness) return;
    const nextState = !routingEnabled;
    setIsSavingSettings(true);
    try {
      const res = await fetch(`/api/business/${selectedBusiness.id}/routing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routingEnabled: nextState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la mise à jour');
      setRoutingEnabled(data.routingEnabled);
      showSuccess(
        data.routingEnabled
          ? 'Le filtrage et routage d’appels est maintenant ACTIVÉ.'
          : 'Le routage d’appels est DÉSACTIVÉ. Tous les appels sont envoyés à l’IA.'
      );
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Save priority transfer number
  const handleSavePriorityNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBusiness) return;

    if (priorityNumber.trim()) {
      const normalized = normalizePhoneNumber(priorityNumber);
      if (!isValidE164(normalized)) {
        showError('Le numéro de transfert doit être un numéro valide (ex: +33612345678 ou 0612345678).');
        return;
      }
    }

    setIsSavingSettings(true);
    try {
      const res = await fetch(`/api/business/${selectedBusiness.id}/routing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priorityTransferNumber: priorityNumber.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur d’enregistrement du numéro');
      setPriorityNumber(data.priorityTransferNumber || '');
      showSuccess('Numéro de transfert prioritaire mis à jour avec succès.');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Open Create Modal
  const openCreateModal = (presetAction: RoutingAction = 'DIRECT') => {
    setFormPhone('');
    setFormAction(presetAction);
    setFormLabel('');
    setFormActive(true);
    setShowAddModal(true);
  };

  // Open Edit Modal
  const openEditModal = (rule: RoutingRuleItem) => {
    setEditingRule(rule);
    setFormPhone(rule.phoneNumber);
    setFormAction(rule.action);
    setFormLabel(rule.label || '');
    setFormActive(rule.active);
  };

  // Submit Create or Edit Rule
  const handleRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBusiness) return;

    const normalized = normalizePhoneNumber(formPhone);
    if (!isValidE164(normalized)) {
      showError('Numéro de téléphone invalide. Utilisez un format mobile ou fixe valide (ex: 0612345678 ou +33612345678).');
      return;
    }

    setIsSubmittingRule(true);
    try {
      if (editingRule) {
        // Edit existing rule
        const res = await fetch(
          `/api/business/${selectedBusiness.id}/routing/rules/${editingRule.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phoneNumber: normalized,
              action: formAction,
              label: formLabel.trim() || undefined,
              active: formActive,
            }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors de la modification');

        setRules((prev) => prev.map((r) => (r.id === editingRule.id ? data.rule : r)));
        setEditingRule(null);
        showSuccess('Règle modifiée avec succès.');
      } else {
        // Create new rule
        const res = await fetch(`/api/business/${selectedBusiness.id}/routing/rules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: normalized,
            action: formAction,
            label: formLabel.trim() || undefined,
            active: formActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors de l’ajout de la règle');

        setRules((prev) => [data.rule, ...prev]);
        setShowAddModal(false);
        showSuccess(
          formAction === 'DIRECT'
            ? 'Numéro ajouté à la liste prioritaire (Whitelist).'
            : 'Numéro ajouté à la liste des numéros bloqués (Blacklist).'
        );
      }
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmittingRule(false);
    }
  };

  // Toggle active status for an individual rule
  const handleToggleRuleActive = async (rule: RoutingRuleItem) => {
    if (!selectedBusiness) return;
    const nextActive = !rule.active;
    try {
      const res = await fetch(
        `/api/business/${selectedBusiness.id}/routing/rules/${rule.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: nextActive }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur de mise à jour');
      setRules((prev) => prev.map((r) => (r.id === rule.id ? data.rule : r)));
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  // Delete a rule
  const handleConfirmDelete = async () => {
    if (!selectedBusiness || !ruleToDelete) return;
    setIsDeletingRule(true);
    try {
      const res = await fetch(
        `/api/business/${selectedBusiness.id}/routing/rules/${ruleToDelete.id}`,
        {
          method: 'DELETE',
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur de suppression');

      setRules((prev) => prev.filter((r) => r.id !== ruleToDelete.id));
      setRuleToDelete(null);
      showSuccess('Règle supprimée avec succès.');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeletingRule(false);
    }
  };

  // Filtered rules
  const filteredRules = rules.filter((rule) => {
    if (activeTab === 'DIRECT' && rule.action !== 'DIRECT') return false;
    if (activeTab === 'BLOCK' && rule.action !== 'BLOCK') return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase().trim();
    const phoneMatches = rule.phoneNumber.toLowerCase().includes(q);
    const labelMatches = rule.label ? rule.label.toLowerCase().includes(q) : false;
    return phoneMatches || labelMatches;
  });

  const whitelistCount = rules.filter((r) => r.action === 'DIRECT').length;
  const blacklistCount = rules.filter((r) => r.action === 'BLOCK').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Multi-Tenant Selector */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🔀</span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Routage & Filtrage d’Appels Vapi
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gérez les numéros prioritaires (transfert direct) et les numéros indésirables (rejet automatique avant l’IA).
          </p>
        </div>

        {/* Business Selector (if multiple available) */}
        {availableBusinesses.length > 1 && (
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-xs font-semibold text-slate-600">Établissement :</label>
            <select
              value={selectedBusinessId}
              onChange={(e) => handleBusinessChange(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            >
              {availableBusinesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.slug})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Notifications / Alerts */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center justify-between shadow-2xs animate-fade-in">
          <span>⚠️ {errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-800 font-bold ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center justify-between shadow-2xs animate-fade-in">
          <span>✓ {successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-800 font-bold ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3): Global Routing Controls */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  Statut du Routage
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  {routingEnabled ? 'Routage & Filtrage Activé' : 'Routage Désactivé'}
                </h2>
                <p className="text-xs text-slate-500">
                  {routingEnabled
                    ? 'Les règles Whitelist et Blacklist sont appliquées avant le démarrage de l’assistante vocale.'
                    : 'Le filtrage est inactif : tous les appelants sont pris en charge directement par l’assistante IA.'}
                </p>
              </div>

              {/* Master Toggle */}
              <button
                type="button"
                onClick={handleToggleRouting}
                disabled={isSavingSettings}
                className={`cursor-pointer px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${routingEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                  }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${routingEnabled ? 'bg-white animate-pulse' : 'bg-slate-400'
                    }`}
                />
                <span>{routingEnabled ? 'Filtrage Actif' : 'Activer le filtrage'}</span>
              </button>
            </div>

            {/* Read-Only Vapi Inbound Number Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-2xs uppercase tracking-wider font-bold text-slate-400">
                  Numéro d’Accueil Vapi (Entrant)
                </span>
                <p className="text-sm font-mono font-bold text-slate-900">
                  {selectedBusiness?.inboundPhoneNumber || selectedBusiness?.outboundPhoneNumber || 'Non renseigné'}
                </p>
                <p className="text-2xs text-slate-500">
                  Numéro associé à la configuration Vapi de cet établissement.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-2xs uppercase tracking-wider font-bold text-slate-400">
                  Établissement Associé
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {selectedBusiness?.name}
                </p>
                <p className="text-2xs text-slate-500">Identifiant : {selectedBusiness?.slug}</p>
              </div>
            </div>

            {/* Priority Transfer Number Form */}
            <form onSubmit={handleSavePriorityNumber} className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label htmlFor="priority-transfer-number" className="text-xs font-bold text-slate-800">
                  Numéro de transfert par défaut — {selectedBusiness?.name || 'cet établissement'}
                </label>
                <span className="text-2xs text-slate-400 font-medium">Format Française (+33...)</span>
              </div>

              <div className="flex gap-2.5">
                <input
                  id="priority-transfer-number"
                  type="tel"
                  value={priorityNumber}
                  onChange={(e) => setPriorityNumber(e.target.value)}
                  placeholder="Ex: +33612857915 ou 0612857915"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="cursor-pointer px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 shrink-0"
                >
                  {isSavingSettings ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>

              <p className="text-2xs text-slate-500">
                Tous les appelants autorisés de {selectedBusiness?.name || 'cet établissement'} sont transférés vers ce numéro. Chaque entreprise conserve son propre numéro.
              </p>
            </form>
          </div>
        </div>

        {/* Right Column (1/3): Educational Information & Warning Callout */}
        <div className="space-y-4">
          {/* Important Forwarding Loop Warning */}
          <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 space-y-2 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
              <span>⚠️</span>
              <span className="uppercase tracking-wider">Attention aux boucles de transfert</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-900/90">
              Veillez à ne pas transférer les appels prioritaires vers un numéro qui renvoie lui-même vers le numéro Vapi de l’établissement{selectedBusiness?.inboundPhoneNumber ? ` (${selectedBusiness.inboundPhoneNumber})` : ''}. Cela provoquerait une <strong>boucle infinie de redirection</strong>.
            </p>
          </div>

          {/* Educational Legend */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-400 block">
              Comment fonctionne le routage
            </span>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-2xs mt-0.5 shrink-0">
                  WHITELIST
                </span>
                <p className="text-slate-600">
                  <strong className="text-slate-800">Transfert direct :</strong> Les numéros autorisés ignorent l’IA et sonnent directement sur la ligne prioritaire.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-2xs mt-0.5 shrink-0">
                  BLACKLIST
                </span>
                <p className="text-slate-600">
                  <strong className="text-slate-800">Rejet immédiat :</strong> Les numéros indésirables ou démarcheurs sont rejetés sans faire sonner l’IA.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-2xs mt-0.5 shrink-0">
                  AUTRES
                </span>
                <p className="text-slate-600">
                  <strong className="text-slate-800">Prise en charge IA :</strong> Tous les autres appelants conversent avec l’assistante vocale.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rules Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-6">
        {/* Rules Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Règles de filtrage des numéros ({rules.length})
            </h2>
            <p className="text-xs text-slate-500">
              {whitelistCount} prioritaire{whitelistCount > 1 ? 's' : ''} &bull; {blacklistCount} bloqué{blacklistCount > 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openCreateModal('DIRECT')}
              className="cursor-pointer px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <span>+</span>
              <span>Ajouter Whitelist</span>
            </button>
            <button
              type="button"
              onClick={() => openCreateModal('BLOCK')}
              className="cursor-pointer px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <span>+</span>
              <span>Ajouter Blacklist</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`cursor-pointer px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Tous ({rules.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('DIRECT')}
              className={`cursor-pointer px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${activeTab === 'DIRECT'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-emerald-700'
                }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Whitelist ({whitelistCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('BLOCK')}
              className={`cursor-pointer px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${activeTab === 'BLOCK'
                  ? 'bg-white text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-rose-700'
                }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Blacklist ({blacklistCount})</span>
            </button>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher numéro ou libellé..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Rules Table / Cards */}
        {loadingRules ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Chargement des règles de routage...
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 space-y-2">
            <p className="text-sm font-semibold text-slate-700">Aucune règle trouvée</p>
            <p className="text-xs text-slate-400">
              {searchQuery
                ? 'Aucun résultat ne correspond à votre recherche.'
                : 'Ajoutez des numéros en Whitelist ou Blacklist pour filtrer les appels de cet établissement.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Numéro de Téléphone</th>
                  <th className="py-3 px-4">Type de Règle</th>
                  <th className="py-3 px-4">Description / Libellé</th>
                  <th className="py-3 px-4 text-center">État</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRules.map((rule) => {
                  const displayPhone =
                    formatDisplayPhoneNumber(rule.phoneNumber) || rule.phoneNumber;
                  const isDirect = rule.action === 'DIRECT';

                  return (
                    <tr key={rule.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {displayPhone}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-2xs border ${isDirect
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${isDirect ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                          />
                          <span>{isDirect ? 'Whitelist (Transfert Direct)' : 'Blacklist (Bloqué)'}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {rule.label || <span className="text-slate-400 italic">Aucune note</span>}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleRuleActive(rule)}
                          className={`cursor-pointer inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold border transition-colors ${rule.active
                              ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                              : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                            }`}
                        >
                          <span>{rule.active ? 'Actif' : 'Désactivé'}</span>
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(rule)}
                          className="cursor-pointer text-slate-600 hover:text-slate-900 font-semibold px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => setRuleToDelete(rule)}
                          className="cursor-pointer text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT RULE */}
      {(showAddModal || editingRule) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {editingRule ? 'Modifier la règle de routage' : 'Ajouter une règle de routage'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingRule(null);
                }}
                className="cursor-pointer text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRuleSubmit} className="space-y-4 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Numéro de téléphone</label>
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="Ex: 0612345678 ou +33612345678"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-2xs text-slate-400">Le numéro sera automatiquement normalisé au format international.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Action de routage</label>
                <select
                  value={formAction}
                  onChange={(e) => setFormAction(e.target.value as RoutingAction)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DIRECT">🟢 Whitelist — Transfert Prioritaire Direct</option>
                  <option value="BLOCK">🔴 Blacklist — Bloquer & Rejeter l’Appel</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Libellé / Note (Facultatif)</label>
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="Ex: Médecin coordonnateur, Robot démarchage..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="active-rule-checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <label htmlFor="active-rule-checkbox" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Activer immédiatement cette règle
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingRule(null);
                  }}
                  className="cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRule}
                  className="cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmittingRule ? 'Enregistrement...' : editingRule ? 'Enregistrer les modifications' : 'Ajouter la règle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE */}
      {ruleToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-slate-900">Confirmer la suppression</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer la règle pour le numéro{' '}
              <strong className="font-mono text-slate-800">{ruleToDelete.phoneNumber}</strong>{' '}
              {ruleToDelete.label && `(${ruleToDelete.label})`} ?
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRuleToDelete(null)}
                className="cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingRule}
                className="cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeletingRule ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
