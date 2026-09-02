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
                body: JSON.stringify({ matricule, password })
            });

            const data = await res.json();
            if (data.ok && data.user) {
                const userJson = JSON.stringify(data.user);
                sessionStorage.setItem('mada_user_session', userJson);
                storage.set(SESSION_KEY, userJson);
            }
            return data;
        } catch (e) {
            console.error('Erreur connexion backend:', e);
            return { ok: false, message: 'Impossible de contacter le serveur MySQL sur XAMPP.' };
        }
    },

    async logout() {
        try {
            await fetch(getApiEndpoint('logout.php'), { method: 'POST' });
        } catch (e) {}
        sessionStorage.removeItem('mada_user_session');
        storage.remove(SESSION_KEY);
        window.location.href = 'login.php';
    },

    getCurrentUser() {
        try {
            const raw = sessionStorage.getItem('mada_user_session') || storage.get(SESSION_KEY);
            if (raw) {
                return JSON.parse(raw);
            }
        } catch (e) {}
        return { id: 1, nom: 'Administrateur', prenom: 'Système', role: 'admin' };
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

    // --- Tableau de bord (cache 15s Supabase) ---
    async getDashboardStats() {
        const c = _getCache('dashStats', 15000); if (c) return c;
        try {
            const res = await fetch(getApiEndpoint('dashboard.php'));
            const data = await res.json();
            if (data.ok && data.stats) { _setCache('dashStats', data.stats); return data.stats; }
        } catch (e) {}
        return { total: 0, entrees: 0, sorties: 0, retards: 0, absents: 0, evenements: 0 };
    },

    async getActivity() {
        const c = _getCache('dashAct', 15000); if (c) return c;
        try {
            const res = await fetch(getApiEndpoint('dashboard.php'));
            const data = await res.json();
            if (data.ok && data.activite) { _setCache('dashAct', data.activite); return data.activite; }
        } catch (e) {}
        return [
            { heure: '06h', count: 0, height: 0 },
            { heure: '07h', count: 0, height: 0 },
            { heure: '08h', count: 0, height: 0 },
            { heure: '09h', count: 0, height: 0 },
            { heure: '10h', count: 0, height: 0 }
        ];
    },

    async getTodayPointages() {
        const c = _getCache('pointages', 10000); if (c) return c;
        try {
            const res = await fetch(getApiEndpoint('pointages.php'));
            const data = await res.json();
            if (data.ok && data.pointages) { _setCache('pointages', data.pointages); return data.pointages; }
        } catch (e) {}
        return [];
    },

    async updatePointage(id, data) {
        try {
            const csrf = await this.getCsrfToken();
            const res = await fetch(getApiEndpoint('pointages.php'), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
                body: JSON.stringify({ id, ...data })
            });
            const j = await res.json(); if (j.ok) _clearCache('pointages');
            return j;
        } catch (e) {
            return { ok: false, message: 'Erreur lors de la mise à jour du pointage.' };
        }
    },

    // --- Gestion des Employés (cache 30s) ---
    async getUsers(force=false) {
        if (!force) { const c = _getCache('users', 30000); if (c) return c; }
        try {
            const res = await fetch(getApiEndpoint('users.php'));
            const data = await res.json();
            if (data.ok && data.users) { _setCache('users', data.users); return data.users; }
        } catch (e) {
            console.error('Erreur chargement employés:', e);
        }
        return [];
    },

    // Récupère la liste des départements depuis la BDD (cache 60s)
    async getDepartements() {
        const c = _getCache('depts', 60000); if (c) return c;
        try {
            const res  = await fetch(getApiEndpoint('departements.php'));
            const data = await res.json();
            if (data.ok && data.departements) { _setCache('depts', data.departements); return data.departements; }
        } catch (e) {
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
            const res = await fetch(getApiEndpoint('users.php'), { method: 'POST', headers, body: fd });
            const j = await res.json(); if (j.ok) { _clearCache('users'); _clearCache('dashStats'); }
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
                const res = await fetch(getApiEndpoint('users.php'), { method: 'POST', headers, body: fd });
                j = await res.json();
            } else {
                const res = await fetch(getApiEndpoint('users.php'), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
                    body: JSON.stringify({ id, ...data })
                });
                j = await res.json();
            }
            if (j && j.ok) { _clearCache('users'); _clearCache('dashStats'); }
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
                body: JSON.stringify({ id })
            });
            const j = await res.json(); if (j.ok) { _clearCache('users'); _clearCache('dashStats'); _clearCache('pointages'); }
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
                body: JSON.stringify({ action: 'enroll', userId })
            });
            const j = await res.json(); if (j.ok) { _clearCache('users'); }
            return j;
        } catch (e) {
            return { ok: false, message: 'Erreur enrôlement.' };
        }
    },

    async deleteFingerprint(userId) {
        try {
            const csrf = await this.getCsrfToken();
            const res = await fetch(getApiEndpoint('biometric.php'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
                body: JSON.stringify({ action: 'delete', userId })
            });
            const j = await res.json(); if (j.ok) { _clearCache('users'); }
            return j;
        } catch (e) {
            return { ok: false, message: 'Erreur récurrente.' };
        }
    }
};