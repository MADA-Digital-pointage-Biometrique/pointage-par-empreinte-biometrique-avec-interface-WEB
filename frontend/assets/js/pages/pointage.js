(function () {
// ============================================================
// Page : Pointages — listes et filtrage connectés MySQL
// ============================================================

let pointageEditingId = null;

function methodBadge(method) {
    const m = (method || '').toLowerCase().trim();
    if (m === 'biometric' || m === 'biométrique' || m === 'empreinte' || m === 'biometrie') {
        return `
            <span class="inline-flex items-center gap-1 bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 font-semibold text-[10px] px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800">
                <span class="material-symbols-outlined text-[12px]">fingerprint</span> Biométrique
            </span>`;
    }
    if (m === 'manuel' || m === 'manual' || m === 'manuelle') {
        return `
            <span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-semibold text-[10px] px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                <span class="material-symbols-outlined text-[12px]">edit_note</span> Manuel
            </span>`;
    }
    if (!m || m === '—' || m === '-') {
        return `<span class="inline-flex items-center gap-1 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-medium text-[10px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">—</span>`;
    }
    return `
        <span class="inline-flex items-center gap-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-semibold text-[10px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
            ${escapeHtml(method)}
        </span>`;
}

function statusBadge(p) {
    if (p.sortie !== null && p.sortie !== undefined) {
        return `
            <span class="inline-flex items-center gap-1 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                <span class="material-symbols-outlined text-[13px]">logout</span> Sortie
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

// Créneau horaire (entrée verte / sortie grise) — '--' si vide
function timeSlot(v, kind) {
    const filled = !!v;
    const cls = kind === 'in'
        ? (filled ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'text-slate-300 dark:text-slate-600')
        : (filled ? 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700' : 'text-slate-300 dark:text-slate-600');
    return `<span class="inline-flex items-center justify-center min-w-[48px] px-1.5 py-1 rounded-lg ${cls}">${filled ? v.slice(0, 5) : '--'}</span>`;
}
function timeArrow() {
    return '<span class="material-symbols-outlined text-[12px] text-slate-300 dark:text-slate-600">arrow_forward</span>';
}
// Secondes → "7h45"
function fmtHours(sec) {
    sec = Math.max(0, parseInt(sec || 0, 10));
    if (!sec) return '--';
    return Math.floor(sec / 3600) + 'h' + String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
}
function totalBadge(sec) {
    return `<span class="inline-flex items-center gap-1 font-mono text-[12px] font-bold ${sec > 0 ? 'text-slate-700 dark:text-slate-200 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900' : 'text-slate-300 dark:text-slate-600'} rounded-lg px-2 py-1">
        <span class="material-symbols-outlined text-[13px] ${sec > 0 ? 'text-[#F46A21]' : ''}">schedule</span>${fmtHours(sec)}</span>`;
}

function filterPointages(db) {
    const search = (document.getElementById('top-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('filter-status')?.value || '';
    const dept = document.getElementById('filter-dept')?.value || '';
    const todayStr = todayISO();

    // Portée fixe : uniquement les pointages du jour.
    // Les dates passées restent consultables dans la page Historique.
    return (db.pointages || []).filter(p => {
        if (p.date !== todayStr) return false;

        if (status === 'sortie' && (!p.sortie)) return false;
        if (status === 'encours' && p.sortie) return false;
        if (status === 'retard' && !(!p.sortie && isRetard(p.entree))) return false;
        if (status === 'present' && !(!p.sortie && !isRetard(p.entree))) return false;

        if (search) {
            const u = p.user || {};
            const hay = `${u.prenom || ''} ${u.nom || ''} ${u.matricule || ''}`.toLowerCase();
            if (!hay.includes(search)) return false;
        }

        if (dept && (p.user?.departement || '') !== dept) return false;

        return true;
    });
}

function populateDeptFilter(db) {
    const select = document.getElementById('filter-dept');
    if (!select) return;
    const current = select.value;
    const depts = [...new Set((db.users || []).map(u => u.departement).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    select.innerHTML = '<option value="">Tous les Départements</option>' +
        depts.map(d => `<option value="${d}" ${d === current ? 'selected' : ''}>${d}</option>`).join('');
}

let capteurPollTimer = null;
async function fetchCapteurStatus() {
    try {
        const res = await fetch(getApiEndpoint('sensor_status.php'), { credentials: 'include', cache: 'no-store' });
        const data = await res.json();
        if (data.ok) return data;
    } catch {}
    return { status: 'hs', detail: 'Capteur non joignable' };
}
function renderCapteurStatusReal(data) {
    const badge = document.getElementById('capteur-badge');
    if (!badge) return;
    const label = document.getElementById('capteur-label');
    const icon = document.getElementById('capteur-icon');
    const hs = data && data.status === 'hs';
    if (hs) {
        badge.className = 'ml-1 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border cursor-pointer transition-colors bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
        if (label) label.textContent = 'Capteur : HS';
        if (icon) icon.textContent = 'sensor_occupied';
        badge.title = data.detail || 'HS';
    } else {
        badge.className = 'ml-1 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border cursor-pointer transition-colors bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-500/20';
        if (label) label.textContent = 'Capteur : En service';
        if (icon) icon.textContent = 'sensors';
        badge.title = data.detail || 'En service';
    }
    document.dispatchEvent(new CustomEvent('capteurStatusChanged', { detail: { status: data.status, detail: data.detail } }));
}
function renderCapteurStatus() {
    // Fallback local uniquement si fetch échoue — n'est plus appelé avant fetch réel
    const hs = storage.get('mada_capteur_hs') === '1';
    renderCapteurStatusReal({ status: hs ? 'hs' : 'en_service', detail: hs ? 'HS (local)' : 'En service (local)' });
}
async function refreshCapteurStatus() {
    const data = await fetchCapteurStatus();
    renderCapteurStatusReal(data);
}
function startCapteurPolling() {
    // Affiche … neutre jusqu'au premier fetch réel (évite flash HS→En service→HS)
    const badge=document.getElementById('capteur-badge'); if(badge){ badge.className='ml-1 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 border-slate-200 dark:border-slate-700'; const lab=document.getElementById('capteur-label'); if(lab) lab.textContent='Capteur : …'; }
    refreshCapteurStatus();
    if (capteurPollTimer) clearInterval(capteurPollTimer);
    capteurPollTimer = setInterval(refreshCapteurStatus, 5000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') refreshCapteurStatus();
    });
}

let cachedPointagesDb = null;

if (!window._pointageEditHandler) {
    window._pointageEditHandler = true;
    document.addEventListener('click', (e) => {
        if (document.body.dataset.page !== 'pointage') return;
        const editBtn = e.target.closest('[data-edit-pointage]');
        if (editBtn) {
            const id = parseInt(editBtn.dataset.editPointage, 10);
            const db = cachedPointagesDb;
            if (!db) return;
            const p = (db.pointages || []).find(x => x.id === id);
            if (!p) return;
            pointageEditingId = id;
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
            const u = p.user || (db.users || []).find(u => u.id === p.user_id) || {prenom:'',nom:'',matricule:''};
            if (userEl) userEl.textContent = `${u.prenom} ${u.nom} (${u.matricule||''})`;
            openModal('modal-edit-pointage');
            return;
        }
        const delBtn = e.target.closest('[data-delete-pointage]');
        if (delBtn) {
            const id = parseInt(delBtn.dataset.deletePointage, 10);
            const db = cachedPointagesDb;
            if (!db) return;
            const p = (db.pointages || []).find(x => x.id === id);
            const u = p?.user || {};
            showConfirmModal({
                title: 'Supprimer le pointage ?',
                message: `Supprimer le pointage du ${p?.date || ''} pour ${u.prenom || ''} ${u.nom || ''} ? Entrée/Sortie du jour seront effacées.`,
                type: 'danger',
                confirmText: 'Supprimer',
                cancelText: 'Annuler',
                onConfirm: async () => {
                    const res = await api.deletePointage(id);
                    if (res.ok) { flash('Pointage supprimé.', 'success'); renderHistoryTable(true); }
                    else flash(res.message || 'Échec suppression.', 'danger');
                }
            });
        }
    });
}

async function renderHistoryTable(forceFetch = false) {
    const tbody = document.getElementById('history-body');
    if (!tbody) return;

    if (forceFetch) { _clearCache && _clearCache('pointagesAll'); _clearCache && _clearCache('users'); }
    if (forceFetch || !cachedPointagesDb) {
        const [users, pointages] = await Promise.all([
            api.getUsers(forceFetch),
            api.getAllPointages(forceFetch)
        ]);
        cachedPointagesDb = { users, pointages };
    }

    const db = cachedPointagesDb;
    populateDeptFilter(db);
    // Ne plus écraser l'état réel avec le fallback local
    const list = filterPointages(db);

    const summary = document.getElementById('pointage-count-summary');
    if (summary) summary.textContent = `${list.length} pointage(s) aujourd'hui`;

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="py-xl px-md text-center">
                    <div class="flex flex-col items-center gap-2 py-md">
                        <span class="material-symbols-outlined text-[36px] text-slate-300 dark:text-slate-600">search_off</span>
                        <p class="text-[13px] text-slate-500 dark:text-slate-400">Aucun pointage ne correspond aux critères.</p>
                        <p class="text-[11px] text-slate-400">Aucun pointage n'a encore été enregistré aujourd'hui.</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = list.map(p => {
        const u = p.user || { prenom: 'Employé', nom: '', matricule: 'EMP', departement: '' };
        const deptLabel = u.departement ? `<span class="inline-block bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">${escapeHtml(u.departement)}</span>` : '';
        return `
        <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors h-[64px]" data-row-pointage="${p.id}">
            <td class="py-sm px-md">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[12px] shadow-sm shrink-0">
                        ${initials(u)}
                    </div>
                    <div class="min-w-0">
                        <div class="font-semibold text-[13px] leading-tight text-slate-900 dark:text-white truncate">${escapeHtml(u.prenom)} ${escapeHtml(u.nom)}</div>
                        <div class="flex items-center gap-1.5 mt-0.5">
                            <span class="text-[11px] font-mono text-slate-400">${escapeHtml(u.matricule)}</span>
                            ${deptLabel}
                        </div>
                    </div>
                </div>
            </td>
            <td class="py-sm px-md font-mono text-[12px] text-slate-600 dark:text-slate-300 whitespace-nowrap">${formatDate(p.date)}</td>
            <td class="py-sm px-md text-center whitespace-nowrap">${methodBadge(p.methode_verification || p.source_donnee || p.methode || p.type_pointage)}</td>
            <td class="py-sm px-md text-center whitespace-nowrap">
                <div class="inline-flex items-center gap-1 font-mono text-[13px] font-semibold">
                    ${timeSlot(p.entree, 'in')}${timeArrow()}${timeSlot(p.sortie, 'out')}${(p.entree2 || p.sortie2) ? timeArrow() + timeSlot(p.entree2, 'in') + timeArrow() + timeSlot(p.sortie2, 'out') : ''}
                </div>
            </td>
            <td class="py-sm px-md text-center whitespace-nowrap">${totalBadge(p.total_secondes)}</td>
            <td class="py-sm px-md text-right whitespace-nowrap">${statusBadge(p)}</td>
            <td class="py-sm px-md text-right whitespace-nowrap">
                ${(() => {
                    const isSuper = (() => { try { const cu = api.getCurrentUser(); return cu && (cu.role === 'super_admin' || cu.role === 'admin_systeme'); } catch(e){ return false; } })();
                    if (!isSuper) return '<span class="text-[11px] text-slate-300">—</span>';
                    return `<div class="inline-flex items-center gap-1">
                        <button class="text-slate-400 hover:text-[#F46A21] hover:bg-[#FFF1E8] dark:hover:bg-orange-950/40 p-1.5 rounded-lg transition-colors cursor-pointer" title="Modifier les heures" data-edit-pointage="${p.id}">
                            <span class="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button class="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 rounded-lg transition-colors cursor-pointer" title="Supprimer le pointage" data-delete-pointage="${p.id}">
                            <span class="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                    </div>`;
                })()}
            </td>
        </tr>`;
    }).join('');
}

function initPage() {
    window._lastInitializedModule = 'pointage';
    renderHistoryTable(true);
    startCapteurPolling();

    // Ouvrir modal "Ajouter pointage"
    document.getElementById('btn-add-pointage')?.addEventListener('click', async () => {
        const users = (await api.getUsers()).filter(u => u.role === 'employe' && u.statut === 'actif');
        const select = document.getElementById('a-p-user');
        if (select) {
            select.innerHTML = '<option value="">— Sélectionner un employé —</option>' +
                users.map(u => `<option value="${u.id}">${escapeHtml(u.prenom)} ${escapeHtml(u.nom)} (${escapeHtml(u.matricule)})</option>`).join('');
        }
        const dateInput = document.getElementById('a-p-date');
        if (dateInput) dateInput.value = todayISO();
        const entreeInput = document.getElementById('a-p-entree');
        if (entreeInput) entreeInput.value = '';
        const sortieInput = document.getElementById('a-p-sortie');
        if (sortieInput) sortieInput.value = '';
        const entree2Input = document.getElementById('a-p-entree2');
        const sortie2Input = document.getElementById('a-p-sortie2');
        if (entree2Input) entree2Input.value = '';
        if (sortie2Input) sortie2Input.value = '';
        openModal('modal-add-pointage');
    });

    // Soumettre création pointage manuel
    document.getElementById('form-add-pointage')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = parseInt(document.getElementById('a-p-user').value, 10);
        const date = document.getElementById('a-p-date').value;
        const entree = document.getElementById('a-p-entree').value;
        const sortie = document.getElementById('a-p-sortie').value;
        if (!userId || !date || !entree) { flash('Employé, date et heure d\'entrée obligatoires.', 'warning'); return; }
        if (sortie && sortie <= entree) { flash('L\'heure de sortie doit être après l\'heure d\'entrée.', 'warning'); return; }
        const entree2 = document.getElementById('a-p-entree2')?.value || '';
        const sortie2 = document.getElementById('a-p-sortie2')?.value || '';
        if (entree2 && sortie2 && sortie2 <= entree2) { flash('La 2e sortie doit être après la 2e entrée.', 'warning'); return; }
        if (entree2 && sortie && entree2 <= sortie) { flash('La 2e entrée doit être après la première sortie.', 'warning'); return; }
        const submitBtn = e.submitter || document.querySelector('#form-add-pointage button[type="submit"]');
        await withButtonLoading(submitBtn, async () => {
            const res = await api.addPointage({ user_id: userId, date, entree, sortie, entree2, sortie2 });
            if (res.ok) {
                const isPast = date < todayISO();
                flash(isPast
                    ? `Pointage créé pour le ${formatDate(date)} — date passée : consultable dans l'Historique des pointages.`
                    : `Pointage manuel créé pour ${formatDate(date)}.`, 'success');
                closeModal('modal-add-pointage');
                renderHistoryTable(true);
            } else {
                flash(res.message, 'danger');
            }
        }, 'Création…');
    });

    document.getElementById('btn-refresh-history')?.addEventListener('click', async (e) => {
        setRefreshLoading(e.currentTarget, true);
        try { await renderHistoryTable(true); } finally { setRefreshLoading(e.currentTarget, false); }
    });
    document.getElementById('top-search')?.addEventListener('input', () => renderHistoryTable(false));
    document.getElementById('filter-status')?.addEventListener('change', () => renderHistoryTable(false));
    document.getElementById('filter-dept')?.addEventListener('change', () => renderHistoryTable(false));

    document.getElementById('capteur-badge')?.addEventListener('click', async () => {
        await refreshCapteurStatus();
        const data = await fetchCapteurStatus();
        flash(data.detail || (data.status==='hs' ? 'Capteur HS' : 'Capteur en service'), data.status==='hs' ? 'warning' : 'success');
    });

    // Panneau « Heures de travail du mois »
    renderHeuresMois(false);

    document.getElementById('form-edit-pointage')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (pointageEditingId === null) return;
        const entree = document.getElementById('f-p-entree').value;
        const sortie = document.getElementById('f-p-sortie').value;
        const entree2 = document.getElementById('f-p-entree2')?.value || '';
        const sortie2 = document.getElementById('f-p-sortie2')?.value || '';
        if (sortie && entree && sortie <= entree) { flash('L\'heure de sortie doit être après l\'heure d\'entrée.', 'warning'); return; }
        if (entree2 && sortie2 && sortie2 <= entree2) { flash('La 2e sortie doit être après la 2e entrée.', 'warning'); return; }
        if (entree2 && sortie && entree2 <= sortie) { flash('La 2e entrée doit être après la première sortie.', 'warning'); return; }
        const submitBtn = e.submitter || document.querySelector('#form-edit-pointage button[type="submit"]');
        await withButtonLoading(submitBtn, async () => {
            const res = await api.updatePointage(pointageEditingId, {
                date: document.getElementById('f-p-date').value,
                entree,
                sortie,
                entree2,
                sortie2
            });
            if (res.ok) {
                flash(`Heures de pointage corrigées.`, 'success');
                renderHeuresMois(true);
                closeModal('modal-edit-pointage');
                pointageEditingId = null;
                renderHistoryTable(true);
            } else {
                flash(res.message, 'danger');
            }
        }, 'Enregistrement…');
    });
}

// Panneau « Heures de travail du mois » : totaux par employé (table heures_mensuelles)
let _heuresMoisCache = null;
async function renderHeuresMois(force) {
    const body = document.getElementById('heures-mois-body');
    if (!body) return;
    const label = document.getElementById('heures-mois-label');
    try {
        if (force) _heuresMoisCache = null;
        if (!_heuresMoisCache) {
            const res = await api.getPointageTotals();
            if (!res.ok) throw new Error(res.message || 'erreur');
            _heuresMoisCache = res;
        }
        const { mois, totals } = _heuresMoisCache;
        if (label) label.textContent = mois;
        if (!totals || totals.length === 0) {
            body.innerHTML = '<div class="text-[12px] text-slate-400">Aucune heure enregistrée ce mois-ci.</div>';
            return;
        }
        body.innerHTML = totals.map(t => `
            <div class="flex items-center justify-between gap-sm p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                <div class="min-w-0">
                    <div class="font-semibold text-[12px] text-slate-800 dark:text-slate-100 truncate">${escapeHtml(t.label || ((t.prenom || '') + ' ' + (t.nom || '')))}</div>
                    <div class="text-[10px] font-mono text-slate-400">${escapeHtml(t.matricule || '')}</div>
                </div>
                <div class="inline-flex items-center gap-1 font-mono text-[13px] font-bold ${t.secondes > 0 ? 'text-[#F46A21]' : 'text-slate-300'}">
                    <span class="material-symbols-outlined text-[14px]">schedule</span>${fmtHours(t.secondes)}
                </div>
        </div>`).join('');
    } catch (e) {
        body.innerHTML = '<div class="text-[12px] text-slate-400">Totaux indisponibles.</div>';
    }
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['pointage'] = initPage;
window.initPage = initPage;
})();
