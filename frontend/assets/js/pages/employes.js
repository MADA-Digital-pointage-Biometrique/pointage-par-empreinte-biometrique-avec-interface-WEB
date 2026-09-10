(function () {
// ============================================================
// Page : Gestion des employés (& enrôlement via page Capteur)
// ============================================================

function initials(u) {
    if (!u || !u.prenom || !u.nom) return 'U';
    return (u.prenom[0] + u.nom[0]).toUpperCase();
}

function avatar(u, size = 'w-9 h-9') {
    if (u.photo_url) {
        return `<div class="${size} rounded-full overflow-hidden border-2 border-[#F46A21]/30 shadow-sm flex-shrink-0">
            <img src="${u.photo_url}" alt="${u.prenom} ${u.nom}" class="w-full h-full object-cover">
        </div>`;
    }
    return `<div class="${size} rounded-full bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[12px] shadow-sm flex-shrink-0">
        ${initials(u)}
    </div>`;
}

function formatDateFR(dateStr) {
    if (!dateStr) return 'Non renseignée';
    try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const year = parts[0];
            const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
            const month = monthNames[parseInt(parts[1], 10) - 1] || parts[1];
            const day = parseInt(parts[2], 10);
            return `${day} ${month} ${year}`;
        }
        return dateStr;
    } catch (e) {
        return dateStr;
    }
}

function userRow(u) {
    const empBadge = u.empreinte
        ? '<span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800"><span class="material-symbols-outlined text-[13px]">verified</span> Enregistrée</span>'
        : '<span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800"><span class="material-symbols-outlined text-[13px]">block</span> Aucune</span>';
    const isSuper = (() => { try { const cu = api.getCurrentUser(); return cu && (cu.role === 'super_admin' || cu.role === 'admin_systeme'); } catch(e){ return false; } })();
    const crudButtons = isSuper ? `
                    <button class="text-slate-500 hover:text-[#F46A21] hover:bg-[#FFF1E8] dark:hover:bg-orange-950/40 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center" title="Modifier" data-edit="${u.id}">
                        <span class="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button class="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center" title="Supprimer" data-delete="${u.id}">
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>` : '';

    return `
        <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors h-14">
            <td class="py-sm px-md">
                <div class="flex items-center gap-md">
                    ${avatar(u)}
                    <div>
                        <div class="font-semibold text-slate-900 dark:text-white">${escapeHtml(u.prenom)} ${escapeHtml(u.nom)}</div>
                        <div class="text-[11px] text-slate-400 md:hidden">${escapeHtml(u.email || '—')}</div>
                    </div>
                </div>
            </td>
            <td class="py-sm px-md hidden md:table-cell font-mono text-[13px] text-slate-600 dark:text-slate-300">${escapeHtml(u.matricule)}</td>
            <td class="py-sm px-md hidden md:table-cell text-slate-600 dark:text-slate-400">${escapeHtml(u.email || '—')}</td>
            <td class="py-sm px-md font-medium text-slate-700 dark:text-slate-300">${escapeHtml(u.departement || 'Non assigné')}</td>
            <td class="py-sm px-md text-right">
                <div class="inline-flex items-center gap-1">
                    <button class="bg-sky-50 text-sky-600 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center" title="Voir les détails de l'employé" data-detail="${u.id}">
                        <span class="material-symbols-outlined text-[18px]">visibility</span>
                    </button>
                    ${crudButtons}
                </div>
            </td>
        </tr>`;
}

let allUsers = [];
let allDepts = [];
let editingId = null;
let photoEditFile = null;
let addFormEnriched = false;

async function renderUsers(forceFetch = false) {
    if (forceFetch || !allUsers || allUsers.length === 0) {
        const rawUsers = await api.getUsers();
        allUsers = rawUsers.filter(u => u.role === 'employe');
    }
    
    const search     = (document.getElementById('top-search')?.value || '').trim().toLowerCase();
    const filterDept = (document.getElementById('filter-dept')?.value || '').toLowerCase();

    const filtered = allUsers.filter(u => {
        const matchesSearch = !search ||
            u.nom.toLowerCase().includes(search) ||
            u.prenom.toLowerCase().includes(search) ||
            u.matricule.toLowerCase().includes(search) ||
            (u.email || '').toLowerCase().includes(search) ||
            (u.telephone || '').toLowerCase().includes(search) ||
            (u.departement || '').toLowerCase().includes(search);

        const matchesDept = !filterDept || (u.departement || '').toLowerCase() === filterDept;

        return matchesSearch && matchesDept;
    });

    const body = document.getElementById('users-body');
    if (body) {
        body.innerHTML = filtered.map(userRow).join('')
            || '<tr><td colspan="6" class="py-lg px-md text-center text-slate-400">Aucun employé ne correspond aux critères.</td></tr>';
    }

    const summary = document.getElementById('emp-count-summary');
    if (summary) summary.textContent = `${filtered.length} employé(s) sur ${allUsers.length} au total`;

    const badgeEmp = document.getElementById('badge-count-emp');
    if (badgeEmp) badgeEmp.textContent = allUsers.length;

    const isSuper = (() => { try { const cu = api.getCurrentUser(); return cu && (cu.role === 'super_admin' || cu.role === 'admin_systeme'); } catch(e){ return false; } })();
    const btnAddUser = document.getElementById('btn-add-user');
    if (btnAddUser) btnAddUser.classList.toggle('hidden', !isSuper);
}

// ─── Charger les départements depuis la BDD ──────────────────────────────
async function loadDepts() {
    allDepts = await api.getDepartements();
    const selects = [
        document.getElementById('f-departement'),
        document.getElementById('f-edit-departement')
    ];
    selects.forEach(sel => {
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">— Sélectionner un département —</option>';
        allDepts.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.nom;
            if (String(d.id) === String(current)) opt.selected = true;
            sel.appendChild(opt);
        });
    });
}

// ─── Aperçu du matricule selon le département ────────────────────────────
async function updateMatriculePreview(idDept) {
    const matField = document.getElementById('f-matricule-preview');
    if (!matField) return;
    if (!idDept) { matField.textContent = '— sélectionnez un département —'; return; }
    matField.textContent = 'Génération...';
    const mat = await api.getMatriculePreview(idDept);
    matField.textContent = mat || '—';
}

// ─── Enrichir le formulaire d'ajout (une seule fois) ────────────────────
function enrichAddForm() {
    if (addFormEnriched) return;

    const matRow = document.getElementById('f-matricule')?.closest('div');
    if (matRow && !document.getElementById('f-matricule-preview')) {
        matRow.innerHTML = `
            <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block text-xs">
                Matricule <span class="text-slate-400 font-normal">(auto-généré)</span>
            </label>
            <div class="w-full bg-slate-100 dark:bg-slate-700/50 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-500 dark:text-slate-300 select-all" id="f-matricule-preview">
                — sélectionnez un département —
            </div>`;
    }

    const deptSel = document.getElementById('f-departement');
    if (deptSel) {
        deptSel.addEventListener('change', () => updateMatriculePreview(deptSel.value));
    }

    const form = document.getElementById('form-add');
    if (form && !document.getElementById('photo-add-wrap')) {
        const submitDiv = form.querySelector('div.flex.justify-end');
        const wrap = document.createElement('div');
        wrap.id = 'photo-add-wrap';
        wrap.className = 'col-span-2 mt-xs';
        wrap.innerHTML = `
            <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block text-xs">
                Photo de profil <span class="text-slate-400 font-normal">(optionnel · max 3 Mo)</span>
            </label>
            <div class="flex items-center gap-md">
                <div id="photo-add-thumb"
                    class="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 overflow-hidden cursor-pointer transition-colors hover:border-[#F46A21]">
                    <span class="material-symbols-outlined text-[26px]">add_a_photo</span>
                </div>
                <div>
                    <input type="file" id="photo-add-input" accept="image/jpeg,image/png,image/webp" class="hidden">
                    <button type="button" id="photo-add-btn"
                        class="text-xs font-semibold text-[#F46A21] hover:text-[#EA580C] border border-[#F46A21]/30 hover:bg-[#FFF1E8] dark:hover:bg-orange-950/30 px-md py-1.5 rounded-lg transition-colors cursor-pointer">
                        Choisir une image
                    </button>
                    <p id="photo-add-name" class="text-[11px] text-slate-400 mt-1">Aucun fichier sélectionné</p>
                </div>
            </div>`;
        if (submitDiv) form.insertBefore(wrap, submitDiv);
        else form.appendChild(wrap);

        const fileInput = document.getElementById('photo-add-input');
        const thumb     = document.getElementById('photo-add-thumb');
        const nameLabel = document.getElementById('photo-add-name');
        document.getElementById('photo-add-btn')?.addEventListener('click', () => fileInput.click());
        thumb?.addEventListener('click', () => fileInput.click());
        fileInput?.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (!file) return;
            nameLabel.textContent = file.name;
            const reader = new FileReader();
            reader.onload = ev => {
                thumb.innerHTML = `<img src="${ev.target.result}" class="w-full h-full object-cover">`;
            };
            reader.readAsDataURL(file);
        });
    }

    addFormEnriched = true;
}

function setupEditPhotoHandlers() {
    const fileInput = document.getElementById('photo-edit-input');
    const btn       = document.getElementById('photo-edit-btn');
    const thumb     = document.getElementById('photo-edit-thumb');
    const nameLabel = document.getElementById('photo-edit-name');

    if (!fileInput || !btn || !thumb) return;

    const triggerInput = () => fileInput.click();
    btn.onclick   = triggerInput;
    thumb.onclick = triggerInput;

    fileInput.onchange = () => {
        const file = fileInput.files[0];
        if (!file) return;
        photoEditFile = file;
        if (nameLabel) nameLabel.textContent = file.name;
        const reader = new FileReader();
        reader.onload = ev => {
            thumb.innerHTML = `<img src="${ev.target.result}" class="w-full h-full object-cover">`;
        };
        reader.readAsDataURL(file);
    };
}

// ─── MODALES ET ACTIONS ──────────────────────────────────────────────────
function openDetailModal(target) {
    if (!target) return;
    const avatarContainer = document.getElementById('detail-avatar-container');
    if (avatarContainer) {
        avatarContainer.innerHTML = avatar(target, 'w-16 h-16 text-lg');
    }

    const setTxt = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
    };

    setTxt('detail-name', `${target.prenom} ${target.nom}`);
    setTxt('detail-matricule', target.matricule || '—');

    const elRoleBadge = document.getElementById('detail-role-badge');
    if (elRoleBadge) {
        elRoleBadge.innerHTML = '<span class="inline-flex items-center gap-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700"><span class="material-symbols-outlined text-[13px]">person</span> Employé</span>';
    }

    const elEmpBadge = document.getElementById('detail-emp-badge');
    if (elEmpBadge) {
        elEmpBadge.innerHTML = target.empreinte
            ? '<span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-200"><span class="material-symbols-outlined text-[13px]">verified</span> Empreinte OK</span>'
            : '<span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-amber-200"><span class="material-symbols-outlined text-[13px]">block</span> Sans Empreinte</span>';
    }

    const setHtmlIcon = (id, icon, text) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<span class="material-symbols-outlined text-[16px] text-slate-400">${icon}</span> ${text}`;
    };

    setHtmlIcon('detail-email', 'mail', target.email || 'Non renseigné');
    setHtmlIcon('detail-phone', 'call', target.telephone || 'Non renseigné');
    setHtmlIcon('detail-dept', 'domain', target.departement || 'Non assigné');
    setHtmlIcon('detail-date-embauche', 'calendar_today', formatDateFR(target.date_embauche));
    setHtmlIcon('detail-poste', 'work', target.poste || 'Employé');

    const isSuper = (() => { try { const cu = api.getCurrentUser(); return cu && (cu.role === 'super_admin' || cu.role === 'admin_systeme'); } catch(e){ return false; } })();
    const btnDetailEdit = document.getElementById('btn-detail-edit');
    if (btnDetailEdit) {
        btnDetailEdit.classList.toggle('hidden', !isSuper);
        btnDetailEdit.onclick = () => {
            closeModal('modal-detail');
            openEditModal(target);
        };
    }

    openModal('modal-detail');
}

async function openEditModal(target) {
    if (!target) return;
    editingId     = target.id;
    photoEditFile = null;

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('f-edit-matricule', target.matricule);
    setVal('f-edit-nom', target.nom);
    setVal('f-edit-prenom', target.prenom);
    setVal('f-edit-email', target.email);
    setVal('f-edit-telephone', target.telephone);
    setVal('f-edit-date-embauche', target.date_embauche || new Date().toISOString().slice(0, 10));

    await loadDepts();
    const deptSel = document.getElementById('f-edit-departement');
    if (deptSel && target.id_departement) deptSel.value = target.id_departement;

    setupEditPhotoHandlers();
    const thumb     = document.getElementById('photo-edit-thumb');
    const nameLabel = document.getElementById('photo-edit-name');
    if (thumb) {
        if (target.photo_url) {
            thumb.innerHTML = `<img src="${target.photo_url}" class="w-full h-full object-cover">`;
        } else {
            thumb.innerHTML = '<span class="material-symbols-outlined text-[26px]">edit_square</span>';
        }
    }
    if (nameLabel) {
        nameLabel.textContent = target.photo_url ? 'Changer la photo existante' : 'Conserver la photo actuelle';
    }

    openModal('modal-edit');
}

function openDeleteModal(target) {
    if (!target) return;
    showConfirmModal({
        title:       'Supprimer cet employé ?',
        message:     `Voulez-vous vraiment supprimer ${target.prenom} ${target.nom} (${target.matricule}) ? Cette action effacera également son historique de pointage.`,
        type:        'danger',
        confirmText: 'Oui, Supprimer',
        cancelText:  'Annuler',
        onConfirm: async () => {
            const res = await api.deleteUser(target.id);
            if (res.ok) {
                flash(`L'employé ${target.prenom} ${target.nom} a été supprimé.`, 'success');
                await renderUsers(true);
            } else {
                flash(res.message || 'Échec de la suppression.', 'danger');
            }
        }
    });
}

// ─── GESTIONNAIRE DE CLICS GLOBAL PAR DÉLÉGATION ─────────────────────────
if (!window._employesGlobalClickAttached) {
    window._employesGlobalClickAttached = true;
    document.addEventListener('click', (e) => {
        // Ne traiter que si la vue active est "employes"
        if (document.body.getAttribute('data-page') !== 'employes') return;

        const detailBtn = e.target.closest('[data-detail]');
        if (detailBtn) {
            const id = parseInt(detailBtn.dataset.detail, 10);
            const target = allUsers.find(u => u.id === id);
            if (target) openDetailModal(target);
            return;
        }

        const editBtn = e.target.closest('[data-edit]');
        if (editBtn) {
            const id = parseInt(editBtn.dataset.edit, 10);
            const target = allUsers.find(u => u.id === id);
            if (target) openEditModal(target);
            return;
        }

        const deleteBtn = e.target.closest('[data-delete]');
        if (deleteBtn) {
            const id = parseInt(deleteBtn.dataset.delete, 10);
            const target = allUsers.find(u => u.id === id);
            if (target) openDeleteModal(target);
            return;
        }


    });
}

async function initPage() {
    window._lastInitializedModule = 'employes';
    const user = api.getCurrentUser();
    if (!user) return;

    if (user.role !== 'admin' && user.role !== 'super_admin') {
        flash('Accès réservé aux administrateurs.', 'danger');
        setTimeout(() => { window.location.href = 'dashboard.php'; }, 1500);
        return;
    }

    addFormEnriched = false;
    await renderUsers(true);
    const searchInput = document.getElementById('top-search');
    if (searchInput) searchInput.oninput = () => renderUsers(false);

    const filterDept = document.getElementById('filter-dept');
    if (filterDept) filterDept.onchange = () => renderUsers(false);
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.onclick = () => closeModal(btn.dataset.close);
    });

    document.querySelectorAll('[id^="modal-"]').forEach(backdrop => {
        backdrop.onclick = (e) => {
            if (e.target === backdrop) closeModal(backdrop.id);
        };
    });

    // ─── Bouton Ajouter (masqué pour admin en lecture seule) ────────────────
    const btnAdd = document.getElementById('btn-add-user');
    if (btnAdd) {
        const cur = api.getCurrentUser();
        if (cur && cur.role === 'admin') {
            btnAdd.style.display = 'none';
        } else {
            btnAdd.onclick = async () => {
                openModal('modal-add');
                await loadDepts();
                enrichAddForm();
                const dateInput = document.getElementById('f-date-embauche');
                if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
                const deptSel = document.getElementById('f-departement');
                if (deptSel) updateMatriculePreview(deptSel.value);
            };
        }
    }

    // ─── Soumission du formulaire Ajouter ────────────────────────────────────
    const formAdd = document.getElementById('form-add');
    if (formAdd) {
        formAdd.onsubmit = async (e) => {
            e.preventDefault();
            const deptSel    = document.getElementById('f-departement');
            const idDept     = deptSel ? parseInt(deptSel.value, 10) : 0;
            const photoInput = document.getElementById('photo-add-input');
            const photoFile  = photoInput?.files?.[0] || null;

            const dateEmbauche = document.getElementById('f-date-embauche')?.value || new Date().toISOString().slice(0, 10);

            const roleInput = document.getElementById('f-role');
            const roleVal = roleInput ? roleInput.value : 'employe';

            const res = await api.addUser({
                nom:            document.getElementById('f-nom').value.trim(),
                prenom:         document.getElementById('f-prenom').value.trim(),
                email:          document.getElementById('f-email').value.trim(),
                telephone:      document.getElementById('f-telephone')?.value.trim() || '',
                date_embauche:  dateEmbauche,
                id_departement: idDept || '',
                role:           roleVal,
                password:       null
            }, photoFile);

            if (res.ok) {
                flash(`Employé ${res.user.prenom} ${res.user.nom} (${res.user.matricule}) ajouté avec succès.`, 'success');
                closeModal('modal-add');
                formAdd.reset();
                const thumb = document.getElementById('photo-add-thumb');
                if (thumb) thumb.innerHTML = '<span class="material-symbols-outlined text-[26px]">add_a_photo</span>';
                const nameLabel = document.getElementById('photo-add-name');
                if (nameLabel) nameLabel.textContent = 'Aucun fichier sélectionné';
                await renderUsers(true);
            } else {
                flash(res.message, 'danger');
            }
        };
    }

    // ─── Soumission du formulaire Modifier ───────────────────────────────────
    const formEdit = document.getElementById('form-edit');
    if (formEdit) {
        formEdit.onsubmit = async (e) => {
            e.preventDefault();
            if (editingId === null) return;
            
            const deptSel = document.getElementById('f-edit-departement');
            const idDept  = deptSel ? parseInt(deptSel.value, 10) : 0;

            const roleInput = document.getElementById('f-edit-role');
            const roleVal = roleInput ? roleInput.value : 'employe';

            const res = await api.updateUser(editingId, {
                matricule:      document.getElementById('f-edit-matricule').value.trim(),
                nom:            document.getElementById('f-edit-nom').value.trim(),
                prenom:         document.getElementById('f-edit-prenom').value.trim(),
                email:          document.getElementById('f-edit-email').value.trim(),
                telephone:      document.getElementById('f-edit-telephone')?.value.trim() || '',
                date_embauche:  document.getElementById('f-edit-date-embauche')?.value || '',
                id_departement: idDept || '',
                departement:    deptSel ? deptSel.options[deptSel.selectedIndex]?.text : '',
                role:           roleVal
            }, photoEditFile);

            if (res.ok) {
                flash(`Employé ${res.user.prenom} ${res.user.nom} (${res.user.matricule}) mis à jour avec succès.`, 'success');
                closeModal('modal-edit');
                editingId = null;
                photoEditFile = null;
                formEdit.reset();
                await renderUsers(true);
            } else {
                flash(res.message, 'danger');
            }
        };
    }
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['employes'] = initPage;
window.initPage = initPage;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    initPage();
}
})();