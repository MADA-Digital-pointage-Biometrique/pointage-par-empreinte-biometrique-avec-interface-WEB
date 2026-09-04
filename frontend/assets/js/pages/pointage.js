(function () {
// ============================================================
// Page : Pointages — listes et filtrage connectés MySQL
// ============================================================

let pointageEditingId = null;
let pointagePeriod = 'today';

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

function filterPointages(db) {
    const search = (document.getElementById('top-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('filter-status')?.value || '';
    const dept = document.getElementById('filter-dept')?.value || '';
    const todayStr = todayISO();

    let matchesPeriod;
    if (pointagePeriod === 'today') {
        matchesPeriod = p => p.date === todayStr;
    } else {
        const sel = (document.getElementById('filter-date')?.value || '').trim();
        matchesPeriod = p => !sel || p.date === sel;
    }

    return (db.pointages || []).filter(p => {
        if (!matchesPeriod(p)) return false;

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
        const btn = e.target.closest('[data-edit-pointage]');
        if (!btn) return;
        const id = parseInt(btn.dataset.editPointage, 10);
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
        const u = p.user || (db.users || []).find(u => u.id === p.user_id) || {prenom:'',nom:'',matricule:''};
        if (userEl) userEl.textContent = `${u.prenom} ${u.nom} (${u.matricule||''})`;
        openModal('modal-edit-pointage');
    });
}

async function renderHistoryTable(forceFetch = false) {
    const tbody = document.getElementById('history-body');
    if (!tbody) return;

    if (forceFetch || !cachedPointagesDb) {
        const [users, pointages] = await Promise.all([
            api.getUsers(),
            api.getTodayPointages()
        ]);
        cachedPointagesDb = { users, pointages };
    }

    const db = cachedPointagesDb;
    populateDeptFilter(db);
    // Ne plus écraser l'état réel avec le fallback local
    const list = filterPointages(db);

    const summary = document.getElementById('pointage-count-summary');
    if (summary) summary.textContent = `Affichage de ${list.length} pointage(s) sur ${db.pointages.length} au total`;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-lg px-md text-center text-slate-400">Aucun pointage ne correspond aux critères.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(p => {
        const u = p.user || { prenom: 'Employé', nom: '', matricule: 'EMP' };
        return `
        <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors h-14" data-row-pointage="${p.id}">
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
            <td class="py-sm px-md font-mono text-[12px] text-slate-500 dark:text-slate-400">${formatDate(p.date)}</td>
            <td class="py-sm px-md font-mono text-[13px] text-emerald-600 dark:text-emerald-400 font-semibold">${p.entree ? p.entree.slice(0, 5) : '—'}</td>
            <td class="py-sm px-md font-mono text-[13px] text-rose-600 dark:text-rose-400 font-semibold">${p.sortie ? p.sortie.slice(0, 5) : '—'}</td>
            <td class="py-sm px-md text-right">${statusBadge(p)}</td>
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

function initPage() {
    window._lastInitializedModule = 'pointage';
    renderHistoryTable(true);
    startCapteurPolling();

    document.getElementById('btn-refresh-history')?.addEventListener('click', () => renderHistoryTable(true));
    document.getElementById('top-search')?.addEventListener('input', () => renderHistoryTable(false));
    document.getElementById('filter-status')?.addEventListener('change', () => renderHistoryTable(false));
    document.getElementById('filter-dept')?.addEventListener('change', () => renderHistoryTable(false));

    document.getElementById('capteur-badge')?.addEventListener('click', async () => {
        await refreshCapteurStatus();
        const data = await fetchCapteurStatus();
        flash(data.detail || (data.status==='hs' ? 'Capteur HS' : 'Capteur en service'), data.status==='hs' ? 'warning' : 'success');
    });

    document.querySelectorAll('.period-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-pill').forEach(b => {
                b.classList.remove('active', 'bg-white', 'dark:bg-slate-900', 'shadow-sm', 'text-slate-900', 'dark:text-white');
                b.classList.add('text-slate-600', 'dark:text-slate-400');
            });
            btn.classList.add('active', 'bg-white', 'dark:bg-slate-900', 'shadow-sm', 'text-slate-900', 'dark:text-white');
            btn.classList.remove('text-slate-600', 'dark:text-slate-400');

            pointagePeriod = btn.dataset.period;
            const dateWrap = document.getElementById('date-filter-wrap');
            if (dateWrap) {
                dateWrap.classList.toggle('hidden', pointagePeriod !== 'date');
                if (pointagePeriod === 'date') {
                    const dateInput = document.getElementById('filter-date');
                    if (dateInput && !dateInput.value) dateInput.value = todayISO();
                }
            }
            renderHistoryTable(false);
        });
    });

    document.getElementById('filter-date')?.addEventListener('change', () => {
        const datePill = [...document.querySelectorAll('.period-pill')].find(b => b.dataset.period === 'date');
        if (datePill) {
            document.querySelectorAll('.period-pill').forEach(b => {
                b.classList.remove('active', 'bg-white', 'dark:bg-slate-900', 'shadow-sm', 'text-slate-900', 'dark:text-white');
                b.classList.add('text-slate-600', 'dark:text-slate-400');
            });
            datePill.classList.add('active', 'bg-white', 'dark:bg-slate-900', 'shadow-sm', 'text-slate-900', 'dark:text-white');
            datePill.classList.remove('text-slate-600', 'dark:text-slate-400');
            pointagePeriod = 'date';
        }
        renderHistoryTable(false);
    });

    document.getElementById('form-edit-pointage')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (pointageEditingId === null) return;
        const res = await api.updatePointage(pointageEditingId, {
            date: document.getElementById('f-p-date').value,
            entree: document.getElementById('f-p-entree').value,
            sortie: document.getElementById('f-p-sortie').value
        });
        if (res.ok) {
            flash(`Heures de pointage corrigées.`, 'success');
            closeModal('modal-edit-pointage');
            pointageEditingId = null;
            renderHistoryTable(true);
        } else {
            flash(res.message, 'danger');
        }
    });
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['pointage'] = initPage;
window.initPage = initPage;
})();
