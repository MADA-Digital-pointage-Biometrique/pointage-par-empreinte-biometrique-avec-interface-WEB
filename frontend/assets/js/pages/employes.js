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
            <img src="${u.photo_url}" alt="${escapeHtml(u.prenom)} ${escapeHtml(u.nom)}" class="w-full h-full object-cover">
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
        message:     `Voulez-vous vraiment supprimer ${target.prenom} ${target.nom} (${target.matricule}) ? Cette action effacera également son historique de pointage et son empreinte capteur.`,
        type:        'danger',
        confirmText: 'Oui, Supprimer',
        cancelText:  'Annuler',
        onConfirm: async () => {
            const res = await api.deleteUser(target.id);
            if (res.ok) {
                // Message serveur (inclut l'avertissement si le capteur
                // était injoignable pour purger l'empreinte).
                flash(res.message || `L'employé ${target.prenom} ${target.nom} a été supprimé.`, res.capteur_purge === false ? 'warning' : 'success');
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
            // Vue détail in-page (remplace la liste, sidebar/topbar intacts).
            // Repli : modale si la vue détail est indisponible.
            if (typeof showEmployeeDetail === 'function') showEmployeeDetail(id);
            else {
                const target = allUsers.find(u => u.id === id);
                if (target) openDetailModal(target);
            }
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

            const submitBtn = e.submitter || document.querySelector('#form-add button[type="submit"]');
            await withButtonLoading(submitBtn, async () => {
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
            }, 'Création…');
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

            const submitBtn = e.submitter || document.querySelector('#form-edit button[type="submit"]');
            await withButtonLoading(submitBtn, async () => {
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
                    if (typeof empDetailRefreshAfterEdit === 'function') { try { await empDetailRefreshAfterEdit(); } catch {} }
                } else {
                    flash(res.message, 'danger');
                }
            }, 'Enregistrement…');
        };
    }
}

// ============================================================
// VUE DÉTAILS EMPLOYÉ (in-page : remplace la liste, sidebar/header
// intacts, Retour = ré-affiche la liste). Données 100 % réelles :
// api.getUsers() + api.getAllPointages(), calculs côté client avec
// les mêmes règles que le reste de l'app (retard > 08:30:00,
// dimanche non ouvré). Aucune route, aucune modale, aucun backend.
// ============================================================
const EMPD_PAGE_SIZE = 5;
const EMPD_MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
let empDetailState = null;   // { userId, page, dateFrom, dateTo, statut, monthKey }
let empDetailCharts = [];

function empDetailDestroyCharts() {
    empDetailCharts.forEach(c => { try { c.destroy(); } catch {} });
    empDetailCharts = [];
}

function empDetailFmtJJMMAAAA(iso) {
    if (!iso) return '—';
    const p = String(iso).slice(0, 10).split('-');
    return (p.length === 3) ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

function empDetailMonthLabel(key) {
    const [y, m] = key.split('-').map(Number);
    return `${EMPD_MONTHS[(m || 1) - 1]} ${y}`;
}

function empDetailCurrentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function empDetailMonthEndDay(key) {
    const [y, m] = key.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    if (key === empDetailCurrentMonthKey()) {
        return Math.min(new Date().getDate(), last);
    }
    return last;
}

function empDetailWorkdays(key) {
    // Jours ouvrés lun–sam écoulés du mois (dimanche exclu, comme le dashboard).
    const [y, m] = key.split('-').map(Number);
    const end = empDetailMonthEndDay(key);
    const out = [];
    for (let d = 1; d <= end; d++) {
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (typeof isWorkday === 'function' ? isWorkday(iso) : (new Date(y, m - 1, d).getDay() !== 0)) out.push(iso);
    }
    return out;
}

function empDetailTimeToHours(t) {
    if (!t) return null;
    const p = String(t).split(':').map(Number);
    if (p.length < 2 || p.some(isNaN)) return null;
    return p[0] + (p[1] / 60) + ((p[2] || 0) / 3600);
}

function empDetailFmtHour(h) {
    if (h === null || h === undefined || isNaN(h)) return '—';
    const H = Math.floor(h), M = Math.round((h - H) * 60);
    return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`;
}

function empDetailDuree(p) {
    if (typeof p.total_secondes === 'number' && p.total_secondes >= 0) {
        const s = Math.floor(p.total_secondes);
        return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
    }
    if (!p.entree || !p.sortie) return '—';
    const [h1, m1] = p.entree.split(':').map(Number);
    const [h2, m2] = p.sortie.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60;
    return `${Math.floor(diff / 60)}h ${String(diff % 60).padStart(2, '0')}m`;
}

function empDetailStatutBadge(p) {
    if (!p.sortie) {
        return '<span class="inline-flex items-center gap-1 bg-[#FFF1E8] text-[#F46A21] dark:bg-orange-950/40 dark:text-[#F9AE3F] font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-[#F46A21]/25 dark:border-orange-900"><span class="material-symbols-outlined text-[13px]">pending</span> En cours</span>';
    }
    if (typeof isRetard === 'function' && isRetard(p.entree)) {
        return '<span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800"><span class="material-symbols-outlined text-[13px]">schedule</span> Retard</span>';
    }
    return '<span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800"><span class="material-symbols-outlined text-[13px]">check_circle</span> Présent</span>';
}

function empDetailMethode(p) {
    const m = String(p.methode_verification || p.source_donnee || '').toLowerCase();
    if (m.includes('biom')) return 'Biométrique';
    if (m.includes('manu')) return 'Manuel';
    return '—';
}

function empDetailDayStatut(todayRow) {
    if (!todayRow) return { key: 'none', label: 'Pas encore pointé', cls: 'slate' };
    if (typeof isRetard === 'function' && isRetard(todayRow.entree)) return { key: 'retard', label: 'En retard', cls: 'amber' };
    return { key: 'present', label: 'Présent', cls: 'emerald' };
}

function empDetailLastEvent(rows) {
    // Dernier événement horodaté (toutes journées confondues), type associé.
    let best = null;
    rows.forEach(r => {
        [['sortie2', 'Sortie'], ['sortie', 'Sortie'], ['entree2', 'Entrée'], ['entree', 'Entrée']].forEach(([f, type]) => {
            if (r[f] && (!best || r.date > best.date || (r.date === best.date && r[f] > best.heure))) {
                best = { date: r.date, heure: String(r[f]).slice(0, 5), type };
            }
        });
    });
    return best;
}

function empDetailPalette() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
        text: isDark ? '#CBD5E1' : '#475569',
        grid: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.15)'
    };
}

function empDetailTauxRing(pct) {
    const r = 34, c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(100, pct));
    return `<svg width="88" height="88" viewBox="0 0 88 88" class="shrink-0">`
        + `<circle cx="44" cy="44" r="${r}" fill="none" stroke-width="9" class="stroke-slate-200 dark:stroke-slate-700"/>`
        + `<circle cx="44" cy="44" r="${r}" fill="none" stroke="#10B981" stroke-width="9" stroke-linecap="round"`
        + ` stroke-dasharray="${(v / 100 * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 44 44)"/>`
        + `<text x="44" y="44" text-anchor="middle" dominant-baseline="central" font-size="16" font-weight="800" class="fill-slate-800 dark:fill-white">${v}%</text></svg>`;
}

function empDetailRenderCharts() {
    empDetailDestroyCharts();
    if (!empDetailState || !empDetailState.data) return;
    const { monthRows, month } = empDetailState.data;
    const pal = empDetailPalette();

    // --- Barres 7 derniers jours : Entrée / Sortie ---
    // Même forme que la tendance du dashboard (type bar, borderRadius,
    // légende haut, animation 400 ms) adaptée aux heures de l'employé.
    const cTrend = document.getElementById('empd-chart-trend');
    if (cTrend && window.Chart) {
        const days = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        }
        const allRows = empDetailState.data.allRows;
        const findRow = (iso) => (allRows.find(r => r.date === iso) || {});
        const entrees = days.map(iso => empDetailTimeToHours(findRow(iso).entree));
        const sorties = days.map(iso => empDetailTimeToHours(findRow(iso).sortie));
        const vals = [...entrees, ...sorties].filter(v => v !== null && !isNaN(v));
        const lo = vals.length ? Math.floor(Math.min(...vals) - 0.5) : 6;
        const hi = vals.length ? Math.ceil(Math.max(...vals) + 0.5) : 18;
        empDetailCharts.push(new Chart(cTrend, {
            type: 'bar',
            data: {
                labels: days.map(iso => iso.slice(8, 10) + '/' + iso.slice(5, 7)),
                datasets: [
                    { label: 'Entrée', data: entrees, backgroundColor: '#10B981', borderRadius: 6 },
                    { label: 'Sortie', data: sorties, backgroundColor: '#F59E0B', borderRadius: 6 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 400 },
                plugins: { legend: { position: 'top', labels: { color: pal.text, font: { size: 11, weight: '600' } } } },
                scales: {
                    x: { grid: { color: pal.grid }, ticks: { color: pal.text, font: { size: 11 } } },
                    y: { min: lo, max: hi, grid: { color: pal.grid }, ticks: { color: pal.text, font: { size: 11 }, stepSize: 0.5, callback: (v) => empDetailFmtHour(v) } }
                }
            }
        }));
    }

    // --- Donut répartition mensuelle ---
    const cDonut = document.getElementById('empd-chart-donut');
    if (cDonut && window.Chart) {
        const isDark = document.documentElement.classList.contains('dark');
        const aLHeure = Math.max(0, month.presences - month.retards);
        const values = [aLHeure, month.retards, month.absences];
        const isEmpty = values.every(v => !v || v <= 0);
        empDetailCharts.push(new Chart(cDonut, {
            type: 'doughnut',
            data: {
                labels: isEmpty ? ['Aucune donnée'] : ["Présences", 'Retards', 'Absences'],
                datasets: [{
                    data: isEmpty ? [1] : values,
                    backgroundColor: isEmpty ? [isDark ? '#374151' : '#E5E7EB'] : ['#10B981', '#F59E0B', '#F43F5E'],
                    borderWidth: 3,
                    borderColor: isDark ? '#1F2937' : '#FFFFFF',
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '72%',
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw} jour(s)` } } }
            }
        }));
    }
}

if (!window._empDetailThemeHook) {
    window._empDetailThemeHook = true;
    document.addEventListener('mada:themeChanged', () => { if (document.getElementById('empd-root')) empDetailRenderCharts(); });
}

function empDetailFilteredHistory() {
    const st = empDetailState;
    const rows = st.data.allRows.filter(r => r.date >= st.dateFrom && r.date <= st.dateTo);
    const s = st.statut;
    return rows.filter(r => {
        if (s === 'present') return !((typeof isRetard === 'function') && isRetard(r.entree)) && r.sortie !== null;
        if (s === 'retard') return (typeof isRetard === 'function') && isRetard(r.entree);
        if (s === 'encours') return !r.sortie;
        return true;
    }).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function empDetailRenderHistory() {
    const st = empDetailState;
    if (!st) return;
    const rows = empDetailFilteredHistory();
    const totalPages = Math.max(1, Math.ceil(rows.length / EMPD_PAGE_SIZE));
    if (st.page > totalPages) st.page = totalPages;
    const start = (st.page - 1) * EMPD_PAGE_SIZE;
    const pageRows = rows.slice(start, start + EMPD_PAGE_SIZE);

    const tbody = document.getElementById('empd-tbody');
    if (tbody) {
        tbody.innerHTML = pageRows.map((p, i) =>
            `<tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors h-14">`
            + `<td class="py-sm px-md text-slate-400 font-mono">${start + i + 1}</td>`
            + `<td class="py-sm px-md font-mono text-[12px] text-slate-600 dark:text-slate-300 whitespace-nowrap">${empDetailFmtJJMMAAAA(p.date)}</td>`
            + `<td class="py-sm px-md font-mono text-[12px] whitespace-nowrap">${p.entree ? String(p.entree).slice(0, 5) : '—'}</td>`
            + `<td class="py-sm px-md font-mono text-[12px] whitespace-nowrap">${p.sortie ? String(p.sortie).slice(0, 5) : '—'}</td>`
            + `<td class="py-sm px-md font-mono text-[12px] whitespace-nowrap">${empDetailDuree(p)}</td>`
            + `<td class="py-sm px-md whitespace-nowrap">${empDetailStatutBadge(p)}</td>`
            + `<td class="py-sm px-md text-slate-600 dark:text-slate-300 whitespace-nowrap">${escapeHtml(empDetailMethode(p))}</td>`
            + `</tr>`
        ).join('') || '<tr><td colspan="7" class="py-lg px-md text-center text-slate-400">Aucun pointage sur la période filtrée.</td></tr>';
    }
    const from = rows.length === 0 ? 0 : start + 1;
    const count = document.getElementById('empd-count');
    if (count) count.textContent = `${from} – ${Math.min(start + EMPD_PAGE_SIZE, rows.length)} sur ${rows.length}`;
    const pager = document.getElementById('empd-pager');
    if (pager) {
        let nums = '';
        for (let p = 1; p <= totalPages; p++) {
            nums += `<button type="button" data-empd-page="${p}" class="min-w-[28px] h-7 px-1.5 rounded-lg text-[12px] font-semibold cursor-pointer transition-colors ${p === st.page ? 'bg-[#F46A21] text-white shadow-md shadow-orange-500/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}">${p}</button>`;
        }
        pager.innerHTML = `<button type="button" data-empd-page="prev" class="w-7 h-7 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" ${st.page <= 1 ? 'disabled' : ''} title="Précédent"><span class="material-symbols-outlined text-[16px]">chevron_left</span></button>`
            + nums
            + `<button type="button" data-empd-page="next" class="w-7 h-7 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" ${st.page >= totalPages ? 'disabled' : ''} title="Suivant"><span class="material-symbols-outlined text-[16px]">chevron_right</span></button>`;
    }
}

function empDetailExportCSV() {
    const st = empDetailState;
    if (!st) return;
    const u = st.data.user;
    const rows = empDetailFilteredHistory();
    const now = new Date();
    const sep = ';';
    const lines = [];
    lines.push('MADA DIGITAL - FICHE INDIVIDUELLE DE POINTAGE');
    lines.push(`Employé${sep}"${u.prenom || ''} ${u.nom || ''} (${u.matricule || ''})"`);
    lines.push(`Date d'extraction${sep}"${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}"`);
    lines.push(`Période${sep}"${empDetailFmtJJMMAAAA(st.dateFrom)} au ${empDetailFmtJJMMAAAA(st.dateTo)}"`);
    lines.push(`Volume${sep}"${rows.length}"`);
    lines.push('');
    lines.push(['Date', "Heure d'entrée", 'Heure de sortie', 'Durée', 'Statut', 'Capteur'].map(c => `"${c}"`).join(sep));
    rows.forEach(p => {
        const statut = !p.sortie ? 'Journée en cours' : (((typeof isRetard === 'function') && isRetard(p.entree)) ? 'En Retard' : 'Présent');
        lines.push([
            empDetailFmtJJMMAAAA(p.date),
            p.entree ? String(p.entree).slice(0, 8) : '—',
            p.sortie ? String(p.sortie).slice(0, 8) : 'Non pointé',
            empDetailDuree(p), statut, empDetailMethode(p)
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(sep));
    });
    const csv = '\uFEFF' + lines.join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Detail_Pointage_${u.matricule || u.id}_${typeof todayISO === 'function' ? todayISO() : ''}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flash('Export CSV de l\u2019employé téléchargé.', 'success');
}

async function empDetailRefreshAfterEdit() {
    // Appelé après Enregistrer (modale Modifier) si la vue détail est ouverte.
    if (!empDetailState) return;
    const id = empDetailState.userId;
    const keep = { page: empDetailState.page, dateFrom: empDetailState.dateFrom, dateTo: empDetailState.dateTo, statut: empDetailState.statut };
    await showEmployeeDetail(id, keep);
}

async function showEmployeeDetail(userId, keepState) {
    const main = document.querySelector('main');
    if (!main) return;
    let users = [];
    try {
        users = await api.getUsers();
        if (!users || !users.length) users = allUsers;
    } catch { users = allUsers; }
    const user = (users || []).find(u => u.id === userId && (u.role === 'employe' || !u.role))
        || allUsers.find(u => u.id === userId);
    if (!user) { flash('Employé introuvable.', 'danger'); return; }

    let pointages = [];
    try { pointages = await api.getAllPointages() || []; } catch { pointages = []; }
    const allRows = (pointages || []).filter(p => p.user_id === userId);

    const monthKey = empDetailCurrentMonthKey();
    const mStart = monthKey + '-01';
    const mEnd = (() => { const [y, m] = monthKey.split('-').map(Number); const last = new Date(y, m, 0).getDate(); const t = typeof todayISO === 'function' ? todayISO() : ''; return (t.slice(0, 7) === monthKey) ? t : `${monthKey}-${String(last).padStart(2, '0')}`; })();
    const monthRows = allRows.filter(r => r.date >= mStart && r.date <= mEnd);
    const presDates = new Set(monthRows.filter(r => r.entree).map(r => r.date));
    const retards = monthRows.filter(r => (typeof isRetard === 'function') && isRetard(r.entree)).length;
    const ouvrés = empDetailWorkdays(monthKey).length;
    const presences = presDates.size;
    const absences = Math.max(0, ouvrés - presences);
    const taux = ouvrés > 0 ? Math.round((presences / ouvrés) * 100) : 100;
    const month = { key: monthKey, label: empDetailMonthLabel(monthKey), presences, retards, absences, taux, total: presences + absences };

    const today = (typeof todayISO === 'function') ? todayISO() : '';
    const todayRow = allRows.find(r => r.date === today) || null;
    const dayStatut = empDetailDayStatut(todayRow);
    const last = empDetailLastEvent(allRows);

    empDetailState = {
        userId,
        page: (keepState && keepState.page) || 1,
        dateFrom: (keepState && keepState.dateFrom) || mStart,
        dateTo: (keepState && keepState.dateTo) || mEnd,
        statut: (keepState && keepState.statut) || '',
        data: { user, allRows, monthRows, month, todayRow, dayStatut, last }
    };

    // Masque la liste (sans la détruire : les handlers délégués survivent)
    // + masque la recherche topbar (inutile en vue détail).
    [...main.children].forEach(el => {
        if (el.id !== 'flash' && el.id !== 'empd-root') el.classList.add('hidden');
    });
    const topSearchWrap = document.getElementById('top-search')?.closest('div.relative.w-full.max-w-sm');
    if (topSearchWrap) topSearchWrap.style.display = 'none';
    let root = document.getElementById('empd-root');
    if (root) root.remove();
    root = document.createElement('div');
    root.id = 'empd-root';
    main.appendChild(root);

    const isSuper = (() => { try { const cu = api.getCurrentUser(); return cu && (cu.role === 'super_admin' || cu.role === 'admin_systeme'); } catch(e){ return false; } })();
    const dayCls = { slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800' }[dayStatut.cls];
    const dayIcon = dayStatut.key === 'present' ? 'check_circle' : (dayStatut.key === 'retard' ? 'schedule' : 'hourglass_empty');
    const statutCompte = (user.statut || 'actif') === 'actif'
        ? '<span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800"><span class="material-symbols-outlined text-[13px]">check_circle</span> Actif</span>'
        : '<span class="inline-flex items-center gap-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700"><span class="material-symbols-outlined text-[13px]">block</span> Inactif</span>';

    root.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-lg">
            <div class="flex items-center gap-md">
                <button type="button" id="empd-back" class="inline-flex items-center gap-1.5 text-[13px] font-semibold px-md py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                    <span class="material-symbols-outlined text-[18px]">arrow_back</span> Retour
                </button>
                <div>
                    <h2 class="font-bold text-2xl tracking-tight text-slate-900 dark:text-white">Détails de l'employé</h2>
                    <p class="text-slate-500 dark:text-slate-400 text-[13px] mt-0.5">Informations personnelles et historique des pointages</p>
                </div>
            </div>
            <div class="flex items-center gap-sm">
                ${isSuper ? `<button type="button" id="empd-edit" class="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#F46A21] to-[#F9AE3F] hover:from-[#EA580C] hover:to-[#F59E0B] text-white text-[13px] font-semibold px-md py-2 rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer"><span class="material-symbols-outlined text-[18px]">edit</span> Modifier</button>` : ''}
                <button type="button" data-print class="inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[13px] font-semibold px-md py-2 rounded-xl transition-all cursor-pointer"><span class="material-symbols-outlined text-[18px]">print</span> Imprimer</button>
            </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-12 gap-lg mb-lg">
            <div class="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm p-lg">
                <div class="flex items-center gap-md">
                    ${avatar(user, 'w-16 h-16 text-lg')}
                    <div class="min-w-0">
                        <div class="font-bold text-lg text-slate-900 dark:text-white truncate">${escapeHtml(user.prenom)} ${escapeHtml(user.nom)}</div>
                        <div class="mt-1">${statutCompte}</div>
                    </div>
                </div>
                <div class="mt-md space-y-2 text-[13px]">
                    <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400"><span class="material-symbols-outlined text-[18px]">badge</span><span class="w-24 shrink-0">Matricule</span><span class="font-mono font-semibold text-slate-800 dark:text-slate-200">: ${escapeHtml(user.matricule || '—')}</span></div>
                    <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400"><span class="material-symbols-outlined text-[18px]">mail</span><span class="w-24 shrink-0">Email</span><span class="font-semibold text-slate-800 dark:text-slate-200 truncate">: ${escapeHtml(user.email || '—')}</span></div>
                    <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400"><span class="material-symbols-outlined text-[18px]">domain</span><span class="w-24 shrink-0">Département</span><span class="font-semibold text-slate-800 dark:text-slate-200">: ${escapeHtml(user.departement || 'Non assigné')}</span></div>
                    <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400"><span class="material-symbols-outlined text-[18px]">work</span><span class="w-24 shrink-0">Poste</span><span class="font-semibold text-slate-800 dark:text-slate-200">: ${escapeHtml(user.poste || 'Non renseigné')}</span></div>
                </div>
            </div>

            <div class="xl:col-span-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm p-lg">
                <h3 class="font-bold text-[14px] text-slate-900 dark:text-white mb-md">Statut du jour</h3>
                <span class="inline-flex items-center gap-1.5 font-semibold text-[13px] px-3 py-1 rounded-full border ${dayCls}"><span class="material-symbols-outlined text-[16px]">${dayIcon}</span> ${dayStatut.label}</span>
                <div class="mt-md pt-md border-t border-slate-100 dark:border-slate-800">
                    <div class="text-[12px] text-slate-400 mb-1">Dernier pointage</div>
                    ${last
                        ? `<div class="flex items-center gap-2 font-mono font-semibold text-[14px] text-slate-800 dark:text-slate-200"><span class="material-symbols-outlined text-[18px] text-slate-400">schedule</span> ${empDetailFmtJJMMAAAA(last.date)} <span class="text-slate-400">-</span> ${escapeHtml(last.heure)}</div>
                           <div class="mt-1"><span class="inline-flex items-center font-semibold text-[11px] px-2.5 py-0.5 rounded-full border ${last.type === 'Sortie' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' : 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200/70 dark:border-sky-800'}">${escapeHtml(last.type)}</span></div>`
                        : '<div class="text-[13px] text-slate-400">Aucun pointage enregistré.</div>'}
                </div>
            </div>

            <div class="xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm p-lg">
                <h3 class="font-bold text-[14px] text-slate-900 dark:text-white mb-md">Résumé du mois (${month.label})</h3>
                <div class="flex items-center justify-around gap-2 text-center">
                    <div><div class="font-extrabold text-2xl text-slate-900 dark:text-white">${month.presences}</div><div class="text-[11px] text-slate-400 mt-0.5">Présences</div></div>
                    <div><div class="font-extrabold text-2xl text-slate-900 dark:text-white">${month.retards}</div><div class="text-[11px] text-slate-400 mt-0.5">Retards</div></div>
                    <div><div class="font-extrabold text-2xl text-slate-900 dark:text-white">${month.absences}</div><div class="text-[11px] text-slate-400 mt-0.5">Absences</div></div>
                    <div class="flex flex-col items-center gap-1">${empDetailTauxRing(month.taux)}<div class="text-[11px] text-slate-400">Taux de présence</div></div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-lg mb-lg">
            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm p-lg">
                <h3 class="font-bold text-[14px] text-slate-900 dark:text-white">Évolution des pointages <span class="font-medium text-slate-400 text-[12px]">(7 derniers jours)</span></h3>
                <div class="mt-2 h-[220px]"><canvas id="empd-chart-trend"></canvas></div>
            </div>
            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm p-lg">
                <h3 class="font-bold text-[14px] text-slate-900 dark:text-white">Répartition des pointages <span class="font-medium text-slate-400 text-[12px]">(mois)</span></h3>
                <div class="mt-2 flex items-center gap-md">
                    <div class="relative w-[150px] h-[150px] shrink-0"><canvas id="empd-chart-donut"></canvas>
                        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span class="font-extrabold text-xl text-slate-900 dark:text-white">${month.total}</span>
                            <span class="text-[11px] text-slate-400">jours</span>
                        </div>
                    </div>
                    <div class="space-y-1.5 text-[12px]">
                        <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span><span class="text-slate-500 dark:text-slate-400">Présences</span><span class="ml-auto font-bold text-slate-800 dark:text-slate-200 pl-3">${month.presences}</span></div>
                        <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span><span class="text-slate-500 dark:text-slate-400">Retards</span><span class="ml-auto font-bold text-slate-800 dark:text-slate-200 pl-3">${month.retards}</span></div>
                        <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span><span class="text-slate-500 dark:text-slate-400">Absences</span><span class="ml-auto font-bold text-slate-800 dark:text-slate-200 pl-3">${month.absences}</span></div>
                    </div>
                </div>
            </div>
            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm p-lg">
                <h3 class="font-bold text-[14px] text-slate-900 dark:text-white mb-sm">Informations supplémentaires</h3>
                <div class="divide-y divide-slate-100 dark:divide-slate-800/60 text-[13px]">
                    <div class="flex items-center justify-between gap-2 py-2"><span class="flex items-center gap-2 text-slate-400"><span class="material-symbols-outlined text-[18px]">calendar_today</span> Date d'embauche</span><span class="font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(user.date_embauche ? empDetailFmtJJMMAAAA(String(user.date_embauche).slice(0, 10)) : 'Non renseigné')}</span></div>
                    <div class="flex items-center justify-between gap-2 py-2"><span class="flex items-center gap-2 text-slate-400"><span class="material-symbols-outlined text-[18px]">schedule</span> Horaire de travail</span><span class="font-semibold text-slate-800 dark:text-slate-200">Non renseigné</span></div>
                    <div class="flex items-center justify-between gap-2 py-2"><span class="flex items-center gap-2 text-slate-400"><span class="material-symbols-outlined text-[18px]">bedtime</span> Shift</span><span class="font-semibold text-slate-800 dark:text-slate-200">Non renseigné</span></div>
                    <div class="flex items-center justify-between gap-2 py-2"><span class="flex items-center gap-2 text-slate-400"><span class="material-symbols-outlined text-[18px]">domain</span> Branche / établissement</span><span class="font-semibold text-slate-800 dark:text-slate-200">Non renseigné</span></div>
                    <div class="flex items-center justify-between gap-2 py-2"><span class="flex items-center gap-2 text-slate-400"><span class="material-symbols-outlined text-[18px]">work</span> Poste</span><span class="font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(user.poste || 'Non renseigné')}</span></div>
                    <div class="flex items-center justify-between gap-2 py-2"><span class="flex items-center gap-2 text-slate-400"><span class="material-symbols-outlined text-[18px]">group</span> Département</span><span class="font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(user.departement || 'Non assigné')}</span></div>
                </div>
            </div>
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm p-lg">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-md">
                <div>
                    <h3 class="font-bold text-[15px] text-slate-900 dark:text-white flex items-center gap-2"><span class="material-symbols-outlined text-[#F46A21]">history</span> Historique des pointages</h3>
                    <p class="text-slate-500 dark:text-slate-400 text-[12px] mt-0.5">Liste complète des pointages de l'employé sélectionné</p>
                </div>
                <div class="flex flex-wrap items-center gap-sm">
                    <input type="date" id="empd-from" value="${empDetailState.dateFrom}" class="bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-1.5 border border-slate-200 dark:border-slate-700 text-xs font-mono outline-none focus:ring-2 focus:ring-[#F46A21]">
                    <span class="text-slate-400 text-xs">→</span>
                    <input type="date" id="empd-to" value="${empDetailState.dateTo}" class="bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-1.5 border border-slate-200 dark:border-slate-700 text-xs font-mono outline-none focus:ring-2 focus:ring-[#F46A21]">
                    <select id="empd-statut" class="bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-1.5 border border-slate-200 dark:border-slate-700 text-xs font-semibold outline-none cursor-pointer">
                        <option value="">Tous statuts</option>
                        <option value="present" ${empDetailState.statut === 'present' ? 'selected' : ''}>Présent</option>
                        <option value="retard" ${empDetailState.statut === 'retard' ? 'selected' : ''}>Retard</option>
                        <option value="encours" ${empDetailState.statut === 'encours' ? 'selected' : ''}>En cours</option>
                    </select>
                    <button type="button" id="empd-export" class="inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold px-md py-2 rounded-xl transition-all cursor-pointer"><span class="material-symbols-outlined text-[16px]">download</span> Exporter CSV</button>
                </div>
            </div>
            <div class="overflow-x-auto w-full max-w-full">
                <table class="w-full min-w-[640px] text-left border-collapse text-[13px]">
                    <thead><tr class="border-b border-slate-200/60 dark:border-slate-800 font-semibold text-slate-400 uppercase text-[11px] tracking-wider bg-slate-50/50 dark:bg-slate-900">
                        <th class="py-md px-md">#</th><th class="py-md px-md">Date</th><th class="py-md px-md">Heure d'entrée</th><th class="py-md px-md">Heure de sortie</th><th class="py-md px-md">Durée</th><th class="py-md px-md">Statut</th><th class="py-md px-md">Capteur</th>
                    </tr></thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60" id="empd-tbody"></tbody>
                </table>
            </div>
            <div class="flex items-center justify-end gap-2 mt-md">
                <span class="text-[12px] text-slate-400 font-mono" id="empd-count"></span>
                <div class="flex items-center gap-1" id="empd-pager"></div>
            </div>
        </div>`;

    document.getElementById('empd-back').onclick = () => hideEmployeeDetail(true);
    const editBtn = document.getElementById('empd-edit');
    if (editBtn) editBtn.onclick = () => openEditModal(user);
    document.getElementById('empd-from').onchange = (e) => { empDetailState.dateFrom = e.target.value || empDetailState.dateFrom; empDetailState.page = 1; empDetailRenderHistory(); };
    document.getElementById('empd-to').onchange = (e) => { empDetailState.dateTo = e.target.value || empDetailState.dateTo; empDetailState.page = 1; empDetailRenderHistory(); };
    document.getElementById('empd-statut').onchange = (e) => { empDetailState.statut = e.target.value; empDetailState.page = 1; empDetailRenderHistory(); };
    document.getElementById('empd-export').onclick = () => empDetailExportCSV();
    document.getElementById('empd-pager').onclick = (e) => {
        const b = e.target.closest('[data-empd-page]');
        if (!b || b.disabled) return;
        const v = b.dataset.empdPage;
        const rows = empDetailFilteredHistory();
        const totalPages = Math.max(1, Math.ceil(rows.length / EMPD_PAGE_SIZE));
        if (v === 'prev') empDetailState.page = Math.max(1, empDetailState.page - 1);
        else if (v === 'next') empDetailState.page = Math.min(totalPages, empDetailState.page + 1);
        else empDetailState.page = Math.min(totalPages, Math.max(1, parseInt(v, 10) || 1));
        empDetailRenderHistory();
    };

    empDetailRenderHistory();
    empDetailRenderCharts();
}

function hideEmployeeDetail(rerender) {
    empDetailDestroyCharts();
    const root = document.getElementById('empd-root');
    if (root) root.remove();
    empDetailState = null;
    const main = document.querySelector('main');
    if (main) [...main.children].forEach(el => { if (el.id !== 'flash') el.classList.remove('hidden'); });
    const topSearchWrap = document.getElementById('top-search')?.closest('div.relative.w-full.max-w-sm');
    if (topSearchWrap) topSearchWrap.style.display = '';
    if (rerender && typeof renderUsers === 'function') { try { renderUsers(false); } catch {} }
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