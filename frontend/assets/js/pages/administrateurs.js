(function () {
// ============================================================
// Page Controller: Administrateurs - P.Biometrique
// ============================================================

function adminAvatar(u) {
    if (u.photo_url) {
        return `<img src="${u.photo_url}" alt="${u.prenom} ${u.nom}" class="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">`;
    }
    const initials = ((u.prenom?.[0] || '') + (u.nom?.[0] || '')).toUpperCase() || 'AD';
    return `<div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0">${initials}</div>`;
}

function adminRow(u) {
    const isSuper = u.role === 'super_admin' || u.role === 'admin_systeme';
    const roleBadge = isSuper
        ? `<span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-amber-300/60 dark:border-amber-800">
             <span class="material-symbols-outlined text-[13px]">shield</span> Super Admin
           </span>`
        : `<span class="inline-flex items-center gap-1 bg-orange-50 text-[#F46A21] dark:bg-orange-950/60 dark:text-[#F9AE3F] text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-[#F46A21]/30 dark:border-orange-800">
             <span class="material-symbols-outlined text-[13px]">manage_accounts</span> Admin RH
           </span>`;

    const empBadge = u.empreinte
        ? `<span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900">
             <span class="material-symbols-outlined text-[13px]">check_circle</span> Actif
           </span>`
        : `<span class="inline-flex items-center gap-1 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
             <span class="material-symbols-outlined text-[13px]">block</span> Non enrôlé
           </span>`;

    return `
        <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-slate-800/60" data-admin-id="${u.id}">
            <td class="py-sm px-md">
                <div class="flex items-center gap-md">
                    ${adminAvatar(u)}
                    <div>
                        <div class="font-semibold text-slate-900 dark:text-white">${u.prenom} ${u.nom}</div>
                        <div class="text-[11px] text-slate-400 md:hidden">${u.email || '—'}</div>
                    </div>
                </div>
            </td>
            <td class="py-sm px-md hidden md:table-cell font-mono text-[13px] text-slate-600 dark:text-slate-300">${u.matricule}</td>
            <td class="py-sm px-md hidden md:table-cell text-slate-600 dark:text-slate-400">${u.email || '—'}</td>
            <td class="py-sm px-md hidden md:table-cell font-medium text-slate-700 dark:text-slate-300">${u.departement || 'Direction'}</td>
            <td class="py-sm px-md">${roleBadge}</td>
            <td class="py-sm px-md hidden md:table-cell">${empBadge}</td>
            <td class="py-sm px-md text-right">
                <div class="inline-flex items-center gap-1">
                    <button class="bg-sky-50 text-sky-600 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center" title="Voir la fiche détaillée" data-admin-detail="${u.id}">
                        <span class="material-symbols-outlined text-[18px]">visibility</span>
                    </button>
                    ${(() => {
                        const isSuper = (() => { try { const cu = api.getCurrentUser(); return cu && (cu.role === 'super_admin' || cu.role === 'admin_systeme'); } catch(e){ return false; } })();
                        if (!isSuper) return '';
                        return `
                        <button class="text-slate-500 hover:text-[#F46A21] hover:bg-[#FFF1E8] dark:hover:bg-orange-950/40 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center" title="Modifier l'admin" data-admin-edit="${u.id}">
                            <span class="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button class="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center" title="Supprimer" data-admin-delete="${u.id}">
                            <span class="material-symbols-outlined text-[16px]">delete</span>
                        </button>`;
                    })()}
                </div>
            </td>
        </tr>`;
}

let allAdmins = [];
let selectedAdminForDetail = null;

async function renderAdmins(forceFetch = false) {
    if (forceFetch || !allAdmins || allAdmins.length === 0) {
        const rawUsers = await api.getUsers();
        allAdmins = rawUsers.filter(u => u.role === 'admin' || u.role === 'super_admin' || u.role === 'admin_systeme' || (u.poste && u.poste.toLowerCase().includes('admin')));
    }
    
    const search     = (document.getElementById('top-search')?.value || '').trim().toLowerCase();
    const filterPrivilege = (document.getElementById('filter-privilege')?.value || '').toLowerCase();

    const filtered = allAdmins.filter(u => {
        const matchesSearch = !search ||
            u.nom.toLowerCase().includes(search) ||
            u.prenom.toLowerCase().includes(search) ||
            u.matricule.toLowerCase().includes(search) ||
            (u.email || '').toLowerCase().includes(search) ||
            (u.departement || '').toLowerCase().includes(search);

        const roleNorm = (u.role || '').toLowerCase();
        const matchesPrivilege = !filterPrivilege || roleNorm === filterPrivilege || (filterPrivilege === 'super_admin' && roleNorm === 'admin_systeme');

        return matchesSearch && matchesPrivilege;
    });

    const body = document.getElementById('admins-body');
    if (body) {
        body.innerHTML = filtered.map(adminRow).join('')
            || '<tr><td colspan="7" class="py-lg px-md text-center text-slate-400">Aucun administrateur trouvé.</td></tr>';
    }

    const summary = document.getElementById('admin-count-summary');
    if (summary) summary.textContent = `${filtered.length} administrateur(s) au total`;

    const isSuper = (() => { try { const cu = api.getCurrentUser(); return cu && (cu.role === 'super_admin' || cu.role === 'admin_systeme'); } catch(e){ return false; } })();
    const btnAddAdmin = document.querySelector('[data-open="modal-add-admin"]');
    if (btnAddAdmin) btnAddAdmin.classList.toggle('hidden', !isSuper);
}

function showAdminDetail(u) {
    selectedAdminForDetail = u;
    const isSuper = (() => { try { const cu = api.getCurrentUser(); return cu && (cu.role === 'super_admin' || cu.role === 'admin_systeme'); } catch(e){ return false; } })();
    const btnBridge = document.getElementById('btn-edit-from-detail-admin');
    if (btnBridge) btnBridge.classList.toggle('hidden', !isSuper);
    const photoContainer = document.getElementById('detail-admin-photo');
    if (photoContainer) {
        if (u.photo_url) {
            photoContainer.innerHTML = `<img src="${u.photo_url}" alt="${u.prenom} ${u.nom}" class="w-full h-full object-cover">`;
        } else {
            const initials = ((u.prenom?.[0] || '') + (u.nom?.[0] || '')).toUpperCase() || 'AD';
            photoContainer.innerHTML = `<span>${initials}</span>`;
        }
    }

    const setTxt = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
    };

    setTxt('detail-admin-name', `${u.prenom} ${u.nom}`);
    setTxt('detail-admin-matricule', u.matricule || '—');
    setTxt('detail-admin-email', u.email || '—');
    setTxt('detail-admin-telephone', u.telephone || 'Non renseigné');
    setTxt('detail-admin-dept', u.departement || 'Direction Général');
    setTxt('detail-admin-embauche', u.date_embauche || '—');

    const roleBadgeEl = document.getElementById('detail-admin-role');
    if (roleBadgeEl) {
        roleBadgeEl.textContent = (u.role === 'super_admin' || u.role === 'admin_systeme') 
            ? 'Super Administrateur Système' 
            : 'Administrateur RH';
    }

    const empBadgeEl = document.getElementById('detail-admin-empreinte-badge');
    if (empBadgeEl) {
        empBadgeEl.innerHTML = u.empreinte
            ? `<span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-300">
                 <span class="material-symbols-outlined text-[14px]">check_circle</span> Enregistrée
               </span>`
            : `<span class="inline-flex items-center gap-1 bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                 <span class="material-symbols-outlined text-[14px]">block</span> Non configurée
               </span>`;
    }

    openModal('modal-detail-admin');
}

function openEditAdminModal(u) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('f-admin-edit-matricule', u.matricule);
    setVal('f-admin-edit-nom', u.nom);
    setVal('f-admin-edit-prenom', u.prenom);
    setVal('f-admin-edit-email', u.email);
    setVal('f-admin-edit-telephone', u.telephone);
    setVal('f-admin-edit-date-embauche', u.date_embauche);
    setVal('f-admin-edit-departement', u.departement);
    setVal('f-admin-edit-role', (u.role === 'super_admin' || u.role === 'admin_systeme') ? 'super_admin' : 'admin');
    setVal('f-admin-edit-password', '');

    const subtitle = document.getElementById('f-admin-edit-subtitle');
    if (subtitle) subtitle.textContent = `${u.prenom} ${u.nom} (${u.matricule})`;

    const form = document.getElementById('form-edit-admin');
    if (form) form.dataset.editId = u.id;

    openModal('modal-edit-admin');
}

async function initAdminPage() {
    window._lastInitializedModule = 'administrateurs';
    await renderAdmins(true);

    // Filtres & Recherche (privilège uniquement)
    const searchInput = document.getElementById('top-search');
    if (searchInput) searchInput.oninput = () => renderAdmins(false);

    const filterPrivilege = document.getElementById('filter-privilege');
    if (filterPrivilege) filterPrivilege.onchange = () => renderAdmins(false);

    // Aperçu matricule auto-généré ADM (non modifiable à l'ajout)
    async function updateAdminMatriculePreview() {
        const previewEl = document.getElementById('f-admin-matricule-preview');
        if (!previewEl) return;
        previewEl.textContent = 'Génération...';
        const mat = await api.getMatriculePreview(0, 'admin');
        previewEl.textContent = mat || 'ADM001';
    }

    // Mettre à jour l'aperçu à l'ouverture du modal d'ajout
    const btnOpenAddAdmin = document.querySelector('[data-open="modal-add-admin"]');
    if (btnOpenAddAdmin) {
        btnOpenAddAdmin.addEventListener('click', updateAdminMatriculePreview);
    }
    // Pré-charger aussi au chargement de la page
    updateAdminMatriculePreview();

    // Gestion du bouton "Bridge" depuis Fiche détaillée vers Modification
    const btnBridge = document.getElementById('btn-edit-from-detail-admin');
    if (btnBridge) {
        btnBridge.onclick = () => {
            if (selectedAdminForDetail) {
                closeModal('modal-detail-admin');
                openEditAdminModal(selectedAdminForDetail);
            }
        };
    }

    // Soumission du formulaire d'ajout d'administrateur
    const formAdd = document.getElementById('form-add-admin');
    if (formAdd) {
        // Pré-remplir la date d'embauche si vide
        const dateInput = document.getElementById('f-admin-date-embauche');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        formAdd.onsubmit = async (e) => {
            e.preventDefault();
            const pass = document.getElementById('f-admin-password').value;
            const confirmPass = document.getElementById('f-admin-password-confirm').value;

            if (pass !== confirmPass) {
                flash('Les mots de passe ne correspondent pas.', 'warning');
                return;
            }

            const submitBtn = e.submitter || document.querySelector('#form-add-admin button[type="submit"]');
            await withButtonLoading(submitBtn, async () => {
                const res = await api.addUser({
                    matricule: '', // auto-généré côté serveur (ADMxxx)
                    nom: document.getElementById('f-admin-nom').value.trim(),
                    prenom: document.getElementById('f-admin-prenom').value.trim(),
                    email: document.getElementById('f-admin-email').value.trim(),
                    telephone: document.getElementById('f-admin-telephone').value.trim(),
                    date_embauche: document.getElementById('f-admin-date-embauche').value,
                    departement: document.getElementById('f-admin-departement').value,
                    role: document.getElementById('f-admin-role').value,
                    password: pass
                });
                if (res.ok) {
                    flash(`Administrateur ${res.user ? res.user.prenom : ''} créé avec succès !`, 'success');
                    closeModal('modal-add-admin');
                    formAdd.reset();
                    await renderAdmins(true);
                } else {
                    flash(res.message || 'Erreur lors de la création de l\'administrateur.', 'danger');
                }
            }, 'Création…');
        };
    }

    // Soumission du formulaire de modification d'administrateur
    const formEdit = document.getElementById('form-edit-admin');
    if (formEdit) {
        formEdit.onsubmit = async (e) => {
            e.preventDefault();
            const id = formEdit.dataset.editId;
            if (!id) return;

            const payload = {
                matricule: document.getElementById('f-admin-edit-matricule').value.trim(),
                nom: document.getElementById('f-admin-edit-nom').value.trim(),
                prenom: document.getElementById('f-admin-edit-prenom').value.trim(),
                email: document.getElementById('f-admin-edit-email').value.trim(),
                telephone: document.getElementById('f-admin-edit-telephone').value.trim(),
                date_embauche: document.getElementById('f-admin-edit-date-embauche').value,
                departement: document.getElementById('f-admin-edit-departement').value,
                role: document.getElementById('f-admin-edit-role').value
            };
            const newPass = document.getElementById('f-admin-edit-password').value;
            if (newPass.trim()) {
                payload.password = newPass.trim();
            }

            const submitBtn = e.submitter || document.querySelector('#form-edit-admin button[type="submit"]');
            await withButtonLoading(submitBtn, async () => {
                const res = await api.updateUser(id, payload);
                if (res.ok) {
                    flash('Administrateur mis à jour avec succès !', 'success');
                    closeModal('modal-edit-admin');
                    await renderAdmins(true);
                } else {
                    flash(res.message || 'Erreur lors de la mise à jour.', 'danger');
                }
            }, 'Enregistrement…');
        };
    }
}

// Délégation d'événements Clic globale sur la page des admins
if (!window._adminsGlobalClickAttached) {
    window._adminsGlobalClickAttached = true;
    document.addEventListener('click', async (e) => {
        if (document.body.getAttribute('data-page') !== 'administrateurs') return;

        const detailBtn = e.target.closest('[data-admin-detail]');
        if (detailBtn) {
            const id = parseInt(detailBtn.dataset.adminDetail);
            const u = allAdmins.find(x => x.id === id);
            if (u) showAdminDetail(u);
            return;
        }

        const editBtn = e.target.closest('[data-admin-edit]');
        if (editBtn) {
            const id = parseInt(editBtn.dataset.adminEdit);
            const u = allAdmins.find(x => x.id === id);
            if (u) openEditAdminModal(u);
            return;
        }

        const deleteBtn = e.target.closest('[data-admin-delete]');
        if (deleteBtn) {
            const id = parseInt(deleteBtn.dataset.adminDelete);
            const u = allAdmins.find(x => x.id === id);
            if (u) {
                showConfirmModal({
                    title: 'Supprimer cet administrateur ?',
                    message: `Voulez-vous vraiment supprimer l'administrateur ${u.prenom} ${u.nom} (${u.matricule}) ? Cette action est irréversible.`,
                    type: 'danger',
                    confirmText: 'Oui, Supprimer',
                    cancelText: 'Annuler',
                    onConfirm: async () => {
                        const res = await api.deleteUser(id);
                        if (res.ok) {
                            flash('Administrateur supprimé.', 'success');
                            await renderAdmins(true);
                        } else {
                            flash(res.message || 'Erreur lors de la suppression.', 'danger');
                        }
                    }
                });
            }
            return;
        }
    });
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['administrateurs'] = initAdminPage;
window.initAdminPage = initAdminPage;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminPage);
} else {
    initAdminPage();
}
})();
