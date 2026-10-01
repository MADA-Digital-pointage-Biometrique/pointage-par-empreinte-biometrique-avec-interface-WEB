(function () {
// ============================================================
// Page : Capteur (terminal biométrique)
// ============================================================

const MODE_KEY          = 'mada-mode';          // 'enrolement' | 'pointage' | null
const ENROLL_TARGET_KEY = 'mada-enroll-target'; // JSON { id, prenom, nom, matricule, departement, empreinte }

// Séquencement manuel d'enrôlement : libellé d'origine du bouton (phase
// capture 1), restauré à chaque ouverture du modal et après abandon.
let enrollBtnLabel1 = null;

function initials(u) {
    if (!u || !u.prenom || !u.nom) return 'U';
    return (u.prenom[0] + u.nom[0]).toUpperCase();
}

function avatar(u, size = 'w-9 h-9') {
    if (u.photo_url) {
        return `<div class="${size} rounded-full overflow-hidden border-2 border-[#F46A21]/30 shadow-sm flex-shrink-0"><img src="${u.photo_url}" alt="${escapeHtml(u.prenom)} ${escapeHtml(u.nom)}" class="w-full h-full object-cover"></div>`;
    }
    return `<div class="${size} rounded-full bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[12px] shadow-sm flex-shrink-0">${initials(u)}</div>`;
}

function fmtDateEnrolement(iso) {
    if (!iso) return '<span class="text-slate-300 dark:text-slate-600 font-medium">—</span>';
    const d = String(iso).slice(0, 10).split('-');
    if (d.length !== 3) return '<span class="text-slate-300 dark:text-slate-600 font-medium">—</span>';
    return `${d[2]}/${d[1]}/${d[0]}`;
}
function empRow(u) {
    const isSuper = (() => { try { const cu = api.getCurrentUser(); return cu && (cu.role === 'super_admin' || cu.role === 'admin_systeme'); } catch(e){ return false; } })();
    const hasFp = u.empreinte === true || u.empreinte === 1;
    const enrollMode = getCurrentMode() === 'enrolement';
    let action = '';
    if (isSuper) {
        if (hasFp) {
            action = `<button class="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 rounded-lg transition-colors cursor-pointer" title="Supprimer l'empreinte" data-delete-fp="${u.id}"><span class="material-symbols-outlined text-[16px]">delete</span></button>`;
        } else if (enrollMode) {
            // Bouton Enrôler visible UNIQUEMENT en mode Enrôlement.
            action = `<button class="bg-[#FFF1E8] dark:bg-orange-950/40 text-[#F46A21] dark:text-[#F9AE3F] hover:bg-orange-100 font-semibold text-[11px] px-2.5 py-1 rounded-lg border border-[#F46A21]/25 dark:border-orange-900 transition-colors inline-flex items-center gap-1 cursor-pointer" data-enroll="${u.id}"><span class="material-symbols-outlined text-[14px]">fingerprint</span> Enrôler</button>`;
        } else {
            action = `<span class="text-slate-300 dark:text-slate-600 inline-flex items-center cursor-help" title="Le bouton Enrôler apparaît en mode Enrôlement"><span class="material-symbols-outlined text-[16px]">lock</span></span>`;
        }
    }

    return `
        <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors h-14">
            <td class="py-sm px-md">
                <div class="flex items-center gap-md">
                    ${avatar(u)}
                    <div>
                        <div class="font-semibold text-slate-900 dark:text-white">${escapeHtml(u.prenom)} ${escapeHtml(u.nom)}</div>
                        <div class="text-[11px] text-slate-400 md:hidden">${escapeHtml(u.matricule)}</div>
                    </div>
                </div>
            </td>
            <td class="py-sm px-md hidden md:table-cell font-mono text-[13px] text-slate-600 dark:text-slate-300">${escapeHtml(u.matricule)}</td>
            <td class="py-sm px-md text-center font-mono font-bold text-[14px] text-[#F46A21] dark:text-[#F9AE3F]">${(u.slot_number ?? null) !== null ? u.slot_number : '<span class="text-slate-300 dark:text-slate-600 font-medium">—</span>'}</td>
            <td class="py-sm px-md font-medium text-[13px] text-slate-600 dark:text-slate-300 whitespace-nowrap">${fmtDateEnrolement(u.date_enrolement)}</td>
            <td class="py-sm px-md text-right"><div class="inline-flex items-center gap-1">${action}</div></td>
        </tr>`;
}

let allUsers = [];

async function renderCapteur(forceFetch = false) {
    if (forceFetch || !allUsers || allUsers.length === 0) {
        const raw = await api.getUsers();
        allUsers = raw.filter(u => u.role === 'employe');
    }
    const search = (document.getElementById('top-search')?.value || '').trim().toLowerCase();
    const filterSlot = (document.getElementById('filter-slot')?.value || '').toLowerCase();
    const filterEmp = (document.getElementById('filter-emp')?.value || '');
    const filtered = allUsers.filter(u => {
        const matchesSearch = !search || u.nom.toLowerCase().includes(search) || u.prenom.toLowerCase().includes(search) || u.matricule.toLowerCase().includes(search) || (u.email||'').toLowerCase().includes(search) || (u.departement||'').toLowerCase().includes(search) || String(u.slot_number ?? '').includes(search);
        const hasSlot = (u.slot_number ?? null) !== null;
        const matchesSlot = !filterSlot || (filterSlot === 'used' ? hasSlot : !hasSlot);
        const matchesEmp = !filterEmp || (filterEmp === 'yes' ? !!u.empreinte : !u.empreinte);
        return matchesSearch && matchesSlot && matchesEmp;
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
function updateSensorCard(data) {
    // Carte « État du capteur » : statut + N/999 + port + détail (poll 5 s)
    // + état de la surveillance daemon (watch) quand elle est exposée.
    const pill = document.getElementById('sensor-state-pill');
    const countEl = document.getElementById('sensor-slots-count');
    const bar = document.getElementById('sensor-slots-bar');
    const portEl = document.getElementById('sensor-state-port');
    const watchEl = document.getElementById('sensor-watch-badge');
    const detailEl = document.getElementById('sensor-state-detail');
    const updatedEl = document.getElementById('sensor-state-updated');
    if (!pill) return;
    const hs = !data || data.status === 'hs';
    if (watchEl) {
        const watching = !!(data && data.watching);
        const watchEnabled = !!(data && data.watch_enabled);
        const baseWatch = 'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ';
        if (watching) {
            watchEl.className = baseWatch + 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
            watchEl.innerHTML = '<span class="material-symbols-outlined text-[12px]">radar</span> Surveillance active';
            watchEl.title = 'Le capteur scrute en continu — posez un doigt pour pointer';
        } else if (hs) {
            watchEl.className = baseWatch + 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
            watchEl.innerHTML = '<span class="material-symbols-outlined text-[12px]">radar</span> Surveillance inactive';
            watchEl.title = 'Capteur hors service — surveillance impossible';
        } else if (watchEnabled) {
            watchEl.className = baseWatch + 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
            watchEl.innerHTML = '<span class="material-symbols-outlined text-[12px]">pause_circle</span> Surveillance en pause';
            watchEl.title = 'Mode enrôlement ou capture en cours — la surveillance reprendra automatiquement';
        } else {
            watchEl.className = baseWatch + 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
            watchEl.innerHTML = '<span class="material-symbols-outlined text-[12px]">radar</span> Surveillance inactive';
            watchEl.title = 'Lancez le service de surveillance (python/start_r307_service.bat) pour activer la détection continue';
        }
    }
    const base = 'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ';
    if (hs) {
        pill.className = base + 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
        pill.innerHTML = '<span class="material-symbols-outlined text-[14px]">sensor_occupied</span> HS';
        if (countEl) countEl.textContent = '–';
        if (bar) bar.style.width = '0%';
    } else {
        const count = Math.max(0, parseInt(data.count ?? 0, 10) || 0);
        pill.className = base + 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
        pill.innerHTML = '<span class="material-symbols-outlined text-[14px]">sensors</span> En service';
        if (countEl) countEl.textContent = String(count);
        if (bar) bar.style.width = Math.min(100, Math.max(count > 0 ? 2 : 0, Math.round(count / 999 * 100))) + '%';
    }
    if (portEl) portEl.textContent = (data && data.port) || '–';
    if (detailEl) detailEl.textContent = (data && (data.detail || data.message)) || 'Capteur non joignable';
    if (updatedEl) updatedEl.textContent = new Date().toLocaleTimeString('fr-FR');
}
async function syncModeButtonsWithCapteur(){
    try{
        const r=await fetch(getApiEndpoint('sensor_status.php'),{credentials:'include',cache:'no-store'});
        if(r.status===401){ setModeButtonsDisabled(true,'Non authentifié'); updateSensorCard(null); return; }
        const j=await r.json();
        if(j.ok) { setModeButtonsDisabled(j.status==='hs', j.detail); updateSensorCard(j); }
        else { setModeButtonsDisabled(true, j.message||'Capteur HS'); updateSensorCard({status:'hs', detail:j.message}); }
    }catch(e){ setModeButtonsDisabled(true,'Capteur non joignable'); updateSensorCard(null); }
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
        enforceWatchForMode(mode);
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
        flash(j.remote?.queued
            ? `Mode "${labels[mode]}" enregistré — appliqué par la borne (~3 s).`
            : `Mode "${labels[mode]}" activé avec succès.`, 'success');
        enforceWatchForMode(mode);
    } catch (e) {
        if (prevMode) storage.set(MODE_KEY, prevMode); else storage.remove(MODE_KEY);
        const realMode = getCurrentMode();
        refreshModeUI(realMode);
        document.dispatchEvent(new CustomEvent('mada:modeChanged', { detail: { mode: realMode } }));
        flash((e && e.message) || 'Erreur mode R307 — retour au mode précédent.', 'danger');
    }
}

// B3 : réconciliation slots DB ↔ capteur (diagnostic + purge orphelins).
function renderReconcileResult(j) {
    const box = document.getElementById('reconcile-result');
    if (!box) return;
    box.classList.remove('hidden');
    if (!j.ok) {
        box.innerHTML = `<div class="border rounded-xl px-md py-sm bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800">Capteur injoignable : ${j.message || ''} — réconciliation impossible.</div>`;
        return;
    }
    const okCls = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    const warnCls = 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    const rows = (j.missing_on_sensor || []).map(m =>
        `<div class="flex items-center justify-between gap-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <span class="font-mono">slot ${m.slot}</span>
            <span class="truncate">${m.nom || ''} <span class="font-mono text-slate-400">(${m.matricule || ''})</span></span>
            <span class="text-rose-600 dark:text-rose-400 font-semibold">absent capteur</span>
        </div>`).join('');
    box.innerHTML = `
        <div class="border rounded-xl px-md py-sm ${(!j.missing_on_sensor?.length && !j.orphans_suspected) ? okCls : warnCls} border">
            <div class="font-semibold mb-1">${j.message || ''}</div>
            <div class="font-mono text-[11px] opacity-80">Base : ${j.db_slots} mapping(s) · Capteur : ${j.sensor_count} page(s)${j.repaired ? ` · ${j.repaired} purgé(s)` : ''}</div>
            ${rows ? `<div class="mt-2">${rows}</div>` : ''}
            ${(j.missing_on_sensor?.length && !j.repaired) ? `<button id="btn-reconcile-repair" class="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold px-md py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all cursor-pointer"><span class="material-symbols-outlined text-[15px]">delete_sweep</span> Purger ${j.missing_on_sensor.length} mapping(s) orphelin(s)</button>` : ''}
        </div>`;
    const repairBtn = document.getElementById('btn-reconcile-repair');
    if (repairBtn) repairBtn.addEventListener('click', () => {
        showConfirmModal({
            title: 'Purger les mappings orphelins ?',
            message: 'Les mappings base sans page capteur seront supprimés (gabarits désactivés). Les employés concernés devront être ré-enrôlés. Continuer ?',
            type: 'warning',
            confirmText: 'Oui, purger',
            cancelText: 'Annuler',
            onConfirm: () => runReconcile(true)
        });
    });
}
async function runReconcile(repair = false) {
    const btn = document.getElementById('btn-reconcile');
    const box = document.getElementById('reconcile-result');
    if (btn) btn.disabled = true;
    if (box) {
        box.classList.remove('hidden');
        box.innerHTML = '<div class="text-slate-400 text-[12px]">Sondage du capteur page par page… (peut durer ~1 s/slot)</div>';
    }
    try {
        const r = await fetchCsrf('sensor_reconcile.php', repair ? { repair: 1 } : {});
        const j = await r.json();
        renderReconcileResult(j);
        if (j.ok && j.repaired) renderCapteur(true);
    } catch (e) {
        if (box) box.innerHTML = '<div class="text-rose-600 text-[12px]">Erreur réseau pendant la réconciliation.</div>';
    } finally {
        if (btn) btn.disabled = false;
    }
}
function initReconcile() {
    document.getElementById('btn-reconcile')?.addEventListener('click', () => runReconcile(false));
}

// ============================================================
// SURVEILLANCE (watch) — interrupteur activer/désactiver
// ============================================================
// Verrou du switch en mode Enrôlement : l'interrupteur n'est cliquable
// qu'en mode Pointage (appliqué à chaque rendu + après chaque toggle).
function applyWatchLock() {
    const btn = document.getElementById('btn-watch-toggle');
    if (!btn) return;
    const locked = getCurrentMode() === 'enrolement';
    btn.disabled = locked;
    if (locked) btn.title = 'Surveillance verrouillée en mode Enrôlement — repassez en Pointage pour la réactiver';
}

// Entrée en mode Enrôlement ⇒ surveillance auto-OFF (une fois par entrée).
// Ne fait rien si déjà éteinte : aucun appel ni audit superflu.
let watchOffFiredForEnrolment = false;
async function enforceWatchForMode(mode) {
    if (mode !== 'enrolement') { watchOffFiredForEnrolment = false; return; }
    if (watchOffFiredForEnrolment) return;
    const btn = document.getElementById('btn-watch-toggle');
    if (!btn || btn.dataset.watchState !== 'on') return;
    watchOffFiredForEnrolment = true;
    try {
        const r = await fetchCsrf('sensor_watch.php', { enabled: false });
        const j = await r.json();
        renderWatchButton(j.ok ? 'off' : 'on');
        flash(j.ok ? 'Surveillance désactivée (mode Enrôlement).' : (j.message || 'Échec désactivation surveillance'), j.ok ? 'info' : 'error');
        if (!j.ok) watchOffFiredForEnrolment = false; // réessaiera au prochain déclencheur
    } catch (e) {
        watchOffFiredForEnrolment = false;
        flash('Erreur réseau — surveillance inchangée', 'error');
    }
}

function renderWatchButton(state) {
    // state: 'unknown' | 'on' | 'off' — reflète watch_user_enabled (daemon ou défaut off)
    const btn = document.getElementById('btn-watch-toggle');
    const txt = document.getElementById('watch-state-text');
    if (!btn) return;
    const on = state === 'on';
    btn.dataset.watchState = state;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
    if (txt) {
        if (state === 'unknown') {
            txt.textContent = 'État inconnu';
            txt.className = 'text-[11px] font-medium text-slate-400 mt-0.5';
        } else if (on) {
            txt.textContent = 'Activée — le capteur scrute en continu';
            txt.className = 'text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5';
        } else {
            txt.textContent = 'Désactivée — détection continue arrêtée';
            txt.className = 'text-[11px] font-medium text-slate-400 mt-0.5';
        }
    }
    btn.title = on
        ? 'Cliquer pour arrêter la détection continue (le capteur s\'éteint, les scans à la demande restent possibles)'
        : 'Cliquer pour démarrer le service de surveillance — le capteur scrute en continu et enregistre les pointages';
    applyWatchLock();
}

async function syncWatchButton() {
    let state = 'unknown';
    try {
        const r = await fetch(getApiEndpoint('sensor_watch.php'), { credentials: 'include', cache: 'no-store' });
        if (r.ok) {
            const j = await r.json();
            if (j.ok) {
                // Borne distante : sans daemon direct, refléter l'ordre désiré
                // (l'appliqué suit en ~3 s via heartbeat/poll).
                if (!j.daemon_up && j.remote && j.remote.desired) state = j.remote.desired === 'on' ? 'on' : 'off';
                else state = j.watch_user_enabled ? 'on' : 'off';
            }
        }
    } catch (e) { state = 'unknown'; }
    renderWatchButton(state);
    // Entrée en enrôlement ⇒ surveillance auto-OFF (une fois).
    enforceWatchForMode(getCurrentMode());
}

async function toggleWatch() {
    const btn = document.getElementById('btn-watch-toggle');
    if (!btn || btn.disabled) return;
    // Verrou mode Enrôlement : l'interrupteur ne s'active qu'en Pointage.
    if (getCurrentMode() === 'enrolement') { flash('Mode Enrôlement : surveillance verrouillée — repassez en Pointage.', 'warning'); return; }
    const wantOn = btn.dataset.watchState !== 'on';
    btn.disabled = true;
    try {
        const r = await fetchCsrf('sensor_watch.php', { enabled: wantOn });
        const j = await r.json();
        if (j.ok) {
            renderWatchButton(j.watch_user_enabled ? 'on' : 'off');
            if (wantOn && typeof window.sensorLiveReopen === 'function') {
                // Le widget temps réel s'affiche immédiatement à l'activation
                window.sensorLiveReopen();
            }
            flash(j.message || (wantOn ? 'Surveillance activée' : 'Surveillance désactivée'), wantOn ? 'success' : 'info');
        } else {
            flash(j.message || 'Échec du changement de surveillance', 'error');
        }
    } catch (e) {
        flash('Erreur réseau — surveillance inchangée', 'error');
    } finally {
        applyWatchLock();
        syncModeButtonsWithCapteur(); // rafraîchit badge + état carte au cycle suivant
    }
}

function initWatchToggle() {
    const btn = document.getElementById('btn-watch-toggle');
    if (!btn) return;
    btn.addEventListener('click', toggleWatch);
    syncWatchButton();
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
        // Indicateur de transport (borne locale via navigateur vs serveur).
        let transportEl = document.getElementById('enroll-transport');
        if (!transportEl) {
            transportEl = document.createElement('div');
            transportEl.id = 'enroll-transport';
            transportEl.className = 'text-[11px] font-semibold mt-1 text-slate-400';
            document.getElementById('enroll-person')?.parentNode?.appendChild(transportEl);
        }
        transportEl.textContent = 'Détection de la borne…';
        transportEl.className = 'text-[11px] font-semibold mt-1 text-slate-400';
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
        // Séquencement manuel : capture 1, PAUSE, puis clic opérateur pour
        // la capture 2 (état réinitialisé à chaque ouverture du modal).
        let enrollPhase = 'capture1';
        let pendingSlot = null;
        if (btn) {
            if (enrollBtnLabel1) btn.innerHTML = enrollBtnLabel1;
            else enrollBtnLabel1 = btn.innerHTML;
        }
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                // Annule la capture en cours (la requête Python côté serveur
                // termine son timeout seule ; le slot sera réutilisé).
                if (enrollAbort) enrollAbort.abort();
                // Libère le terminal resté en mode enrolement (capture 1
                // validée puis abandon, ou capture encore active côté
                // serveur) — best-effort, silencieux.
                if (api.getEnrollTransport && api.getEnrollTransport() === 'remote') {
                    daemonLocalCall('set-mode', { mode: 'pointage' }, 5000, null).catch(() => {});
                } else if (api.enrollCancel) {
                    api.enrollCancel().catch(() => {});
                }
                enrollLiveStopPoll();
                setEnrollHint('Enrôlement annulé.');
                if (step) step.textContent = 'Enrôlement annulé — cliquez pour recommencer.';
                setEnrollStep(1, 'idle'); setEnrollStep(2, 'idle');
                enrollPhase = 'capture1'; pendingSlot = null;
                window.__enrollNeedsRelease = false;
                if (btn && enrollBtnLabel1) btn.innerHTML = enrollBtnLabel1;
                showCancel(false);
                if (btn) btn.disabled = false;
                flash('Enrôlement annulé.', 'info');
            };
        }
        if (btn) {
            const btnLabel2 = '<span class="material-symbols-outlined text-[18px]">touch_app</span> Lancer la capture 2';
            // Phase 2 manuelle : mêmes états/erreurs que l'ancien enchaînement
            // automatique, mais déclenchée par le clic opérateur (pas de
            // compte à rebours : le daemon gère sa vraie attente du doigt).
            const runCapture2 = async () => {
                btn.disabled = true;
                enrollAbort = new AbortController();
                const signal2 = enrollAbort.signal;
                showCancel(true);
                if (step) step.textContent = 'Capture 2/2 : posez le doigt sur le capteur…';
                setEnrollHint('En attente du doigt (capture 2)…');
                const r2 = await enrollWithAutoRetry(() => api.enrollStep2(target.id, pendingSlot, signal2), (r) => r && r.aborted);
                if (r2 && r2.aborted) {
                    showCancel(false);
                    if (btn) btn.disabled = false;
                    return;
                }
                showCancel(false);
                if (!r2.ok) {
                    if (icon) {
                        icon.className = 'w-24 h-24 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-lg transition-colors duration-300';
                        icon.innerHTML = '<span class="material-symbols-outlined text-[48px]">error</span>';
                    }
                    if (step) step.textContent = r2.message;
                    setEnrollStep(2, 'idle'); setEnrollHint('Échec capture 2 — reprends à la capture 1.');
                    enrollPhase = 'capture1'; pendingSlot = null;
                    window.__enrollNeedsRelease = false;
                    if (enrollBtnLabel1) btn.innerHTML = enrollBtnLabel1;
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

                enrollLiveStopPoll();
                window.__enrollNeedsRelease = false;

                setTimeout(() => {
                    closeModal('modal-enroll');
                    renderCapteur(true);
                }, 1200);
            };
            btn.onclick = async () => {
                // Phase 2 : la capture 1 est validée, l'opérateur a cliqué
                // « Lancer la capture 2 » — on réutilise le transport et le
                // slot déjà réservé, sans re-sonde.
                if (enrollPhase === 'capture2' && pendingSlot) { await runCapture2(); return; }
                btn.disabled = true;
                // Choix du transport : daemon localhost joignable (borne sur ce
                // PC, même depuis un site HTTPS) → captures locales + commit
                // serveur ; sinon flux serveur historique.
                let useRemote = false;
                try { useRemote = await probeLocalDaemon(); } catch { useRemote = false; }
                api.setEnrollTransport(useRemote ? 'remote' : 'server');
                const tEl = document.getElementById('enroll-transport');
                if (tEl) {
                    tEl.textContent = useRemote
                        ? 'Borne locale détectée — captures sur ce PC.'
                        : 'Borne distante — captures via le serveur.';
                    tEl.className = 'text-[11px] font-semibold mt-1 ' + (useRemote ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400');
                }
                enrollAbort = new AbortController();
                const signal = enrollAbort.signal;
                window.__enrollNeedsRelease = true;
                showCancel(true);
                enrollLiveStartPoll();
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
                let timeout1 = 15; // affiché pendant la requête (r1 pas encore défini ici — TDZ sinon)
                let countdown1 = timeout1;
                const countdownInterval1 = setInterval(() => {
                    countdown1--;
                    if (countdown1 >= 0) {
                        setEnrollHint(`En attente du doigt (capture 1)… ${countdown1}s`);
                    } else {
                        clearInterval(countdownInterval1);
                    }
                }, 1000);
                const r1 = await enrollWithAutoRetry(() => api.enrollStep1(target.id, signal), wasAborted);
                clearInterval(countdownInterval1);
                if (wasAborted(r1)) { showAbort(); return; }
                if (!r1.ok) {
                    if (icon) {
                        icon.className = 'w-24 h-24 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-lg transition-colors duration-300';
                        icon.innerHTML = '<span class="material-symbols-outlined text-[48px]">error</span>';
                    }
                    if (step) step.textContent = r1.message;
                    setEnrollStep(1, 'idle'); setEnrollHint('Échec capture 1 — réessaie.');
                    window.__enrollNeedsRelease = false;
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
                // ── PAUSE MANUELLE : la capture 2 ne démarre que sur clic
                // opérateur (plus d'enchaînement automatique).
                pendingSlot = r1.slot;
                enrollPhase = 'capture2';
                if (step) step.textContent = 'Capture 1 validée ✓ — cliquez sur « Lancer la capture 2 ».';
                setEnrollHint('Retirez le doigt, puis lancez la capture 2 quand prêt.');
                btn.innerHTML = btnLabel2;
                btn.disabled = false;
                showCancel(true); // Annuler reste possible pendant l'attente
                return;
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
if (!window._capteurGlobalClickAttached) {
    window._capteurGlobalClickAttached = true;
    document.addEventListener('click', (e) => {
        if (document.body.getAttribute('data-page') !== 'capteur') return;
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
                            await renderCapteur(true);
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
    window._lastInitializedModule = 'capteur';
    const user = api.getCurrentUser();
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'super_admin') {
        flash('Accès réservé aux administrateurs.', 'danger');
        setTimeout(() => { window.location.href = 'dashboard.php'; }, 1500);
        return;
    }

    await renderCapteur(true);

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
    initReconcile();
    initWatchToggle();
    enforceWatchForMode(getCurrentMode());

    // Panneau sélection employé
    initEnrollTargetPanel();

    const searchInput = document.getElementById('top-search');
    if (searchInput) searchInput.oninput = () => renderCapteur(false);
    const filterSlot = document.getElementById('filter-slot');
    if (filterSlot) filterSlot.onchange = () => renderCapteur(false);
    const filterEmp = document.getElementById('filter-emp');
    if (filterEmp) filterEmp.onchange = () => renderCapteur(false);

    // Re-rendu du tableau au changement de mode (le bouton Enrôler suit le mode).
    document.addEventListener('mada:modeChanged', () => renderCapteur(false));

    // Purge totale biométrie (Super Admin uniquement).
    const purgeBtn = document.getElementById('btn-purge-bio');
    if (purgeBtn) {
        const isSuper = user && (user.role === 'super_admin' || user.role === 'admin_systeme');
        purgeBtn.classList.toggle('hidden', !isSuper);
        if (isSuper) {
            purgeBtn.onclick = () => {
                const n = allUsers.filter(u => u.empreinte).length;
                if (n === 0) { flash('Aucune empreinte à supprimer.', 'info'); return; }
                showConfirmModal({
                    title: 'Vider TOUTE la biométrie ?',
                    message: `${n} empreinte(s) seront supprimées du CAPTEUR (bibliothèque R307 complète) ET de la base de données (slots + gabarits chiffrés). Action irréversible — tous les employés devront être ré-enrôlés.`,
                    type: 'danger',
                    confirmText: 'Tout supprimer',
                    cancelText: 'Annuler',
                    onConfirm: async () => {
                        purgeBtn.disabled = true;
                        try {
                            const res = await api.deleteAllFingerprints();
                            flash(res.message || (res.ok ? 'Purge effectuée.' : 'Échec de la purge.'), res.ok ? (res.partial ? 'warning' : 'success') : 'danger');
                            if (res.ok) { syncModeButtonsWithCapteur(); await renderCapteur(true); }
                        } finally { purgeBtn.disabled = false; }
                    }
                });
            };
        }
    }
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['capteur'] = initPage;
window.initPage = initPage;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else { initPage(); }
})();
