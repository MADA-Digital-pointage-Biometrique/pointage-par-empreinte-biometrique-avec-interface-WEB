(function () {
// ============================================================
// Page : Empreintes Biométriques
// ============================================================

const MODE_KEY          = 'mada-mode';          // 'enrolement' | 'pointage' | null
const ENROLL_TARGET_KEY = 'mada-enroll-target'; // JSON { id, prenom, nom, matricule, departement, empreinte }

function initials(u) {
    if (!u || !u.prenom || !u.nom) return 'U';
    return (u.prenom[0] + u.nom[0]).toUpperCase();
}

function avatar(u, size = 'w-9 h-9') {
    if (u.photo_url) {
        return `<div class="${size} rounded-full overflow-hidden border-2 border-[#F46A21]/30 shadow-sm flex-shrink-0"><img src="${u.photo_url}" alt="${u.prenom} ${u.nom}" class="w-full h-full object-cover"></div>`;
    }
    return `<div class="${size} rounded-full bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[12px] shadow-sm flex-shrink-0">${initials(u)}</div>`;
}

function empRow(u) {
    const empBadge = u.empreinte
        ? '<span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800"><span class="material-symbols-outlined text-[13px]">verified</span> Enregistrée</span>'
        : '<span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800"><span class="material-symbols-outlined text-[13px]">block</span> Aucune</span>';
    const isSuper = (() => { try { const cu = api.getCurrentUser(); return cu && (cu.role === 'super_admin' || cu.role === 'admin_systeme'); } catch(e){ return false; } })();
    const hasFp = u.empreinte === true || u.empreinte === 1;
    const action = !isSuper ? '' : (hasFp
        ? `<button class="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 rounded-lg transition-colors cursor-pointer" title="Supprimer l'empreinte" data-delete-fp="${u.id}"><span class="material-symbols-outlined text-[16px]">delete</span></button>`
        : `<button class="bg-[#FFF1E8] dark:bg-orange-950/40 text-[#F46A21] dark:text-[#F9AE3F] hover:bg-orange-100 font-semibold text-[11px] px-2.5 py-1 rounded-lg border border-[#F46A21]/25 dark:border-orange-900 transition-colors inline-flex items-center gap-1 cursor-pointer" data-enroll="${u.id}"><span class="material-symbols-outlined text-[14px]">fingerprint</span> Enrôler</button>`);

    return `
        <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors h-14">
            <td class="py-sm px-md">
                <div class="flex items-center gap-md">
                    ${avatar(u)}
                    <div>
                        <div class="font-semibold text-slate-900 dark:text-white">${u.prenom} ${u.nom}</div>
                        <div class="text-[11px] text-slate-400 md:hidden">${u.matricule}</div>
                    </div>
                </div>
            </td>
            <td class="py-sm px-md hidden md:table-cell font-mono text-[13px] text-slate-600 dark:text-slate-300">${u.matricule}</td>
            <td class="py-sm px-md font-medium text-slate-700 dark:text-slate-300">${u.departement || 'Non assigné'}</td>
            <td class="py-sm px-md">${empBadge}</td>
            <td class="py-sm px-md text-right"><div class="inline-flex items-center gap-1">${action}</div></td>
        </tr>`;
}

let allUsers = [];

async function renderEmpreintes(forceFetch = false) {
    if (forceFetch || !allUsers || allUsers.length === 0) {
        const raw = await api.getUsers();
        allUsers = raw.filter(u => u.role === 'employe');
    }
    const search = (document.getElementById('top-search')?.value || '').trim().toLowerCase();
    const filterDept = (document.getElementById('filter-dept')?.value || '').toLowerCase();
    const filterEmp = (document.getElementById('filter-emp')?.value || '');
    const filtered = allUsers.filter(u => {
        const matchesSearch = !search || u.nom.toLowerCase().includes(search) || u.prenom.toLowerCase().includes(search) || u.matricule.toLowerCase().includes(search) || (u.email||'').toLowerCase().includes(search) || (u.departement||'').toLowerCase().includes(search);
        const matchesDept = !filterDept || (u.departement||'').toLowerCase() === filterDept;
        const matchesEmp = !filterEmp || (filterEmp === 'yes' ? !!u.empreinte : !u.empreinte);
        return matchesSearch && matchesDept && matchesEmp;
    });
    const body = document.getElementById('users-body');
    if (body) body.innerHTML = filtered.map(empRow).join('') || '<tr><td colspan="5" class="py-lg px-md text-center text-slate-400">Aucun employé ne correspond aux critères.</td></tr>';
    const summary = document.getElementById('emp-count-summary');
    if (summary) summary.textContent = `${filtered.filter(u=>u.empreinte).length} empreinte(s) sur ${filtered.length} employé(s)`;
    const badge = document.getElementById('badge-count-emp');
    if (badge) badge.textContent = allUsers.length;
}

// ============================================================
// MODE OPÉRATOIRE & PANNEAU SÉLECTION EMPLOYÉ
// ============================================================

function getCurrentMode() {
    return storage.get(MODE_KEY) || 'pointage';
}

function refreshModeUI(mode) {
    ['enrolement', 'pointage'].forEach(m => {
        const btn = document.getElementById(`btn-mode-${m}`);
        if (!btn) return;
        btn.classList.toggle('mode-active', mode === m);
    });

    const banner     = document.getElementById('mode-info-banner');
    const bannerIcon = document.getElementById('mode-banner-icon');
    const bannerText = document.getElementById('mode-banner-text');
    const panel      = document.getElementById('panel-enroll-target');

    if (banner) banner.classList.remove('banner-enrolement', 'banner-pointage');

    if (!mode) {
        if (bannerIcon) bannerIcon.textContent = 'info';
        if (bannerText) bannerText.textContent = 'Aucun mode sélectionné. Veuillez choisir le mode opératoire du terminal.';
        if (panel) panel.classList.add('hidden');
        return;
    }

    const configs = {
        enrolement: {
            icon: 'fingerprint',
            text: 'Terminal en mode Enrôlement — Sélectionnez l\'employé cible ci-dessous avant de capturer l\'empreinte.',
            bannerClass: 'banner-enrolement',
        },
        pointage: {
            icon: 'how_to_reg',
            text: 'Terminal en mode Pointage — La borne identifiera les employés et enregistrera automatiquement les heures d\'entrée/sortie.',
            bannerClass: 'banner-pointage',
        },
    };

    const cfg = configs[mode];
    if (cfg) {
        if (bannerIcon) bannerIcon.textContent = cfg.icon;
        if (bannerText) bannerText.textContent = cfg.text;
        if (banner) banner.classList.add(cfg.bannerClass);
    }

    if (panel) {
        if (mode === 'enrolement') {
            panel.classList.remove('hidden');
            restoreEnrollTarget();
        } else {
            panel.classList.add('hidden');
        }
    }

    updateSidebarModeBadge(mode);
}

let capteurHs = false;
function setModeButtonsDisabled(hs, detail) {
    capteurHs = hs;
    ['enrolement','pointage'].forEach(m=>{
        const btn=document.getElementById(`btn-mode-${m}`);
        if(!btn) return;
        btn.disabled = hs;
        btn.classList.toggle('opacity-50', hs);
        btn.classList.toggle('cursor-not-allowed', hs);
        btn.classList.toggle('pointer-events-none', hs);
        btn.title = hs ? (detail || 'Capteur HS — changement de mode désactivé') : '';
    });
    const notice=document.getElementById('mode-capteur-notice');
    const noticeText=document.getElementById('mode-capteur-notice-text');
    if(notice){
        notice.className = hs
            ? 'flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border mb-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            : 'flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border mb-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
        if(noticeText) noticeText.textContent = hs ? 'Capteur HS — changement de mode désactivé' : 'Capteur En service — changement de mode disponible';
        const ic=notice.querySelector('.material-symbols-outlined'); if(ic) ic.textContent = hs ? 'sensor_occupied' : 'sensors';
    }
}
async function syncModeButtonsWithCapteur(){
    try{
        const r=await fetch(getApiEndpoint('sensor_status.php'),{credentials:'include',cache:'no-store'});
        if(r.status===401){ setModeButtonsDisabled(true,'Non authentifié'); return; }
        const j=await r.json();
        if(j.ok) setModeButtonsDisabled(j.status==='hs', j.detail);
        else setModeButtonsDisabled(true, j.message||'Capteur HS');
    }catch(e){ setModeButtonsDisabled(true,'Capteur non joignable'); }
}

async function applyMode(mode) {
    if (capteurHs) { flash('Capteur HS — changement de mode désactivé.', 'warning'); return; }
    // Enrôlement sans employé = reste en pointage côté R307 (en attente d'employé)
    if (mode === 'enrolement' && !storage.get(ENROLL_TARGET_KEY)) {
        // UI passe en enrolement mais R307 reste pointage jusqu'à sélection
        storage.set(MODE_KEY, mode);
        refreshModeUI(mode);
        document.dispatchEvent(new CustomEvent('mada:modeChanged', { detail: { mode } }));
        flash('Mode Enrôlement : sélectionne un employé — R307 reste en Pointage (en attente).', 'info');
        return;
    }
    const prevMode = storage.get(MODE_KEY);
    storage.set(MODE_KEY, mode);
    if (mode !== 'enrolement') storage.remove(ENROLL_TARGET_KEY);
    // Sync PHP→Python R307 (sensor_mode.php → python/mode.json).
    // Le succès n'est affiché qu'APRÈS confirmation serveur ; en cas d'échec,
    // l'UI revient à l'état réel du terminal (pas de divergence).
    const targetRaw = storage.get(ENROLL_TARGET_KEY);
    let targetId = null; try { const t = targetRaw ? JSON.parse(targetRaw) : null; if (t && t.id) targetId = t.id; } catch {}
    refreshModeUI(mode);
    document.dispatchEvent(new CustomEvent('mada:modeChanged', { detail: { mode } }));
    const labels = { enrolement: 'Enrôlement', pointage: 'Pointage' };
    try {
        const r = await fetchCsrf('sensor_mode.php', {mode, target_id: targetId});
        const j = await r.json();
        if (!j.ok) throw new Error(j.message || 'Erreur mode R307');
        flash(`Mode "${labels[mode]}" activé avec succès.`, 'success');
    } catch (e) {
        if (prevMode) storage.set(MODE_KEY, prevMode); else storage.remove(MODE_KEY);
        const realMode = getCurrentMode();
        refreshModeUI(realMode);
        document.dispatchEvent(new CustomEvent('mada:modeChanged', { detail: { mode: realMode } }));
        flash((e && e.message) || 'Erreur mode R307 — retour au mode précédent.', 'danger');
    }
}

function updateSidebarModeBadge(mode) {
    const badge = document.getElementById('sidebar-mode-badge');
    if (!badge) return;
    badge.className = '';
    badge.id = 'sidebar-mode-badge';
    if (!mode) { badge.style.display = 'none'; return; }
    const cfgMap = {
        enrolement: { cls: 'mode-badge-enrolement', icon: 'fingerprint', label: 'Enrôlement' },
        pointage:   { cls: 'mode-badge-pointage',   icon: 'how_to_reg',  label: 'Pointage'   },
    };
    const cfg = cfgMap[mode];
    if (cfg) {
        badge.style.display = '';
        badge.classList.add(cfg.cls);
    }
}

function renderSearchResults(employees, query) {
    const resultsEl = document.getElementById('enroll-target-results');
    const emptyEl   = document.getElementById('enroll-target-empty');
    if (!resultsEl) return;

    if (employees.length === 0) {
        resultsEl.classList.add('hidden');
        resultsEl.classList.remove('flex');
        if (emptyEl) { emptyEl.classList.remove('hidden'); emptyEl.classList.add('flex'); }
        return;
    }

    if (emptyEl) { emptyEl.classList.add('hidden'); emptyEl.classList.remove('flex'); }

    function hl(str, q) {
        if (!q) return str;
        const idx = str.toLowerCase().indexOf(q.toLowerCase());
        if (idx === -1) return str;
        return str.slice(0, idx) + `<mark class="bg-[#FFF1E8] dark:bg-orange-950/60 text-[#F46A21] dark:text-[#F9AE3F] rounded px-0.5 not-italic font-semibold">${str.slice(idx, idx + q.length)}</mark>` + str.slice(idx + q.length);
    }

    resultsEl.innerHTML = employees.map(u => {
        const hasFp = !!u.empreinte;
        const fpBadge = hasFp
            ? `<span class="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <span class="material-symbols-outlined text-[10px]">warning</span> À remplacer
               </span>`
            : `<span class="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span class="material-symbols-outlined text-[10px]">add_circle</span> Sans empreinte
               </span>`;

        return `
            <button class="enroll-result-row flex items-center gap-sm px-md py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left w-full border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                    data-emp-id="${u.id}">
                <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[12px] flex-shrink-0">
                    ${initials(u)}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-semibold text-[13px] text-slate-900 dark:text-white truncate">${hl(u.prenom + ' ' + u.nom, query)}</div>
                    <div class="text-[11px] font-mono text-slate-400">${hl(u.matricule, query)} · ${u.departement || 'Général'}</div>
                </div>
                ${fpBadge}
            </button>
        `;
    }).join('');

    resultsEl.classList.remove('hidden');
    resultsEl.classList.add('flex');
}

function selectEnrollTarget(employee) {
    storage.set(ENROLL_TARGET_KEY, JSON.stringify({
        id:         employee.id,
        prenom:     employee.prenom,
        nom:        employee.nom,
        matricule:  employee.matricule,
        departement:employee.departement || '',
        empreinte:  employee.empreinte,
    }));

    const stateSearch   = document.getElementById('enroll-target-state-search');
    const stateSelected = document.getElementById('enroll-target-selected');
    const emptyEl       = document.getElementById('enroll-target-empty');
    if (stateSearch)   { stateSearch.classList.add('hidden'); }
    if (emptyEl)       { emptyEl.classList.add('hidden'); emptyEl.classList.remove('flex'); }
    if (stateSelected) { stateSelected.classList.remove('hidden'); }

    const avatarEl = document.getElementById('enroll-sel-avatar');
    const nameEl   = document.getElementById('enroll-sel-name');
    const metaEl   = document.getElementById('enroll-sel-meta');
    const fpBadge  = document.getElementById('enroll-sel-fp-badge');

    if (avatarEl) {
        if (employee.photo_url) {
            avatarEl.innerHTML = `<img src="${employee.photo_url}" class="w-full h-full object-cover rounded-xl" alt="">`;
            avatarEl.className = 'w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-md';
        } else {
            avatarEl.textContent = initials(employee);
            avatarEl.className = 'w-12 h-12 rounded-xl bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[16px] shadow-md flex-shrink-0';
        }
    }
    if (nameEl) nameEl.textContent = `${employee.prenom} ${employee.nom}`;
    if (metaEl) metaEl.textContent = `${employee.matricule}${employee.departement ? ' · ' + employee.departement : ''}`;
    if (fpBadge) {
        if (employee.empreinte) {
            fpBadge.className = 'mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
            fpBadge.innerHTML = `<span class="material-symbols-outlined text-[11px]">warning</span> Empreinte existante — sera remplacée`;
        } else {
            fpBadge.className = 'mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
            fpBadge.innerHTML = `<span class="material-symbols-outlined text-[11px]">add_circle</span> Aucune empreinte — premier enrôlement`;
        }
    }

    document.dispatchEvent(new CustomEvent('mada:enrollTargetChanged', { detail: { employee } }));
    // Si mode enrolement, configure R307 immédiatement (PHP→python/mode.json)
    if (getCurrentMode() === 'enrolement') {
        fetchCsrf('sensor_mode.php', {mode:'enrolement', target_id: employee.id}).catch(()=>{});
    }
}

function restoreEnrollTarget() {
    const raw = storage.get(ENROLL_TARGET_KEY);
    if (!raw) return;
    try {
        const emp = JSON.parse(raw);
        if (emp && emp.id) selectEnrollTarget(emp);
    } catch (e) {}
}

function resetEnrollTarget() {
    storage.remove(ENROLL_TARGET_KEY);
    const stateSearch   = document.getElementById('enroll-target-state-search');
    const stateSelected = document.getElementById('enroll-target-selected');
    const searchInput   = document.getElementById('enroll-target-search');
    const resultsEl     = document.getElementById('enroll-target-results');
    const emptyEl       = document.getElementById('enroll-target-empty');
    if (stateSelected) stateSelected.classList.add('hidden');
    if (stateSearch)   stateSearch.classList.remove('hidden');
    if (resultsEl)     { resultsEl.classList.add('hidden'); resultsEl.classList.remove('flex'); }
    if (emptyEl)       { emptyEl.classList.add('hidden'); emptyEl.classList.remove('flex'); }
    if (searchInput)   { searchInput.value = ''; searchInput.focus(); }

    const clearBtn = document.getElementById('enroll-target-clear');
    if (clearBtn) clearBtn.classList.add('hidden');

    document.dispatchEvent(new CustomEvent('mada:enrollTargetChanged', { detail: { employee: null } }));
}

// ============================================================
// MODAL D'ENRÔLEMENT
// ============================================================

function openEnrollModal(target) {
    if (!target) return;

    // Définir automatiquement cet employé comme cible
    selectEnrollTarget(target);

    // États visuels des pastilles Capture 1 / Capture 2
    const setEnrollStep = (n, state) => {
        const el = document.getElementById(`step-${n}`);
        if (!el) return;
        const badge = el.querySelector('span');
        const check = el.querySelector('.step-icon');
        const base = 'flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-semibold ';
        if (state === 'done') {
            el.className = base + 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
            if (check) check.classList.remove('hidden');
        } else if (state === 'active') {
            el.className = base + 'bg-[#FFF1E8] dark:bg-orange-950/40 text-[#F46A21] dark:text-[#F9AE3F] border-[#F46A21]/40';
            if (check) check.classList.add('hidden');
        } else {
            el.className = base + 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500';
            if (check) check.classList.add('hidden');
        }
        if (badge && state !== 'done') badge.className = 'w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[12px]';
    };
    const setEnrollProgress = (pct) => {
        const wrap = document.getElementById('enroll-progress');
        const bar = document.getElementById('enroll-progress-bar');
        if (wrap) wrap.classList.remove('hidden');
        if (bar) bar.style.width = pct + '%'; // CSSOM autorisé par la CSP
    };
    const setEnrollHint = (txt) => {
        const hint = document.getElementById('enroll-hint');
        if (hint) hint.textContent = txt;
    };

    const startEnrollment = () => {
        openModal('modal-enroll');
        const icon = document.getElementById('enroll-icon');
        const step = document.getElementById('enroll-step');
        const btn = document.getElementById('btn-enroll');
        const cancelBtn = document.getElementById('btn-enroll-cancel');
        document.getElementById('enroll-person').textContent = `${target.prenom} ${target.nom} (${target.matricule})`;
        if (icon) {
            icon.className = 'w-24 h-24 rounded-full bg-[#FFF1E8] dark:bg-orange-950 text-[#F46A21] flex items-center justify-center mb-lg transition-colors duration-300 shadow-inner';
            icon.innerHTML = '<span class="material-symbols-outlined text-[48px]">fingerprint</span>';
        }
        if (step) step.textContent = "Placez le doigt de l'employé sur le capteur.";
        setEnrollStep(1, 'idle'); setEnrollStep(2, 'idle');
        setEnrollProgress(0); setEnrollHint("En attente — cliquez pour démarrer la capture 1.");
        if (btn) btn.disabled = false;
        const showCancel = (show) => {
            if (!cancelBtn) return;
            cancelBtn.classList.toggle('hidden', !show);
            cancelBtn.classList.toggle('flex', show);
        };
        showCancel(false);
        let enrollAbort = null;
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                // Annule la capture en cours (la requête Python côté serveur
                // termine son timeout seule ; le slot sera réutilisé).
                if (enrollAbort) enrollAbort.abort();
                setEnrollHint('Enrôlement annulé.');
                if (step) step.textContent = 'Enrôlement annulé — cliquez pour recommencer.';
                setEnrollStep(1, 'idle'); setEnrollStep(2, 'idle');
                showCancel(false);
                if (btn) btn.disabled = false;
                flash('Enrôlement annulé.', 'info');
            };
        }
        if (btn) {
            btn.onclick = async () => {
                btn.disabled = true;
                enrollAbort = new AbortController();
                const signal = enrollAbort.signal;
                showCancel(true);
                const wasAborted = (r) => r && r.aborted;
                const showAbort = () => {
                    // La fin effective est déjà gérée par le bouton Annuler.
                    showCancel(false);
                    if (btn) btn.disabled = false;
                };
                // ── CAPTURE 1 ──
                setEnrollStep(1, 'active');
                if (icon) {
                    icon.className = 'w-24 h-24 rounded-full bg-[#F46A21] text-white pulse-ring flex items-center justify-center mb-lg transition-colors duration-300';
                    icon.innerHTML = '<span class="material-symbols-outlined text-[48px]">fingerprint</span>';
                }
                if (step) step.textContent = 'Capture 1/2 : posez le doigt sur le capteur…';
                setEnrollHint('En attente du doigt (capture 1)…');
                const r1 = await api.enrollStep1(target.id, signal);
                if (wasAborted(r1)) { showAbort(); return; }
                if (!r1.ok) {
                    if (icon) {
                        icon.className = 'w-24 h-24 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-lg transition-colors duration-300';
                        icon.innerHTML = '<span class="material-symbols-outlined text-[48px]">error</span>';
                    }
                    if (step) step.textContent = r1.message;
                    setEnrollStep(1, 'idle'); setEnrollHint('Échec capture 1 — réessaie.');
                    showCancel(false);
                    btn.disabled = false;
                    return;
                }
                // Capture 1 validée
                setEnrollStep(1, 'done'); setEnrollStep(2, 'active');
                setEnrollProgress(50);
                if (step) step.textContent = 'Capture 1 validée ✓ — retirez puis reposez le doigt…';
                setEnrollHint('En attente du doigt (capture 2)…');
                flash('Capture 1 validée.', 'success');
                // ── CAPTURE 2 ──
                const r2 = await api.enrollStep2(target.id, r1.slot, signal);
                if (wasAborted(r2)) { showAbort(); return; }
                showCancel(false);
                if (!r2.ok) {
                    if (icon) {
                        icon.className = 'w-24 h-24 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-lg transition-colors duration-300';
                        icon.innerHTML = '<span class="material-symbols-outlined text-[48px]">error</span>';
                    }
                    if (step) step.textContent = r2.message;
                    setEnrollStep(2, 'idle'); setEnrollHint('Échec capture 2 — reprends à la capture 1.');
                    btn.disabled = false;
                    return;
                }
                setEnrollStep(2, 'done'); setEnrollProgress(100);
                if (icon) {
                    icon.className = 'w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-lg transition-colors duration-300';
                    icon.innerHTML = '<span class="material-symbols-outlined text-[48px]">check_circle</span>';
                }
                if (step) step.textContent = r2.message;
                setEnrollHint('Enrôlement terminé.');
                flash(r2.message, 'success');
                btn.disabled = false;

                // Mettre à jour la cible et rafraîchir le tableau
                const updated = { ...target, empreinte: true };
                selectEnrollTarget(updated);

                setTimeout(() => {
                    closeModal('modal-enroll');
                    renderEmpreintes(true);
                }, 1200);
            };
        }
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
}

function initEnrollTargetPanel() {
    const searchInput = document.getElementById('enroll-target-search');
    const clearBtn    = document.getElementById('enroll-target-clear');
    const resultsEl   = document.getElementById('enroll-target-results');
    const changeBtn   = document.getElementById('btn-change-enroll-target');
    const launchBtn   = document.getElementById('btn-launch-enroll');

    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        if (clearBtn) clearBtn.classList.toggle('hidden', q.length === 0);

        if (q.length === 0) {
            if (resultsEl) { resultsEl.classList.add('hidden'); resultsEl.classList.remove('flex'); }
            const emptyEl = document.getElementById('enroll-target-empty');
            if (emptyEl) { emptyEl.classList.add('hidden'); emptyEl.classList.remove('flex'); }
            return;
        }

        const filtered = allUsers.filter(u =>
            u.nom.toLowerCase().includes(q) ||
            u.prenom.toLowerCase().includes(q) ||
            u.matricule.toLowerCase().includes(q) ||
            (u.departement || '').toLowerCase().includes(q)
        );
        renderSearchResults(filtered, q);
    });

    if (resultsEl) {
        resultsEl.addEventListener('click', (e) => {
            const row = e.target.closest('.enroll-result-row');
            if (!row) return;
            const id  = parseInt(row.dataset.empId, 10);
            const emp = allUsers.find(u => u.id === id);
            if (emp) selectEnrollTarget(emp);
        });
    }

    if (clearBtn) clearBtn.addEventListener('click', () => {
        if (searchInput) { searchInput.value = ''; searchInput.focus(); }
        clearBtn.classList.add('hidden');
        if (resultsEl) { resultsEl.classList.add('hidden'); resultsEl.classList.remove('flex'); }
        const emptyEl = document.getElementById('enroll-target-empty');
        if (emptyEl) { emptyEl.classList.add('hidden'); emptyEl.classList.remove('flex'); }
    });

    if (changeBtn) changeBtn.addEventListener('click', resetEnrollTarget);

    if (launchBtn) {
        launchBtn.addEventListener('click', () => {
            try {
                const raw = storage.get(ENROLL_TARGET_KEY);
                const emp = raw ? JSON.parse(raw) : null;
                if (!emp) { flash('Veuillez sélectionner un employé cible.', 'warning'); return; }
                openEnrollModal(emp);
            } catch (e) {
                flash('Erreur lors de la lecture de l\'employé cible.', 'danger');
            }
        });
    }
}

// Global click event delegation
if (!window._empreintesGlobalClickAttached) {
    window._empreintesGlobalClickAttached = true;
    document.addEventListener('click', (e) => {
        if (document.body.getAttribute('data-page') !== 'empreintes') return;
        const enrollBtn = e.target.closest('[data-enroll]');
        if (enrollBtn) {
            const id = parseInt(enrollBtn.dataset.enroll, 10);
            const target = allUsers.find(u => u.id === id);
            if (target) openEnrollModal(target);
            return;
        }
        const deleteFpBtn = e.target.closest('[data-delete-fp]');
        if (deleteFpBtn) {
            const id = parseInt(deleteFpBtn.dataset.deleteFp, 10);
            const target = allUsers.find(u => u.id === id);
            if (target) {
                showConfirmModal({
                    title: 'Supprimer l\'empreinte ?',
                    message: `Voulez-vous vraiment supprimer l'empreinte biométrique de ${target.prenom} ${target.nom} (${target.matricule}) ? L'employé devra être ré-enrôlé.`,
                    type: 'warning',
                    confirmText: 'Oui, Supprimer',
                    cancelText: 'Annuler',
                    onConfirm: async () => {
                        const res = await api.deleteFingerprint(target.id);
                        if (res.ok) {
                            flash(`Empreinte de ${target.prenom} ${target.nom} supprimée.`, 'success');
                            // Si c'était la cible actuelle, réinitialiser la cible
                            const rawTarget = storage.get(ENROLL_TARGET_KEY);
                            if (rawTarget) {
                                try {
                                    const cur = JSON.parse(rawTarget);
                                    if (cur.id === target.id) selectEnrollTarget({ ...target, empreinte: false });
                                } catch(e){}
                            }
                            await renderEmpreintes(true);
                        } else {
                            flash(res.message || 'Échec de la suppression.', 'danger');
                        }
                    }
                });
            }
            return;
        }
    });
}

async function initPage() {
    window._lastInitializedModule = 'empreintes';
    const user = api.getCurrentUser();
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'super_admin') {
        flash('Accès réservé aux administrateurs.', 'danger');
        setTimeout(() => { window.location.href = 'dashboard.php'; }, 1500);
        return;
    }

    const [, depts] = await Promise.all([
        renderEmpreintes(true),
        api.getDepartements()
    ]);

    // Mode opératoire
    const currentMode = getCurrentMode();
    refreshModeUI(currentMode);

    ['enrolement', 'pointage'].forEach(m => {
        const btn = document.getElementById(`btn-mode-${m}`);
        if (btn) {
            btn.onclick = () => {
                if (btn.disabled) { flash('Capteur HS — changement de mode désactivé.', 'warning'); return; }
                if (!btn.classList.contains('mode-active')) applyMode(m);
            };
        }
    });
    // Capteur HS → boutons non cliquables (désactivés par défaut jusqu'à preuve En service)
    setModeButtonsDisabled(true, 'Vérification capteur…');
    syncModeButtonsWithCapteur();
    setInterval(syncModeButtonsWithCapteur, 5000);
    document.addEventListener('capteurStatusChanged', e=> setModeButtonsDisabled(e.detail?.status==='hs', e.detail?.detail));

    // Panneau sélection employé
    initEnrollTargetPanel();

    const searchInput = document.getElementById('top-search');
    if (searchInput) searchInput.oninput = () => renderEmpreintes(false);
    const filterDept = document.getElementById('filter-dept');
    if (filterDept) filterDept.onchange = () => renderEmpreintes(false);
    const filterEmp = document.getElementById('filter-emp');
    if (filterEmp) filterEmp.onchange = () => renderEmpreintes(false);

    // Remplir départements
    const sel = document.getElementById('filter-dept');
    if (sel && depts && depts.length > 0) {
        const cur = sel.value;
        sel.innerHTML = '<option value="">Tous les Départements</option>' + depts.map(d=>`<option value="${d.nom}" ${d.nom===cur?'selected':''}>${d.nom}</option>`).join('');
    }
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['empreintes'] = initPage;
window.initPage = initPage;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else { initPage(); }
})();
