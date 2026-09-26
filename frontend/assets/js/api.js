// ============================================================
// Client API backend XAMPP / MySQL - P.Biometrique
// ============================================================

function getApiEndpoint(path) {
    if (window.location.protocol === 'file:') {
        return '../api/' + path;
    }
    const pathParts = window.location.pathname.split('/');
    const frontendIndex = pathParts.indexOf('frontend');
    if (frontendIndex !== -1) {
        const root = pathParts.slice(0, frontendIndex).join('/');
        return (root ? root : '') + '/api/' + path;
    }
    return '../api/' + path;
}

// Cache du jeton CSRF (valable toute la session)
let _csrfToken = null;
// Cache léger Supabase (évite 3 requêtes pooler à chaque filtre)
const _cache = {};
function _getCache(k, ttlMs) {
    const v = _cache[k];
    if (v && Date.now() - v.t < ttlMs) return v.d;
    return null;
}
function _setCache(k, d) { _cache[k] = { d, t: Date.now() }; }
function _clearCache(k) { if (k) delete _cache[k]; else Object.keys(_cache).forEach(x=>delete _cache[x]); }

function handleUnauthorized(res) {
    if (res && res.status === 401) {
        let hadOwner = false;
        try { hadOwner = !!sessionStorage.getItem('mada_tab_owner'); } catch {}
        try { sessionStorage.clear(); } catch {}
        try { localStorage.removeItem('mada_user_session'); } catch {}
        storage.remove(SESSION_KEY);
        // Si l'onglet avait un compte : expiration OU compte changé dans un
        // autre onglet (le login régénère l'ID et détruit l'ancienne session).
        // On laisse un mot explicatif affiché sur la page de connexion.
        if (hadOwner) {
            try { sessionStorage.setItem('mada_auth_note', 'Session expirée ou compte changé dans un autre onglet. Reconnectez-vous.'); } catch {}
        }
        // évite boucle si déjà sur login
        if (!window.location.pathname.endsWith('login.php') && !window.location.pathname.endsWith('login.html')) {
            window.location.replace('login.php?v=' + Date.now());
        }
        throw new Error('Session expirée');
    }
}

// Compte changé dans un autre onglet : le cookie PHPSESSID (partagé par tout
// le navigateur) pointe désormais vers un autre utilisateur. Re-login propre
// avec message explicite au lieu de 401 en cascade + écran « instable ».
function handleAccountSwitch(serverMatricule) {
    try { sessionStorage.clear(); } catch {}
    try { localStorage.removeItem('mada_user_session'); } catch {}
    try { storage.remove(SESSION_KEY); } catch {}
    try { sessionStorage.setItem('mada_auth_note', 'Compte changé dans un autre onglet (' + serverMatricule + '). Reconnectez-vous pour continuer.'); } catch {}
    _csrfToken = null;
    try { Object.keys(_cache).forEach(k => delete _cache[k]); } catch {}
    if (!window.location.pathname.endsWith('login.php') && !window.location.pathname.endsWith('login.html')) {
        window.location.replace('login.php?v=' + Date.now());
    }
}

const api = {
    // --- Jeton CSRF (récupéré une fois, mis en cache) ---
    async getCsrfToken() {
        if (_csrfToken) return _csrfToken;
        try {
            const res = await fetch(getApiEndpoint('csrf.php'), { credentials: 'include' });
            const data = await res.json();
            if (data.ok && data.csrf_token) {
                _csrfToken = data.csrf_token;
                return _csrfToken;
            }
        } catch (e) {
            console.warn('Impossible de récupérer le jeton CSRF:', e);
        }
        return null;
    },

    // --- Authentification via MySQL XAMPP ---
    async login(matricule, password) {
        try {
            const res = await fetch(getApiEndpoint('login.php'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matricule, password }),
                credentials: 'include'
            });

            const data = await res.json();
            if (data.ok && data.user) {
                const userJson = JSON.stringify(data.user);
                sessionStorage.setItem('mada_user_session', userJson);
                storage.set(SESSION_KEY, userJson);
                // Propriétaire de CET onglet (sessionStorage = par onglet) :
                // permet de détecter un changement de compte depuis un autre onglet.
                try {
                    sessionStorage.setItem('mada_tab_owner', data.user.matricule || '');
                    sessionStorage.removeItem('mada_auth_note');
                } catch {}
            }
            return data;
        } catch (e) {
            console.error('Erreur connexion backend:', e);
            return { ok: false, message: 'Impossible de contacter le serveur MySQL sur XAMPP.' };
        }
    },

    async logout() {
        try {
            // M3 : logout protégé CSRF comme les autres POST (plus d'exemption).
            // M4 : _csrfToken purgé (aucun token d'ancienne session ne survit).
            const csrf = await this.getCsrfToken();
            await fetch(getApiEndpoint('logout.php'), {
                method: 'POST', credentials: 'include', cache: 'no-store',
                headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
                body: JSON.stringify({})
            });
        } catch (e) {}
        _csrfToken = null;
        try { sessionStorage.clear(); } catch {}
        try { localStorage.removeItem('mada_user_session'); } catch {}
        storage.remove(SESSION_KEY);
        // vide le cache Supabase
        try { Object.keys(_cache).forEach(k=>delete _cache[k]); } catch {}
        // force rechargement sans cache
        window.location.replace('login.php?v=' + Date.now());
    },

    async verifyAuth() {
        // Vérifie la session serveur sans déconnecter sur erreur réseau
        try {
            const res = await fetch(getApiEndpoint('me.php'), { credentials: 'include', cache: 'no-store' });
            if (res.status === 401) return null; // non authentifié -> pas de throw, le caller décide
            const data = await res.json();
            if (data.ok && data.user) {
                // Changement de compte depuis un autre onglet ? Re-login propre.
                try {
                    const owner = sessionStorage.getItem('mada_tab_owner');
                    if (owner && data.user.matricule && owner !== data.user.matricule) {
                        handleAccountSwitch(data.user.matricule);
                        return null;
                    }
                } catch {}
                return data.user;
            }
        } catch (e) {
            // Erreur réseau -> on NE retourne PAS l'utilisateur local
            // pour que le caller sache que la session n'est pas vérifiée
            // (évite les boucles de redirection infinies)
        }
        return null;
    },

    getCurrentUser() {
        try {
            const raw = sessionStorage.getItem('mada_user_session') || storage.get(SESSION_KEY);
            if (raw) {
                const u = JSON.parse(raw);
                // ne jamais retourner de faux utilisateur après logout
                if (u && u.id) return u;
            }
        } catch (e) {}
        return null;
    },

    async changePassword(currentPassword, newPassword) {
        try {
            const csrf = await this.getCsrfToken();
            const res = await fetch(getApiEndpoint('change_password.php'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            return await res.json();
        } catch (e) {
            return { ok: false, message: 'Erreur lors du changement de mot de passe.' };
        }
    },

    // --- Tableau de bord (1 fetch dashboard.php, partagé stats+activité) ---
    // Cache PAR PÉRIODE : les pills Aujourd'hui/Semaine/Mois rechargent de
    // vraies fenêtres distinctes, sans jamais mélanger les données.
    async _getDashboardBundle(period = 'today') {
        const key = 'dashAll_' + period;
        const c = _getCache(key, 15000); if (c) return c;
        const res = await fetch(getApiEndpoint('dashboard.php') + '?period=' + encodeURIComponent(period), { credentials: 'include' });
        if (res.status === 401) handleUnauthorized(res);
        const data = await res.json();
        if (data.ok) { _setCache(key, data); return data; }
        throw new Error(data.message || 'Dashboard indisponible');
    },

    async getDashboardStats(period = 'today') {
        try {
            const data = await this._getDashboardBundle(period);
            if (data.stats) return data.stats;
        } catch (e) { if (e.message==='Session expirée') throw e; }
        return { total: 0, entrees: 0, sorties: 0, retards: 0, absents: 0, evenements: 0 };
    },

    async getActivity(period = 'today') {
        try {
            const data = await this._getDashboardBundle(period);
            if (data.activite) return data.activite;
        } catch (e) { if (e.message==='Session expirée') throw e; }
        return [
            { heure: '06h', count: 0, height: 0 },
            { heure: '07h', count: 0, height: 0 },
            { heure: '08h', count: 0, height: 0 },
            { heure: '09h', count: 0, height: 0 },
            { heure: '10h', count: 0, height: 0 }
        ];
    },

    async getTodayPointages(force=false) {
        if (!force) { const c = _getCache('pointages', 10000); if (c) return c; }
        try {
            // today=1 : seul le jour courant, pas tout l'historique (PERF dashboard)
            const res = await fetch(getApiEndpoint('pointages.php?today=1'), { credentials: 'include' });
            if (res.status === 401) handleUnauthorized(res);
            const data = await res.json();
            if (data.ok && data.pointages) { _setCache('pointages', data.pointages); return data.pointages; }
        } catch (e) { if (e.message==='Session expirée') throw e; }
        return [];
    },

    // --- Graphiques du dashboard (trends + heures) : cache + dédup en vol ---
    // PERF : mêmes mécaniques que _getDashboardBundle — un re-rendu (bascule
    // sombre/clair, retour sur l'onglet) relit le cache au lieu de re-mêcher
    // Supabase (~1s/aller-retour depuis MG), et deux appels simultanés ne
    // déclenchent qu'UN seul aller-retour réseau.
    async _getChartBundle() {
        const c = _getCache('dashCharts', 15000); if (c) return c;
        if (!_cache._chartsFlight) {
            _cache._chartsFlight = (async () => {
                const url = getApiEndpoint('dashboard_charts.php');
                const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
                if (res.status === 401) handleUnauthorized(res);
                const data = await res.json();
                if (!data.ok) throw new Error(data.message || 'Graphiques indisponibles');
                return data;
            })().finally(() => { delete _cache._chartsFlight; });
        }
        return _cache._chartsFlight;
    },

    async getTrends(view = '7d') {
        try {
            const data = await this._getChartBundle();
            if (view === '30d') return { labels: data.labels_30d, presents: data.presents_30d, retards: data.retards_30d, absents: data.absents_30d };
            return { labels: data.labels_7d, presents: data.presents_7d, retards: data.retards_7d, absents: data.absents_7d };
        } catch (e) { if (e.message==='Session expirée') throw e; }
        return null;
    },

    async getHoursWorked() {
        try {
            const data = await this._getChartBundle();
            return { departements: data.departements, heures: data.heures, moyenne_globale: data.moyenne_globale };
        } catch (e) { if (e.message==='Session expirée') throw e; }
        return null;
    },

    // PERF : lectures SYNCHRONES du cache (aucun fetch) pour les re-rendus
    // immédiats (bascule sombre/clair, retour d'onglet, changement de vue déjà
    // chargé). Retourne null si le cache est absent/expiré — l'appelant
    // repasse alors par getTrends()/getHoursWorked().
    peekTrends(view = '7d') {
        const c = _getCache('dashCharts', 15000);
        if (!c) return null;
        if (view === '30d') return { labels: c.labels_30d, presents: c.presents_30d, retards: c.retards_30d, absents: c.absents_30d };
        return { labels: c.labels_7d, presents: c.presents_7d, retards: c.retards_7d, absents: c.absents_7d };
    },

    peekHoursWorked() {
        const c = _getCache('dashCharts', 15000);
        if (!c) return null;
        return { departements: c.departements, heures: c.heures, moyenne_globale: c.moyenne_globale };
    },

    // Invalide le bundle graphiques (mutations pointages/employés)
    clearChartsCache() { _clearCache('dashCharts'); },

    // Historique complet (historique.js, pointage.js) — cache 30s, liste entière.
    async getAllPointages(force=false) {
        if (!force) { const c = _getCache('pointagesAll', 30000); if (c) return c; }
        try {
            const res = await fetch(getApiEndpoint('pointages.php'), { credentials: 'include' });
            if (res.status === 401) handleUnauthorized(res);
            const data = await res.json();
            if (data.ok && data.pointages) { _setCache('pointagesAll', data.pointages); return data.pointages; }
        } catch (e) { if (e.message==='Session expirée') throw e; }
        return [];
    },

    async addPointage(data) {
        try {
            const csrf = await this.getCsrfToken();
            const res = await fetch(getApiEndpoint('pointages.php'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
                body: JSON.stringify(data),
                credentials: 'include'
            });
            const j = await res.json(); if (j.ok) { _clearCache('pointages'); _clearCache('pointagesAll'); _clearCache('dashAll_today'); _clearCache('dashAll_7d'); _clearCache('dashAll_30d'); _clearCache('dashCharts'); }
            return j;
        } catch (e) {
            return { ok: false, message: 'Erreur lors de l\'ajout du pointage.' };
        }
    },

    async updatePointage(id, data) {
        try {
            const csrf = await this.getCsrfToken();
            const res = await fetch(getApiEndpoint('pointages.php'), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
                body: JSON.stringify({ id, ...data }),
                credentials: 'include'
            });
            const j = await res.json(); if (j.ok) { _clearCache('pointages'); _clearCache('pointagesAll'); _clearCache('dashAll_today'); _clearCache('dashAll_7d'); _clearCache('dashAll_30d'); _clearCache('dashCharts'); }
            return j;
        } catch (e) {
            return { ok: false, message: 'Erreur lors de la mise à jour du pointage.' };
        }
    },

    async deletePointage(id) {
        try {
            const csrf = await this.getCsrfToken();
            const res = await fetch(getApiEndpoint('pointages.php'), {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
                body: JSON.stringify({ id }),
                credentials: 'include'
            });
            const j = await res.json(); if (j.ok) { _clearCache('pointages'); _clearCache('pointagesAll'); _clearCache('dashAll_today'); _clearCache('dashAll_7d'); _clearCache('dashAll_30d'); _clearCache('dashCharts'); }
            return j;
        } catch (e) {
            return { ok: false, message: 'Erreur lors de la suppression du pointage.' };
        }
    },

    // Totaux d'heures de travail du mois (table heures_mensuelles)
    async getPointageTotals(mois) {
        try {
            const q = mois ? ('&mois=' + encodeURIComponent(mois)) : '';
            const res = await fetch(getApiEndpoint('pointages.php') + '?totals=1' + q, { credentials: 'include' });
            return await res.json();
        } catch (e) {
            return { ok: false, message: 'Erreur chargement des totaux.' };
        }
    },

    // --- Gestion des Employés (cache 30s) ---
    async getUsers(force=false) {
        if (!force) { const c = _getCache('users', 30000); if (c) return c; }
        try {
            const res = await fetch(getApiEndpoint('users.php'), { credentials: 'include' });
            if (res.status === 401) handleUnauthorized(res);
            const data = await res.json();
            if (data.ok && data.users) { _setCache('users', data.users); return data.users; }
        } catch (e) {
            if (e.message==='Session expirée') throw e;
            console.error('Erreur chargement employés:', e);
        }
        return [];
    },

    // Récupère la liste des départements depuis la BDD (cache 60s)
    async getDepartements() {
        const c = _getCache('depts', 60000); if (c) return c;
        try {
            const res  = await fetch(getApiEndpoint('departements.php'), { credentials: 'include' });
            if (res.status === 401) handleUnauthorized(res);
            const data = await res.json();
            if (data.ok && data.departements) { _setCache('depts', data.departements); return data.departements; }
        } catch (e) {
            if (e.message==='Session expirée') throw e;
            console.error('Erreur chargement départements:', e);
        }
        return [];
    },

    // Aperçu du matricule qui sera généré pour un département (role=admin → préfixe ADM)
    async getMatriculePreview(idDept, role = 'employe') {
        try {
            const res  = await fetch(getApiEndpoint('matricule_preview.php') + '?id_departement=' + idDept + '&role=' + encodeURIComponent(role));
            const data = await res.json();
            return data.matricule || '';
        } catch (e) {
            return '';
        }
    },

    // addUser envoie un FormData pour supporter l'upload de photo
    async addUser(fields, photoFile = null) {
        try {
            const csrf = await this.getCsrfToken();
            const fd = new FormData();
            Object.entries(fields).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, v); });
            if (photoFile) fd.append('photo', photoFile);
            const headers = {};
            if (csrf) headers['X-CSRF-Token'] = csrf;
            const res = await fetch(getApiEndpoint('users.php'), { method: 'POST', headers, body: fd, credentials: 'include' });
            const j = await res.json(); if (j.ok) { _clearCache('users'); _clearCache('dashAll_today'); _clearCache('dashAll_7d'); _clearCache('dashAll_30d'); _clearCache('dashCharts'); }
            return j;
        } catch (e) {
            return { ok: false, message: 'Erreur lors de l\'ajout de l\'employé.' };
        }
    },

    async updateUser(id, data, photoFile = null) {
        try {
            const csrf = await this.getCsrfToken();
            const isAdmin = id > 10000;
            let j;
            if (photoFile || isAdmin) {
                const fd = new FormData();
                if (isAdmin) fd.append('action', 'update');
                fd.append('id', id);
                Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, v); });
                if (photoFile) fd.append('photo', photoFile);
                const headers = {};
                if (csrf) headers['X-CSRF-Token'] = csrf;
                const res = await fetch(getApiEndpoint('users.php'), { method: 'POST', headers, body: fd, credentials: 'include' });
                j = await res.json();
            } else {
                const res = await fetch(getApiEndpoint('users.php'), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
                    body: JSON.stringify({ id, ...data }),
                    credentials: 'include'
                });
                j = await res.json();
            }
            if (j && j.ok) { _clearCache('users'); _clearCache('dashAll_today'); _clearCache('dashAll_7d'); _clearCache('dashAll_30d'); _clearCache('dashCharts'); }
            return j;
        } catch (e) {
            return { ok: false, message: 'Erreur de mise à jour.' };
        }
    },

    async deleteUser(id) {
        try {
            const csrf = await this.getCsrfToken();
            const res = await fetch(getApiEndpoint('users.php'), {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
                body: JSON.stringify({ id }),
                credentials: 'include'
            });
            const j = await res.json(); if (j.ok) { _clearCache('users'); _clearCache('dashAll_today'); _clearCache('dashAll_7d'); _clearCache('dashAll_30d'); _clearCache('dashCharts'); _clearCache('pointages'); _clearCache('pointagesAll'); }
            return j;
        } catch (e) {
            return { ok: false, message: 'Erreur lors de la suppression.' };
        }
    },

    // --- Biométrie ---
    async enrollFingerprint(userId) {
        try {
            const csrf = await this.getCsrfToken();
            const res = await fetch(getApiEndpoint('biometric.php'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
                body: JSON.stringify({ action: 'enroll', userId }),
                credentials: 'include'
            });
            const j = await res.json(); if (j.ok) { _clearCache('users'); }
            return j;
        } catch (e) {
            return { ok: false, message: 'Erreur enrôlement.' };
        }
    },

    // --- Enrôlement 2 étapes (temps réel : capture 1 puis capture 2) ---
    // signal (AbortController) : annulation depuis le bouton Annuler du modal.
    async enrollStep1(userId, signal) {
        try {
            const csrf = await this.getCsrfToken();
            const res = await fetch(getApiEndpoint('biometric.php'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
                body: JSON.stringify({ action: 'enroll_step1', userId }),
                credentials: 'include',
                ...(signal ? { signal } : {})
            });
            return await res.json();
        } catch (e) {
            if (e && e.name === 'AbortError') return { ok: false, aborted: true };
            return { ok: false, message: 'Erreur capture 1.' };
        }
    },

    async enrollStep2(userId, slot, signal) {
        try {
            const csrf = await this.getCsrfToken();
            const res = await fetch(getApiEndpoint('biometric.php'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
                body: JSON.stringify({ action: 'enroll_step2', userId, slot }),
                credentials: 'include',
                ...(signal ? { signal } : {})
            });
            const j = await res.json(); if (j.ok) { _clearCache('users'); }
            return j;
        } catch (e) {
            if (e && e.name === 'AbortError') return { ok: false, aborted: true };
            return { ok: false, message: 'Erreur capture 2.' };
        }
    },

    // Purge TOTALE de la biométrie : bibliothèque R307 vidée + slots + gabarits BDD.
    // Retourne { ok, message, partial?, purged?, deleted? }
    async deleteAllFingerprints() {
        try {
            const csrf = await this.getCsrfToken();
            const res = await fetch(getApiEndpoint('biometric.php'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
                body: JSON.stringify({ action: 'purge_all' }),
                credentials: 'include'
            });
            return await res.json();
        } catch (e) {
            return { ok: false, message: 'Erreur purge biométrie.' };
        }
    },

    async deleteFingerprint(userId) {
        try {
            const csrf = await this.getCsrfToken();
            const res = await fetch(getApiEndpoint('biometric.php'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
                body: JSON.stringify({ action: 'delete', userId }),
                credentials: 'include'
            });
            const j = await res.json(); if (j.ok) { _clearCache('users'); }
            return j;
        } catch (e) {
            return { ok: false, message: 'Erreur récurrente.' };
        }
    }
};

// H2 : POST JSON avec jeton CSRF (pour les fetch directs hors api.*,
// ex. sensor_mode.php). Utilisé par capteur.js et app.js.
async function fetchCsrf(endpoint, body) {
    let csrf = null;
    try { csrf = await api.getCsrfToken(); } catch {}
    return fetch(getApiEndpoint(endpoint), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
        body: JSON.stringify(body)
    });
}