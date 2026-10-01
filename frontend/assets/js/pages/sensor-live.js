// ============================================================
// WIDGET TEMPS RÉEL — Surveillance du capteur (fix haut droite)
// Apparaît sur toutes les pages (hors login) dès que la
// surveillance est active en mode pointage. Fermeture et
// minimisation mémorisées en localStorage.
// Alimenté par sensor_status.php : watching + last_result du
// daemon r307_service.py (seq monotone, nom, type, heure,
// retry_after). Latence d'affichage ≤ 2 s après la capture.
// ============================================================

const SL_MIN_KEY = 'mada-sensorlive-min';
let slTimer = null;
let slLastSeq = null;
let slLog = [];
let slScanRevert = null;
let slSessionClosed = false;

/** Réaffiche le widget (appelé quand on (ré)active la surveillance). */
function sensorLiveReopen() {
    slSessionClosed = false;
    const el = document.getElementById('sensor-live');
    if (el) el.classList.remove('hidden-widget');
    if (!slTimer && typeof initSensorLive === 'function') initSensorLive();
}
window.sensorLiveReopen = sensorLiveReopen;

function sensorLiveBuild() {
    if (document.getElementById('sensor-live')) return document.getElementById('sensor-live');
    const el = document.createElement('div');
    el.id = 'sensor-live';
    el.className = 'sensor-live hidden-widget';
    el.innerHTML = `
        <div class="sl-head">
            <span class="sl-dot"></span>
            <span class="sl-title">Surveillance capteur</span>
            <button class="sl-headbtn" id="sl-btn-min" title="Réduire / développer" type="button">
                <span class="material-symbols-outlined text-[16px]" id="sl-min-icon">expand_less</span>
            </button>
            <button class="sl-headbtn" id="sl-btn-close" title="Masquer (réactivable depuis la page Capteur)" type="button">
                <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
        </div>
        <div class="sl-body">
            <div class="sl-state">
                <span class="material-symbols-outlined" id="sl-icon">radar</span>
                <span id="sl-state-text">Initialisation…</span>
            </div>
            <div class="sl-sub" id="sl-sub"></div>
        </div>
        <div class="sl-footer">
            <div class="sl-log" id="sl-log"></div>
        </div>`;
    document.body.appendChild(el);
    document.getElementById('sl-btn-min').addEventListener('click', () => {
        const min = !el.classList.contains('minimized');
        el.classList.toggle('minimized', min);
        try { storage.set(SL_MIN_KEY, min ? '1' : '0'); } catch (e) {}
        const mi = document.getElementById('sl-min-icon');
        if (mi) mi.textContent = min ? 'expand_more' : 'expand_less';
    });
    document.getElementById('sl-btn-close').addEventListener('click', () => {
        // Masque pour la session en cours — le widget réapparaît à la
        // prochaine activation de la surveillance (ou après rechargement).
        slSessionClosed = true;
        el.classList.add('hidden-widget');
        if (slTimer) { clearInterval(slTimer); slTimer = null; }
    });
    return el;
}

/** Machine à états visuelle : scanning | detecting | success | error */
function sensorLiveSet(state, iconName, text, subHtml) {
    const el = document.getElementById('sensor-live');
    if (!el) return;
    ['scanning', 'detecting', 'success', 'error'].forEach(c => el.classList.remove(c));
    if (state) el.classList.add(state);
    const stEl = el.querySelector('#sl-state-text');
    const icEl = el.querySelector('#sl-icon');
    const subEl = el.querySelector('#sl-sub');
    if (!stEl || !icEl) return;
    if (stEl.textContent !== text) {
        stEl.textContent = text;
        icEl.innerHTML = '<span class="material-symbols-outlined">' + iconName + '</span>';
        icEl.classList.remove('sl-flip');
        void icEl.offsetWidth; // relance l'animation flip
        icEl.classList.add('sl-flip');
    }
    if (subEl) subEl.innerHTML = subHtml || '';
}

/** Mini-historique : 3 dernières détections, horodatées */
function sensorLivePushLog(kind, iconName, label, timeStr) {
    slLog.unshift({ kind, iconName, label, timeStr });
    slLog = slLog.slice(0, 3);
    const box = document.getElementById('sl-log');
    if (!box) return;
    box.innerHTML = slLog.map(it =>
        '<div class="sl-log-item ' + it.kind + '">' +
            '<span class="material-symbols-outlined">' + it.iconName + '</span>' +
            '<span>' + escapeHtml(it.label) + '</span>' +
            '<time>' + escapeHtml(it.timeStr || '') + '</time>' +
        '</div>').join('');
}

/** Retour automatique à « Scrutation » après un événement transitoire */
function sensorLiveRevertLater(delayMs) {
    if (slScanRevert) clearTimeout(slScanRevert);
    slScanRevert = setTimeout(() => {
        sensorLiveSet('scanning', 'sensors', 'Scrutation active…',
            'Capteur armé — posez un doigt');
        slScanRevert = null;
    }, delayMs);
}

/** Applique l'état reçu de sensor_status.php */
function sensorLiveApply(data) {
    const el = document.getElementById('sensor-live');
    if (!el) return;
    const watching = !!(data && data.watching);
    const last = (data && data.last_result) || null;
    const seq = last ? (last.seq || 0) : 0;

    // ── Surveillance inactive / en pause → widget masqué ──
    if (!watching) {
        el.classList.add('hidden-widget');
        return;
    }
    // Surveillance active → le widget s'affiche (animation d'entrée)
    if (el.classList.contains('hidden-widget')) {
        el.classList.remove('hidden-widget');
        el.classList.remove('sl-enter'); void el.offsetWidth; el.classList.add('sl-enter');
    }

    // ── État de base : la série de captures tourne ──
    sensorLiveSet('scanning', 'sensors', 'Scrutation active…',
        'Capteur armé — posez un doigt (empreintes : <strong>'
        + (data.count != null ? data.count : '–') + '</strong>)');

    // ── Nouvel événement ? (seq changé depuis le dernier poll) ──
    if (last && seq && seq !== slLastSeq) {
        const isNew = slLastSeq !== null; // au 1er poll, ne pas rejouer l'ancien
        slLastSeq = seq;
        if (isNew) {
            const http = last.http || 0;
            let kind = 'info', iconName = 'fingerprint',
                label = last.message || 'Doigt détecté';
            if (http === 200) {
                // Capture validée → pointage enregistré (nom + type + heure renvoyés par la borne)
                kind = 'ok'; iconName = 'check_circle';
                label = (last.nom ? last.nom : 'Pointage')
                    + (last.type ? ' — ' + last.type : '')
                    + (last.heure ? ' à ' + last.heure : '');
                sensorLiveSet('success', 'check_circle', 'Pointage validé ✓',
                    '<strong>' + escapeHtml(last.nom || 'Employé') + '</strong>'
                    + (last.type ? ' — ' + escapeHtml(last.type) : '')
                    + (last.heure ? ' à <strong>' + escapeHtml(last.heure) + '</strong>' : ''));
                el.classList.remove('sl-pop'); void el.offsetWidth; el.classList.add('sl-pop');
                sensorLiveRevertLater(3500);
            } else if (http === 409) {
                // Anti-double : déjà pointé récemment
                label = 'Anti-double — retentez dans ' + (last.retry_after || '?') + ' s';
                sensorLiveSet('detecting', 'timer', 'Déjà pointé récemment',
                    'Anti-double actif — nouveau scan possible dans '
                    + (last.retry_after || '?') + ' s');
                sensorLiveRevertLater(3500);
            } else if (http === 404 || http === 403) {
                // Doigt posé mais aucune correspondance (ou empreinte révoquée)
                kind = 'err'; iconName = 'do_not_touch';
                label = last.message || 'Empreinte non reconnue';
                sensorLiveSet('detecting', 'do_not_touch', 'Empreinte inconnue',
                    'Doigt détecté mais aucune correspondance (slot '
                    + (last.page_id != null ? last.page_id : '?') + ')');
                sensorLiveRevertLater(3500);
            } else if (http === 0) {
                // Détection faite mais serveur injoignable
                kind = 'err'; iconName = 'cloud_off';
                label = 'Serveur injoignable';
                sensorLiveSet('error', 'cloud_off', 'Erreur d’envoi',
                    'Détection faite mais le serveur n’a pas répondu');
                sensorLiveRevertLater(4000);
            }
            const now = new Date();
            sensorLivePushLog(kind, iconName, label,
                now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
    } else if (!last || !seq) {
        slLastSeq = null;
    }
}

/** Init : injection + polling 1 s. Jamais sur la page de connexion. */
// Transport widget : si le daemon tourne sur CE pc (borne locale, même
// depuis HTTPS), on lit son /status en direct — il contient watching +
// last_result/seq que la branche « borne » de sensor_status.php ne
// transporte pas. Sinon repli serveur (comportement historique).
let slUseLocal = false;
let slProbeAt = 0;
async function slRefreshTransport() {
    if (Date.now() - slProbeAt < 30000) return;
    slProbeAt = Date.now();
    try {
        slUseLocal = (typeof probeLocalDaemon === 'function') && await probeLocalDaemon();
    } catch { slUseLocal = false; }
}
function initSensorLive() {
    const page = document.body.dataset.page || '';
    if (!page || page === 'login') return;
    if (slSessionClosed) return;
    const el = sensorLiveBuild();
    let min = false;
    try { min = storage.get(SL_MIN_KEY) === '1'; } catch (e) {}
    if (min) {
        el.classList.add('minimized');
        const mi = document.getElementById('sl-min-icon');
        if (mi) mi.textContent = 'expand_more';
    }
    async function tick() {
        try {
            await slRefreshTransport();
            // Borne locale : /status direct (watching + last_result/seq).
            if (slUseLocal && typeof DAEMON_LOCAL_URL === 'string') {
                try {
                    const ctrl = new AbortController();
                    const t = setTimeout(() => ctrl.abort(), 2000);
                    const res = await fetch(DAEMON_LOCAL_URL + '/status', { signal: ctrl.signal });
                    clearTimeout(t);
                    const data = await res.json();
                    if (data && data.ok !== false && !slSessionClosed) {
                        sensorLiveApply(data);
                        return;
                    }
                } catch (e) { slUseLocal = false; /* repli serveur ci-dessous */ }
            }
            const res = await fetch(getApiEndpoint('sensor_status.php'),
                { credentials: 'include', cache: 'no-store' });
            const data = await res.json();
            if (data && data.ok !== false && !slSessionClosed) {
                sensorLiveApply(data);
            }
        } catch (e) { /* serveur momentanément injoignable : on réessaie */ }
    }
    tick();
    if (slTimer) clearInterval(slTimer);
    slTimer = setInterval(tick, 1000);
}

// ============================================================
// Enrôlement temps réel : bandeau d'état capteur dans le modal
// + relance automatique des captures jusqu'à capture réussie.
// Poll léger (sensor_status action=enroll_status) toutes les 1 s
// pendant que le modal est ouvert — aucune écriture capteur.
// ============================================================
const EL_HIDDEN = 'hidden';
let elPollTimer = null;

function enrollLiveEnsure() {
    let el = document.getElementById('enroll-live');
    if (!el) {
        el = document.createElement('div');
        el.id = 'enroll-live';
        el.className = 'enroll-live idle hidden';
        el.setAttribute('aria-live', 'polite');
        el.innerHTML = '<span class="el-pulse-icon material-symbols-outlined">fingerprint</span>' +
            '<span class="el-dot"></span>' +
            '<span class="el-text">Capteur prêt — posez le doigt pour démarrer les captures.</span>' +
            '<span class="el-count">0</span>';
        const modal = document.getElementById('modal-enroll');
        const host = modal ? modal.querySelector('.relative.flex.flex-col.items-center') : null;
        if (host) host.appendChild(el);
    }
    return el;
}

// state : 'idle' | 'waiting' | 'captured' | 'error' | 'offline'
function enrollLiveSet(state, text, count) {
    const el = enrollLiveEnsure();
    el.className = 'enroll-live ' + (state || 'idle');
    const icon = el.querySelector('.el-pulse-icon');
    if (icon) icon.textContent = state === 'offline' ? 'sensor_off' : (state === 'error' ? 'error' : 'fingerprint');
    const txt = el.querySelector('.el-text');
    if (txt && text) txt.textContent = text;
    const cnt = el.querySelector('.el-count');
    if (cnt) cnt.textContent = count > 0 ? String(count) : '';
    el.classList.remove(EL_HIDDEN);
}

function enrollLiveHide() {
    const el = document.getElementById('enroll-live');
    if (el) el.classList.add(EL_HIDDEN);
}

async function enrollLivePollTick() {
    const el = document.getElementById('enroll-live');
    if (!el || el.classList.contains(EL_HIDDEN)) return;
    const modal = document.getElementById('modal-enroll');
    if (!modal || modal.classList.contains(EL_HIDDEN)) { enrollLiveStopPoll(); enrollLiveHide(); return; }
    try {
        // Borne distante : état temps réel direct du daemon local (même format
        // adapté : active/step/captures_ok → active/step/capture_count).
        if (typeof api !== 'undefined' && api.getEnrollTransport && api.getEnrollTransport() === 'remote') {
            const d = await daemonLocalCall('enroll_status', {}, 4000, null).catch(() => null);
            if (!d) { enrollLiveSet('offline', 'Borne locale injoignable — état momentanément indisponible.', 0); return; }
            const n = (typeof d.captures_ok === 'number') ? d.captures_ok : 0;
            if (!d.active) { enrollLiveHide(); return; }
            if (d.error) { enrollLiveSet('error', d.error, n); return; }
            enrollLiveSet('waiting', d.message || ('Capteur actif — posez le doigt (capture ' + (d.step || '?') + '/2)…'), n);
            return;
        }
        const csrf = await fetchCsrf();
        const res = await fetch(getApiEndpoint('biometric.php'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
            body: JSON.stringify({ action: 'enroll_status' }),
            credentials: 'include'
        });
        const j = await res.json();
        if (!j || j.ok === false) { enrollLiveSet('offline', 'Service capteur injoignable — état momentanément indisponible.', 0); return; }
        if (!j.active) { enrollLiveHide(); return; }
        const step = (typeof j.step === 'number') ? j.step : null;
        const stepLabel = step ? ('capture ' + step + '/2') : 'captures';
        const n = (typeof j.capture_count === 'number') ? j.capture_count : 0;
        if (j.capturing) {
            enrollLiveSet('waiting', 'Capteur actif — en attente du doigt (' + stepLabel + ')…', n);
        } else if (j.state === 'ok') {
            enrollLiveSet('captured', 'Capture validée ✓ — retirez puis reposez le doigt.', n);
        } else if (j.state === 'error') {
            enrollLiveSet('error', j.message || 'Échec de la capture — nouvelle tentative en cours…', n);
        } else {
            enrollLiveSet('waiting', 'Capteur actif — posez le doigt (' + stepLabel + ')…', n);
        }
    } catch (e) {
        enrollLiveSet('offline', 'Service capteur injoignable — état momentanément indisponible.', 0);
    }
}

function enrollLiveStartPoll() {
    enrollLiveEnsure();
    if (elPollTimer) clearInterval(elPollTimer);
    enrollLivePollTick();
    elPollTimer = setInterval(enrollLivePollTick, 1000);
}

function enrollLiveStopPoll() {
    if (elPollTimer) { clearInterval(elPollTimer); elPollTimer = null; }
}

// Arrêt du poll dès que le modal est refermé (bouton ✕ / data-close).
document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-close="modal-enroll"]')) return;
    enrollLiveStopPoll();
    enrollLiveHide();
});

// ============================================================
// Relance automatique des captures : la promesse d'un appel
// d'enrôlement est rejouée tant qu'aucun doigt n'est détecté
// (abandon conservé), puis le résultat réel est retourné.
// ============================================================
async function enrollWithAutoRetry(callFn, wasAborted) {
    for (let attempt = 0; ; attempt++) {
        const r = await callFn();
        if (wasAborted(r)) return r;
        if (r && r.ok) return r;
        if (attempt >= MAX_ENROLL_RETRIES || !isTransientEnrollFailure(r)) return r;
        enrollLiveSet('error', 'Aucune capture — nouvelle tentative automatique (' + (attempt + 2) + ')…', 0);
        await new Promise((ok) => setTimeout(ok, 600));
    }
}

// Échec transient (pas de doigt posé / attente expirée) → relance auto.
// Erreur série ou message métier (employé, slot…) → échec réel, on stoppe.
function isTransientEnrollFailure(r) {
    if (!r || r.ok) return false;
    const m = String(r.message || '');
    if (/erreur s[ée]rie/i.test(m)) return false;
    return /attente interrompue|aucune empreinte|aucune capture|non d[ée]tect/i.test(m);
}
const MAX_ENROLL_RETRIES = 10;
