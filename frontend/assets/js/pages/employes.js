// ============================================================
// Page : Gestion des employés & Empreintes
// ============================================================

function initials(u) {
    if (!u || !u.prenom || !u.nom) return 'U';
    return (u.prenom[0] + u.nom[0]).toUpperCase();
}

function avatar(u) {
    return `
        <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[12px] shadow-sm">
            ${initials(u)}
        </div>`;
}

function userRow(u) {
    const empBadge = u.empreinte
        ? '<span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800"><span class="material-symbols-outlined text-[13px]">verified</span> Enregistrée</span>'
        : '<span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800"><span class="material-symbols-outlined text-[13px]">block</span> Aucune</span>';
    
    const roleBadge = u.role === 'admin'
        ? '<span class="inline-flex items-center gap-1 bg-[#FFF1E8] text-[#F46A21] dark:bg-orange-950/40 dark:text-[#F9AE3F] font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-[#F46A21]/25 dark:border-orange-900"><span class="material-symbols-outlined text-[13px]">shield</span> Admin</span>'
        : '<span class="inline-flex items-center gap-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700"><span class="material-symbols-outlined text-[13px]">person</span> Employé</span>';

    return `
        <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors h-14">
            <td class="py-sm px-md">
                <div class="flex items-center gap-md">
                    ${avatar(u)}
                    <div>
                        <div class="font-semibold text-slate-900 dark:text-white">${u.prenom} ${u.nom}</div>
                        <div class="text-[11px] text-slate-400 md:hidden">${u.email || '—'}</div>
                    </div>
                </div>
            </td>
            <td class="py-sm px-md font-mono text-[13px] text-slate-600 dark:text-slate-300">${u.matricule}</td>
            <td class="py-sm px-md hidden md:table-cell text-slate-600 dark:text-slate-400">${u.email || '—'}</td>
            <td class="py-sm px-md font-medium text-slate-700 dark:text-slate-300">${u.departement || 'Non assigné'}</td>
            <td class="py-sm px-md">${roleBadge}</td>
            <td class="py-sm px-md">${empBadge}</td>
            <td class="py-sm px-md text-right">
                <div class="inline-flex items-center gap-1">
                    <button class="text-slate-500 hover:text-[#F46A21] hover:bg-[#FFF1E8] dark:hover:bg-orange-950/40 p-1.5 rounded-lg transition-colors cursor-pointer" title="Modifier" data-edit="${u.id}">
                        <span class="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button class="bg-[#FFF1E8] dark:bg-orange-950/40 text-[#F46A21] dark:text-[#F9AE3F] hover:bg-orange-100 font-semibold text-[11px] px-2.5 py-1 rounded-lg border border-[#F46A21]/25 dark:border-orange-900 transition-colors inline-flex items-center gap-1 cursor-pointer" data-enroll="${u.id}">
                        <span class="material-symbols-outlined text-[14px]">fingerprint</span>
                        Enrôler
                    </button>
                    <button class="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 rounded-lg transition-colors cursor-pointer" title="Supprimer" data-delete="${u.id}">
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                </div>
            </td>
        </tr>`;
}

async function renderUsers() {
    allUsers = await api.getUsers();
    const search = (document.getElementById('top-search')?.value || '').trim().toLowerCase();
    const filterDept = (document.getElementById('filter-dept')?.value || '').toLowerCase();
    const filterEmp = (document.getElementById('filter-emp')?.value || '');

    const filtered = allUsers.filter(u => {
        const matchesSearch = !search ||
            u.nom.toLowerCase().includes(search) ||
            u.prenom.toLowerCase().includes(search) ||
            u.matricule.toLowerCase().includes(search) ||
            (u.email || '').toLowerCase().includes(search) ||
            (u.departement || '').toLowerCase().includes(search);

        const matchesDept = !filterDept || (u.departement || '').toLowerCase() === filterDept;
        const matchesEmp = !filterEmp || (filterEmp === 'yes' ? !!u.empreinte : !u.empreinte);

        return matchesSearch && matchesDept && matchesEmp;
    });

    const body = document.getElementById('users-body');
    if (body) {
        body.innerHTML = filtered.map(userRow).join('')
            || '<tr><td colspan="7" class="py-lg px-md text-center text-slate-400">Aucun employé ne correspond aux critères.</td></tr>';
    }

    const summary = document.getElementById('emp-count-summary');
    if (summary) {
        summary.textContent = `${filtered.length} employé(s) sur ${allUsers.length} au total`;
    }

    // Sidebar badge sync
    const badgeEmp = document.getElementById('badge-count-emp');
    if (badgeEmp) badgeEmp.textContent = allUsers.length;
}

function initPage() {
    const user = api.getCurrentUser();
    if (!user) return;

    if (user.role !== 'admin' && user.role !== 'super_admin') {
        flash('Accès réservé aux administrateurs.', 'danger');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
        return;
    }

    let editingId = null;

    renderUsers();

    // Attach menu filter listeners
    document.getElementById('top-search')?.addEventListener('input', renderUsers);
    document.getElementById('filter-dept')?.addEventListener('change', renderUsers);
    document.getElementById('filter-emp')?.addEventListener('change', renderUsers);

    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll('[id^="modal-"]').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal(backdrop.id);
        });
    });

    document.getElementById('btn-add-user')?.addEventListener('click', () => openModal('modal-add'));

    document.getElementById('form-add')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await api.addUser({
            matricule: document.getElementById('f-matricule').value.trim(),
            nom: document.getElementById('f-nom').value.trim(),
            prenom: document.getElementById('f-prenom').value.trim(),
            email: document.getElementById('f-email').value.trim(),
            departement: document.getElementById('f-departement').value.trim(),
            role: document.getElementById('f-role').value,
            password: null
        });
        if (res.ok) {
            flash(`Employé ${res.user.prenom} ${res.user.nom} (${res.user.matricule}) ajouté avec succès.`, 'success');
            closeModal('modal-add');
            e.target.reset();
            await renderUsers();
        } else {
            flash(res.message, 'danger');
        }
    });

    document.getElementById('form-edit')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (editingId === null) return;
        const res = await api.updateUser(editingId, {
            matricule: document.getElementById('f-edit-matricule').value.trim(),
            nom: document.getElementById('f-edit-nom').value.trim(),
            prenom: document.getElementById('f-edit-prenom').value.trim(),
            email: document.getElementById('f-edit-email').value.trim(),
            departement: document.getElementById('f-edit-departement').value.trim(),
            role: document.getElementById('f-edit-role').value
        });
        if (res.ok) {
            flash(`Employé ${res.user.prenom} ${res.user.nom} (${res.user.matricule}) mis à jour avec succès.`, 'success');
            closeModal('modal-edit');
            editingId = null;
            e.target.reset();
            await renderUsers();
        } else {
            flash(res.message, 'danger');
        }
    });

    document.getElementById('users-body')?.addEventListener('click', async (e) => {
        const enrollBtn = e.target.closest('[data-enroll]');
        const deleteBtn = e.target.closest('[data-delete]');
        const editBtn = e.target.closest('[data-edit]');
        if (!enrollBtn && !deleteBtn && !editBtn) return;

        const id = parseInt(enrollBtn?.dataset.enroll || deleteBtn?.dataset.delete || editBtn?.dataset.edit, 10);
        const target = allUsers.find(u => u.id === id);
        if (!target) return;

        if (editBtn) {
            editingId = id;
            document.getElementById('f-edit-matricule').value = target.matricule || '';
            document.getElementById('f-edit-nom').value = target.nom || '';
            document.getElementById('f-edit-prenom').value = target.prenom || '';
            document.getElementById('f-edit-email').value = target.email || '';
            document.getElementById('f-edit-departement').value = target.departement || '';
            const roleSel = document.getElementById('f-edit-role');
            if (![...roleSel.options].some(o => o.value === target.role)) {
                const opt = document.createElement('option');
                opt.value = target.role;
                opt.textContent = target.role === 'super_admin' ? 'Super Administrateur' : target.role;
                roleSel.appendChild(opt);
            }
            roleSel.value = target.role;
            openModal('modal-edit');
            return;
        }

        if (deleteBtn) {
            showConfirmModal({
                title: 'Supprimer cet employé ?',
                message: `Voulez-vous vraiment supprimer ${target.prenom} ${target.nom} (${target.matricule}) ? Cette action effacera également son historique de pointage.`,
                type: 'danger',
                confirmText: 'Oui, Supprimer',
                cancelText: 'Annuler',
                onConfirm: async () => {
                    await api.deleteUser(id);
                    flash(`L'employé ${target.prenom} ${target.nom} a été supprimé.`, 'success');
                    await renderUsers();
                }
            });
            return;
        }

        const startEnrollment = () => {
            openModal('modal-enroll');
            const icon = document.getElementById('enroll-icon');
            const step = document.getElementById('enroll-step');
            const btn = document.getElementById('btn-enroll');

            document.getElementById('enroll-person').textContent = `${target.prenom} ${target.nom} (${target.matricule})`;
            icon.className = 'w-24 h-24 rounded-full bg-[#FFF1E8] text-[#F46A21] flex items-center justify-center mb-lg transition-colors duration-300 shadow-inner';
            icon.innerHTML = '<span class="material-symbols-outlined text-[48px]">fingerprint</span>';
            step.textContent = 'Placez le doigt de l\'employé sur le lecteur.';
            btn.disabled = false;

            btn.onclick = async () => {
                icon.className = 'w-24 h-24 rounded-full bg-[#F46A21] text-white pulse-ring flex items-center justify-center mb-lg transition-colors duration-300';
                icon.innerHTML = '<span class="material-symbols-outlined text-[48px]">fingerprint</span>';
                step.textContent = 'Numérisation biométrique en cours...';
                btn.disabled = true;

                const res = await api.enrollFingerprint(id);

                if (res.ok) {
                    icon.className = 'w-24 h-24 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-lg transition-colors duration-300';
                    icon.innerHTML = '<span class="material-symbols-outlined text-[48px]">check_circle</span>';
                    step.textContent = res.message;
                    flash(res.message, 'success');
                    btn.disabled = false;
                    setTimeout(() => {
                        closeModal('modal-enroll');
                        renderUsers();
                    }, 1200);
                } else {
                    icon.className = 'w-24 h-24 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-lg transition-colors duration-300';
                    icon.innerHTML = '<span class="material-symbols-outlined text-[48px]">error</span>';
                    step.textContent = res.message;
                    btn.disabled = false;
                }
            };
        };

        if (target.empreinte) {
            showConfirmModal({
                title: 'Remplacer l\'empreinte ?',
                message: `Une empreinte est déjà enregistrée pour ${target.prenom} ${target.nom}. Souhaitez-vous effectuer une nouvelle numérisation ?`,
                type: 'warning',
                confirmText: 'Ré-enrôler',
                cancelText: 'Conserver',
                onConfirm: startEnrollment
            });
        } else {
            startEnrollment();
        }
    });
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['employes'] = initPage;
window.initPage = initPage;