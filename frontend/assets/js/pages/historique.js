(function () {
// ============================================================
// Page : Historique Général des Pointages - Connecté MySQL
// ============================================================

let currentPeriod = 'today';
let editingPointageId = null;

function statusBadge(p) {
    if (!p.sortie) {
        return `
            <span class="inline-flex items-center gap-1 bg-[#FFF1E8] text-[#F46A21] dark:bg-orange-950/40 dark:text-[#F9AE3F] font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-[#F46A21]/25 dark:border-orange-900">
                <span class="material-symbols-outlined text-[13px]">pending</span> En cours
            </span>`;
    }
    if (isRetard(p.entree)) {
        return `
            <span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                <span class="material-symbols-outlined text-[13px]">schedule</span> Retard
            </span>`;
    }
    return `
        <span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            <span class="material-symbols-outlined text-[13px]">check_circle</span> Présent
        </span>`;
}

function initials(u) {
    if (!u || !u.prenom || !u.nom) return 'U';
    return (u.prenom[0] + u.nom[0]).toUpperCase();
}

function calculateDuration(entree, sortie) {
    if (!entree || !sortie) return '—';
    const [h1, m1] = entree.split(':').map(Number);
    const [h2, m2] = sortie.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hrs}h ${mins > 0 ? String(mins).padStart(2, '0') + 'm' : '00m'}`;
}

function filterRecords(db) {
    const search = (document.getElementById('top-search')?.value || '').trim().toLowerCase();
    const filterStatus = document.getElementById('filter-status')?.value || '';
    const filterDept = document.getElementById('filter-dept')?.value || '';

    const todayStr = todayISO();

    return (db.pointages || []).filter(p => {
        const u = (db.users || []).find(usr => usr.id === p.user_id) || p.user || { nom: 'Inconnu', prenom: '', matricule: '', departement: '' };

        const matchesSearch = !search ||
            (u.nom || '').toLowerCase().includes(search) ||
            (u.prenom || '').toLowerCase().includes(search) ||
            (u.matricule || '').toLowerCase().includes(search);

        const matchesDept = !filterDept || (u.departement || '') === filterDept;

        let matchesStatus = true;
        if (filterStatus === 'present') matchesStatus = !isRetard(p.entree) && p.sortie !== null;
        else if (filterStatus === 'retard') matchesStatus = isRetard(p.entree);
        else if (filterStatus === 'encours') matchesStatus = !p.sortie;

        let matchesPeriod = true;
        if (currentPeriod === 'today') {
            matchesPeriod = p.date === todayStr;
        } else if (currentPeriod === 'date') {
            const sel = (document.getElementById('filter-date')?.value || '').trim();
            matchesPeriod = !sel || p.date === sel;
        }

        return matchesSearch && matchesDept && matchesStatus && matchesPeriod;
    });
}

function updateKPIs(records) {
    const totalEl = document.getElementById('stat-total-records');
    const ponctualiteEl = document.getElementById('stat-ponctualite');
    const retardsEl = document.getElementById('stat-retards-count');
    const completesEl = document.getElementById('stat-completes');

    if (totalEl) totalEl.textContent = records.length;

    const totalCount = records.length;
    const retards = records.filter(p => isRetard(p.entree)).length;
    const ponctuels = totalCount - retards;
    const pct = totalCount > 0 ? Math.round((ponctuels / totalCount) * 100) : 100;
    const completes = records.filter(p => p.sortie !== null).length;

    if (ponctualiteEl) ponctualiteEl.textContent = `${pct}%`;
    if (retardsEl) retardsEl.textContent = retards;
    if (completesEl) completesEl.textContent = completes;
}

let cachedHistoriqueDb = null;

async function renderHistory(forceFetch = false) {
    if (forceFetch || !cachedHistoriqueDb) {
        const [users, pointages] = await Promise.all([
            api.getUsers(),
            api.getTodayPointages()
        ]);
        cachedHistoriqueDb = { users, pointages };
    }
    const db = cachedHistoriqueDb;
    const records = filterRecords(db);
    updateKPIs(records);

    const body = document.getElementById('history-table-body');
    const summary = document.getElementById('records-count-summary');

    if (summary) {
        summary.textContent = `Affichage de ${records.length} pointage(s) sur ${db.pointages.length} au total`;
    }

    if (!body) return;

    if (records.length === 0) {
        body.innerHTML = `<tr><td colspan="8" class="py-lg px-md text-center text-slate-400">Aucun pointage ne correspond aux filtres sélectionnés.</td></tr>`;
        return;
    }

    body.innerHTML = records.map(p => {
        const u = (db.users || []).find(usr => usr.id === p.user_id) || p.user || { nom: 'Inconnu', prenom: '', matricule: '', departement: 'Général' };
        return `
        <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors h-14">
            <td class="py-sm px-md">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[11px] shadow-sm">
                        ${initials(u)}
                    </div>
                    <div>
                        <div class="font-semibold text-slate-900 dark:text-white">${u.prenom} ${u.nom}</div>
                        <div class="text-[11px] font-mono text-slate-400">${u.matricule}</div>
                    </div>
                </div>
            </td>
            <td class="py-sm px-md font-mono text-[13px] text-slate-700 dark:text-slate-300 font-semibold">${formatDate(p.date)}</td>
            <td class="py-sm px-md text-slate-600 dark:text-slate-300">
                <span class="inline-block bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium px-2 py-0.5 rounded-md">
                    ${u.departement || 'Général'}
                </span>
            </td>
            <td class="py-sm px-md font-mono text-[13px] ${isRetard(p.entree) ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}">
                ${p.entree ? p.entree.slice(0, 5) : '—'}
            </td>
            <td class="py-sm px-md font-mono text-[13px] text-rose-600 dark:text-rose-400 font-semibold">
                ${p.sortie ? p.sortie.slice(0, 5) : '—'}
            </td>
            <td class="py-sm px-md font-mono text-[12px] text-slate-500 font-medium">
                ${calculateDuration(p.entree, p.sortie)}
            </td>
            <td class="py-sm px-md text-right">
                ${statusBadge(p)}
            </td>
            <td class="py-sm px-md text-right">
                ${(() => {
                    const isSuper = (() => { try { const cu = api.getCurrentUser(); return cu && (cu.role === 'super_admin' || cu.role === 'admin_systeme'); } catch(e){ return false; } })();
                    if (!isSuper) return '';
                    return `<button class="text-slate-500 hover:text-[#F46A21] hover:bg-[#FFF1E8] dark:hover:bg-orange-950/40 p-1.5 rounded-lg transition-colors cursor-pointer" title="Modifier les heures" data-edit-pointage="${p.id}">
                    <span class="material-symbols-outlined text-[16px]">edit</span>
                </button>`;
                })()}
            </td>
        </tr>`;
    }).join('');
}

async function exportCSV() {
    const [users, pointages] = await Promise.all([
        api.getUsers(),
        api.getTodayPointages()
    ]);
    const db = { users, pointages };
    const records = filterRecords(db);

    let csvContent = 'data:text/csv;charset=utf-8,Matricule,Nom,Prenom,Departement,Date,Entree,Sortie,Statut\n';
    records.forEach(p => {
        const u = (db.users || []).find(usr => usr.id === p.user_id) || p.user || { nom: '', prenom: '', matricule: '', departement: '' };
        const status = !p.sortie ? 'En cours' : (isRetard(p.entree) ? 'Retard' : 'Present');
        csvContent += `"${u.matricule}","${u.nom}","${u.prenom}","${u.departement || ''}","${p.date}","${p.entree || ''}","${p.sortie || ''}","${status}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rapport_pointage_mada_${todayISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    flash('Export du rapport CSV téléchargé avec succès.', 'success');
}

function initPage() {
    window._lastInitializedModule = 'historique';
    renderHistory(true);

    document.getElementById('top-search')?.addEventListener('input', () => renderHistory(false));
    document.getElementById('filter-status')?.addEventListener('change', () => renderHistory(false));
    document.getElementById('filter-dept')?.addEventListener('change', () => renderHistory(false));

    document.querySelectorAll('.period-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.period-pill').forEach(b => {
                b.classList.remove('active', 'bg-white', 'dark:bg-slate-900', 'shadow-sm', 'text-slate-900', 'dark:text-white');
                b.classList.add('text-slate-600', 'dark:text-slate-400');
            });
            btn.classList.add('active', 'bg-white', 'dark:bg-slate-900', 'shadow-sm', 'text-slate-900', 'dark:text-white');
            btn.classList.remove('text-slate-600', 'dark:text-slate-400');

            currentPeriod = btn.dataset.period;
            const dateWrap = document.getElementById('date-filter-wrap');
            if (dateWrap) {
                dateWrap.classList.toggle('hidden', currentPeriod !== 'date');
                if (currentPeriod === 'date') {
                    const dateInput = document.getElementById('filter-date');
                    if (dateInput && !dateInput.value) dateInput.value = todayISO();
                }
            }
            renderHistory(false);
        });
    });

    document.getElementById('filter-date')?.addEventListener('change', (e) => {
        const datePill = [...document.querySelectorAll('.period-pill')].find(b => b.dataset.period === 'date');
        if (datePill) {
            document.querySelectorAll('.period-pill').forEach(b => {
                b.classList.remove('active', 'bg-white', 'dark:bg-slate-900', 'shadow-sm', 'text-slate-900', 'dark:text-white');
                b.classList.add('text-slate-600', 'dark:text-slate-400');
            });
            datePill.classList.add('active', 'bg-white', 'dark:bg-slate-900', 'shadow-sm', 'text-slate-900', 'dark:text-white');
            datePill.classList.remove('text-slate-600', 'dark:text-slate-400');
            currentPeriod = 'date';
        }
        renderHistory(false);
    });

    document.getElementById('btn-export-history')?.addEventListener('click', exportCSV);

    document.getElementById('form-edit-pointage')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (editingPointageId === null) return;
        const res = await api.updatePointage(editingPointageId, {
            date: document.getElementById('f-p-date').value,
            entree: document.getElementById('f-p-entree').value,
            sortie: document.getElementById('f-p-sortie').value
        });
        if (res.ok) {
            flash(`Pointage de ${res.pointage.date} corrigé.`, 'success');
            closeModal('modal-edit-pointage');
            editingPointageId = null;
            renderHistory(true);
        } else {
            flash(res.message, 'danger');
        }
    });
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['historique'] = initPage;
window.initPage = initPage;
})();
