'use client';

import { useState } from 'react';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedBusiness: string;
  allowedSections: string;
  createdAt: string;
}

const ALL_SECTIONS = [
  { id: 'overview', label: 'Vue d’ensemble', icon: '📊', business: 'ALL' },
  { id: 'calendar', label: 'Planning & Calendrier Interne', icon: '📅', business: 'CABINET_MICHELLE' },
  { id: 'appointments', label: 'Cabinet Michelle — Rendez-vous', icon: '🩺', business: 'CABINET_MICHELLE' },
  { id: 'requests', label: 'Dani Bâtiment — Devis & Chantiers', icon: '🏗️', business: 'DANI_BATIMENT' },
  { id: 'calls', label: 'Journal d’appels vocaux', icon: '📞', business: 'ALL' },
  { id: 'users', label: 'Gestion des Comptes & Permissions', icon: '👥', business: 'ALL' },
];

export default function DashboardUsersTab({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserAccount[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<UserAccount[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER',
    assignedBusiness: 'CABINET_MICHELLE',
    allowedSections: ['overview', 'calendar', 'appointments', 'calls'],
  });

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'USER',
    assignedBusiness: 'ALL',
    allowedSections: [] as string[],
  });

  const refreshUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to reload users:', err);
    }
  };

  const handleOpenCreate = () => {
    setError(null);
    setSuccess(null);
    setCreateForm({
      name: '',
      email: '',
      password: '',
      role: 'USER',
      assignedBusiness: 'CABINET_MICHELLE',
      allowedSections: ['overview', 'calendar', 'appointments', 'calls'],
    });
    setShowCreateModal(true);
  };

  const handleBusinessChangeOnCreate = (biz: string) => {
    let defaultSections: string[] = ['overview', 'calls'];
    if (biz === 'CABINET_MICHELLE') {
      defaultSections = ['overview', 'calendar', 'appointments', 'calls'];
    } else if (biz === 'DANI_BATIMENT') {
      defaultSections = ['overview', 'requests', 'calls'];
    } else if (biz === 'ALL') {
      defaultSections = ['overview', 'calendar', 'appointments', 'requests', 'calls', 'users'];
    }
    setCreateForm((prev) => ({
      ...prev,
      assignedBusiness: biz,
      allowedSections: defaultSections,
    }));
  };

  const handleToggleSectionCreate = (sectionId: string) => {
    setCreateForm((prev) => {
      const exists = prev.allowedSections.includes(sectionId);
      const updated = exists
        ? prev.allowedSections.filter((s) => s !== sectionId)
        : [...prev.allowedSections, sectionId];
      return { ...prev, allowedSections: updated };
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          allowedSections: createForm.allowedSections.join(','),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la création du compte');
      }

      setSuccess(`Compte créé avec succès pour ${createForm.email}`);
      setShowCreateModal(false);
      await refreshUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (user: UserAccount) => {
    setError(null);
    setSuccess(null);
    setEditingUser(user);
    const sectionsArray =
      user.allowedSections === 'ALL'
        ? ALL_SECTIONS.map((s) => s.id)
        : user.allowedSections.split(',').map((s) => s.trim());

    setEditForm({
      name: user.name,
      role: user.role,
      assignedBusiness: user.assignedBusiness,
      allowedSections: sectionsArray,
    });
  };

  const handleToggleSectionEdit = (sectionId: string) => {
    setEditForm((prev) => {
      const exists = prev.allowedSections.includes(sectionId);
      const updated = exists
        ? prev.allowedSections.filter((s) => s !== sectionId)
        : [...prev.allowedSections, sectionId];
      return { ...prev, allowedSections: updated };
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const isAllSections = editForm.allowedSections.length === ALL_SECTIONS.length;
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          name: editForm.name,
          role: editForm.role,
          assignedBusiness: editForm.assignedBusiness,
          allowedSections: isAllSections ? 'ALL' : editForm.allowedSections.join(','),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la modification');
      }

      setSuccess(`Permissions mises à jour pour ${editingUser.email}`);
      setEditingUser(null);
      await refreshUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (user: UserAccount) => {
    if (!confirm(`Confirmer la suppression du compte ${user.email} ?`)) {
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression');
      }

      setSuccess(`Compte ${user.email} supprimé`);
      await refreshUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600 text-lg">👥</span>
            <h2 className="font-bold text-slate-900 text-xl">Gestion des Comptes & Permissions</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Attribuez des établissements distincts (Cabinet Michelle ou Dani Bâtiment) et personnalisez les sections accessibles pour chaque utilisateur.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors"
        >
          <span>＋</span>
          <span>Créer un Compte</span>
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center justify-between">
          <span>✓ {success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-2xs uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-6">Utilisateur</th>
                <th className="py-3.5 px-6">Rôle</th>
                <th className="py-3.5 px-6">Établissement Assigné</th>
                <th className="py-3.5 px-6">Sections Autorisées</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isCurrent = u.id === currentUserId;
                const sectionsList =
                  u.allowedSections === 'ALL'
                    ? ['Toutes les sections']
                    : u.allowedSections.split(',').map((s) => {
                        const found = ALL_SECTIONS.find((sec) => sec.id === s.trim());
                        return found ? found.label : s.trim();
                      });

                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* User Info */}
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        {u.name}
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded-full text-2xs bg-blue-100 text-blue-700 font-bold">
                            Vous
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{u.email}</div>
                    </td>

                    {/* Role */}
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {u.role === 'ADMIN' ? '👑 Administrateur' : '👤 Utilisateur'}
                      </span>
                    </td>

                    {/* Assigned Business */}
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold ${
                          u.assignedBusiness === 'CABINET_MICHELLE'
                            ? 'bg-teal-50 text-teal-800 border border-teal-200'
                            : u.assignedBusiness === 'DANI_BATIMENT'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                        }`}
                      >
                        {u.assignedBusiness === 'CABINET_MICHELLE' && '🩺 Cabinet Michelle'}
                        {u.assignedBusiness === 'DANI_BATIMENT' && '🏗️ Dani Bâtiment'}
                        {u.assignedBusiness === 'ALL' && '🏢 Tous (Super Admin)'}
                      </span>
                    </td>

                    {/* Allowed Sections */}
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1.5 max-w-md">
                        {u.allowedSections === 'ALL' ? (
                          <span className="px-2 py-0.5 rounded-md text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Accès Intégral (Toutes)
                          </span>
                        ) : (
                          sectionsList.map((secName, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md text-2xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {secName}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        Modifier
                      </button>
                      {!isCurrent && (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          disabled={loading}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors"
                        >
                          Supprimer
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Créer un nouveau compte</h3>
                <p className="text-xs text-slate-500">Attribuez un établissement et ses sections d&apos;accès</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nom complet</label>
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="Ex: Sophie Martin"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rôle</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="USER">👤 Utilisateur standard</option>
                    <option value="ADMIN">👑 Administrateur</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Adresse Email</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="nom@entreprise.fr"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mot de passe provisoire</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Minimum 8 caractères"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Établissement Assigné */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Établissement assigné (Isolation des données)
                </label>
                <select
                  value={createForm.assignedBusiness}
                  onChange={(e) => handleBusinessChangeOnCreate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="CABINET_MICHELLE">🩺 Cabinet Michelle (Soins infirmiers uniquement)</option>
                  <option value="DANI_BATIMENT">🏗️ Dani Bâtiment (Chantiers & Devis uniquement)</option>
                  <option value="ALL">🏢 Tous les Établissements (Super Admin)</option>
                </select>
              </div>

              {/* Sections autorisées */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Sections autorisées dans le tableau de bord :
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {ALL_SECTIONS.map((sec) => {
                    const checked = createForm.allowedSections.includes(sec.id);
                    return (
                      <label
                        key={sec.id}
                        className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleSectionCreate(sec.id)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{sec.icon}</span>
                        <span className="truncate">{sec.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                >
                  {loading ? 'Création...' : 'Créer l’Utilisateur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Modifier les accès & permissions</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{editingUser.email}</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nom complet</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rôle</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="USER">👤 Utilisateur standard</option>
                    <option value="ADMIN">👑 Administrateur</option>
                  </select>
                </div>
              </div>

              {/* Établissement Assigné */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Établissement assigné
                </label>
                <select
                  value={editForm.assignedBusiness}
                  onChange={(e) => setEditForm({ ...editForm, assignedBusiness: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="CABINET_MICHELLE">🩺 Cabinet Michelle (Soins infirmiers uniquement)</option>
                  <option value="DANI_BATIMENT">🏗️ Dani Bâtiment (Chantiers & Devis uniquement)</option>
                  <option value="ALL">🏢 Tous les Établissements (Super Admin)</option>
                </select>
              </div>

              {/* Sections autorisées */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Sections assignées :
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setEditForm((prev) => ({
                        ...prev,
                        allowedSections: ALL_SECTIONS.map((s) => s.id),
                      }))
                    }
                    className="text-2xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Tout cocher
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {ALL_SECTIONS.map((sec) => {
                    const checked = editForm.allowedSections.includes(sec.id);
                    return (
                      <label
                        key={sec.id}
                        className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleSectionEdit(sec.id)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{sec.icon}</span>
                        <span className="truncate">{sec.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                >
                  {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
