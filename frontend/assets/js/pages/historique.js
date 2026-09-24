(function () {
// ============================================================
// Page : Historique Général des Pointages - Connecté MySQL
// ============================================================

let currentPeriod = 'all'; // « Tous » par défaut : l'historique affiche TOUT dès l'ouverture
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

        // 'all' (Tous) = tout l'historique, aucune restriction de période.
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

if (!window._historiqueEditHandler) {
    window._historiqueEditHandler = true;
    document.addEventListener('click', (e) => {
        if (document.body.dataset.page !== 'historique') return;
        const btn = e.target.closest('[data-edit-pointage]');
        if (!btn) return;
        const id = parseInt(btn.dataset.editPointage, 10);
        const db = cachedHistoriqueDb;
        if (!db) return;
        const p = (db.pointages || []).find(x => x.id === id);
        if (!p) return;
        editingPointageId = id;
        const dateEl = document.getElementById('f-p-date');
        const entreeEl = document.getElementById('f-p-entree');
        const sortieEl = document.getElementById('f-p-sortie');
        const userEl = document.getElementById('f-p-user');
        if (dateEl) dateEl.value = p.date || todayISO();
        if (entreeEl) entreeEl.value = p.entree ? p.entree.slice(0,5) : '';
        if (sortieEl) sortieEl.value = p.sortie ? p.sortie.slice(0,5) : '';
        const entree2El = document.getElementById('f-p-entree2');
        const sortie2El = document.getElementById('f-p-sortie2');
        if (entree2El) entree2El.value = p.entree2 ? p.entree2.slice(0,5) : '';
        if (sortie2El) sortie2El.value = p.sortie2 ? p.sortie2.slice(0,5) : '';
        const u = (db.users || []).find(u => u.id === p.user_id) || p.user || {prenom:'',nom:'',matricule:''};
        if (userEl) userEl.textContent = `${u.prenom} ${u.nom} (${u.matricule||''})`;
        openModal('modal-edit-pointage');
    });
}

if (!window._historiqueDeleteHandler) {
    window._historiqueDeleteHandler = true;
    document.addEventListener('click', (e) => {
        if (document.body.dataset.page !== 'historique') return;
        const btn = e.target.closest('[data-delete-pointage]');
        if (!btn) return;
        const id = parseInt(btn.dataset.deletePointage, 10);
        showConfirmModal({
            title: 'Supprimer ce pointage ?',
            message: 'Cette action supprimera définitivement le pointage de cette journée pour cet employé.',
            type: 'danger',
            confirmText: 'Oui, Supprimer',
            cancelText: 'Annuler',
            onConfirm: async () => {
                const res = await api.deletePointage(id);
                if (res.ok) {
                    flash('Pointage supprimé avec succès.', 'success');
                    renderHistory(true);
                } else {
                    flash(res.message, 'danger');
                }
            }
        });
    });
}

async function renderHistory(forceFetch = false) {
    if (forceFetch || !cachedHistoriqueDb) {
        const [users, pointages] = await Promise.all([
            api.getUsers(forceFetch),
            api.getAllPointages(forceFetch)
        ]);
        cachedHistoriqueDb = { users, pointages };
    }
    const db = cachedHistoriqueDb;
    const records = filterRecords(db);
    updateKPIs(records);

    // Mémorise les filtres (recherche, statut, département) pour les
    // ré-appliquer après un re-rendu — la page garde l'état de l'utilisateur.
    ['top-search', 'filter-status', 'filter-dept'].forEach(id => {
        const el = document.getElementById(id);
        if (!el || !el.value) return;
        try { sessionStorage.setItem('mada-hist-' + id, el.value); } catch {}
    });

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
                    return `
                    <div class="flex items-center justify-end gap-1">
                        <button class="text-slate-500 hover:text-[#F46A21] hover:bg-[#FFF1E8] dark:hover:bg-orange-950/40 p-1.5 rounded-lg transition-colors cursor-pointer" title="Modifier les heures" data-edit-pointage="${p.id}">
                            <span class="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button class="text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 rounded-lg transition-colors cursor-pointer" title="Supprimer le pointage" data-delete-pointage="${p.id}">
                            <span class="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                    </div>`;
                })()}
            </td>
        </tr>`;
    }).join('');
}

async function exportCSV() {
    const currentUser = api.getCurrentUser() || { prenom: 'Admin', nom: 'Système' };
    const [users, pointages] = await Promise.all([
        api.getUsers(),
        api.getAllPointages()
    ]);
    const db = { users, pointages };
    const records = filterRecords(db);

    const now = new Date();
    const formattedNow = now.toLocaleDateString('fr-FR') + ' à ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    
    // Total KPIs pour le résumé
    const totalRecords = records.length;
    const retards = records.filter(p => isRetard(p.entree)).length;
    const encours = records.filter(p => !p.sortie).length;
    const presents = totalRecords - retards;
    const pctPonctualite = totalRecords > 0 ? Math.round((presents / totalRecords) * 100) : 100;

    // Délimiteur point-virgule (;) pour comptabilité native Excel FR + BOM UTF-8
    const sep = ';';
    const lines = [];

    // --- En-tête du Rapport ---
    lines.push(`MADA DIGITAL - RAPPORT GÉNÉRAL DU REGISTRE DE POINTAGE`);
    lines.push(`Date d'extraction${sep}"${formattedNow}"`);
    lines.push(`Généré par${sep}"${currentUser.prenom} ${currentUser.nom}"`);
    lines.push(`Période sélectionnée${sep}"${currentPeriod === 'all' ? 'Tout l\'historique' : (currentPeriod === 'today' ? "Aujourd'hui (" + todayISO() + ")" : (document.getElementById('filter-date')?.value || todayISO()))}"`);
    lines.push(`Volume d'enregistrements${sep}"${totalRecords}"`);
    lines.push(``); // Ligne vide de séparation

    // --- Colonnes du Tableau ---
    lines.push([
        'Matricule',
        'Nom',
        'Prénom',
        'Département',
        'Date',
        'Heure Entrée',
        'Heure Sortie',
        'Durée Présence',
        'Statut Biométrique'
    ].map(c => `"${c}"`).join(sep));

    // --- Lignes de Données ---
    records.forEach(p => {
        const u = (db.users || []).find(usr => usr.id === p.user_id) || p.user || { nom: 'Inconnu', prenom: '', matricule: '', departement: 'Général' };
        
        let status = 'Présent';
        if (!p.sortie) status = 'Journée en cours';
        else if (isRetard(p.entree)) status = 'En Retard';

        const dateFormatted = p.date ? formatDate(p.date) : '—';
        const entreeStr = p.entree ? p.entree.slice(0, 8) : '—';
        const sortieStr = p.sortie ? p.sortie.slice(0, 8) : 'Non pointé';
        const dureeStr  = calculateDuration(p.entree, p.sortie);

        const row = [
            u.matricule || '—',
            u.nom || '',
            u.prenom || '',
            u.departement || 'Général',
            dateFormatted,
            entreeStr,
            sortieStr,
            dureeStr,
            status
        ];

        lines.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(sep));
    });

    // --- Bloc Synthèse KPI en bas ---
    lines.push(``);
    lines.push(`SYNTHÈSE ET INDICATEURS CLÉS DE PERFORMANCE (KPI)`);
    lines.push(`Total des pointages extraits${sep}"${totalRecords}"`);
    lines.push(`Présences à l'heure${sep}"${presents}"`);
    lines.push(`Retards constatés${sep}"${retards}"`);
    lines.push(`Journées non clôturées${sep}"${encours}"`);
    lines.push(`Taux de ponctualité global${sep}"${pctPonctualite}%"`);

    // Assemblage avec BOM UTF-8 (\uFEFF) pour l'ouverture directe sous Microsoft Excel sans accents corrompus
    const csvString = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rapport_Pointage_MADA_${todayISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    flash('Export CSV haute qualité téléchargé avec succès.', 'success');
}

function initPage() {
    window._lastInitializedModule = 'historique';
    renderHistory(true);
    // Peupler filtre département depuis BDD (cohérent avec pointage)
    api.getDepartements().then(depts => {
        const sel = document.getElementById('filter-dept');
        if (sel && depts && depts.length) {
            const cur = sel.value;
            sel.innerHTML = '<option value="">Tous les Départements</option>' + depts.map(d => `<option value="${d.nom}" ${d.nom===cur?'selected':''}>${d.nom}</option>`).join('');
        }
    });

    // Restaure les filtres mémorisés avant le premier rendu
    ['top-search', 'filter-status', 'filter-dept'].forEach(id => {
        const el = document.getElementById(id);
        if (!el || !el.value) return;
        try { const v = sessionStorage.getItem('mada-hist-' + id); if (v) el.value = v; } catch {}
    });

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
        const entree = document.getElementById('f-p-entree').value;
        const sortie = document.getElementById('f-p-sortie').value;
        const entree2 = document.getElementById('f-p-entree2')?.value || '';
        const sortie2 = document.getElementById('f-p-sortie2')?.value || '';
        if (sortie && entree && sortie <= entree) { flash('L\'heure de sortie doit être après l\'heure d\'entrée.', 'warning'); return; }
        if (entree2 && sortie2 && sortie2 <= entree2) { flash('La 2e sortie doit être après la 2e entrée.', 'warning'); return; }
        if (entree2 && sortie && entree2 <= sortie) { flash('La 2e entrée doit être après la première sortie.', 'warning'); return; }
        const submitBtn = e.submitter || document.querySelector('#form-edit-pointage button[type="submit"]');
        await withButtonLoading(submitBtn, async () => {
            const res = await api.updatePointage(editingPointageId, {
                date: document.getElementById('f-p-date').value,
                entree,
                sortie,
                entree2,
                sortie2
            });
            if (res.ok) {
                flash(`Pointage de ${res.pointage.date} corrigé.`, 'success');
                closeModal('modal-edit-pointage');
                editingPointageId = null;
                renderHistory(true);
            } else {
                flash(res.message, 'danger');
            }
        }, 'Enregistrement…');
    });
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['historique'] = initPage;
window.initPage = initPage;
})();
