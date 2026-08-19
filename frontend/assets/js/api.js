// ============================================================
// API simulée — mêmes signatures que l'API réelle (PHP) attendue.
// Remplacer chaque méthode par un fetch() vers les routes du backend.
// ============================================================

const api = {
    _delay(ms = 350) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // --- Authentification ---
    async login(matricule, password) {
        await this._delay();
        const db = loadDB();
        const user = db.users.find(u => u.matricule === matricule && u.password === password);
        if (!user) return { ok: false, message: 'Matricule ou mot de passe incorrect.' };

        if (user.role !== 'admin' && user.role !== 'super_admin') {
            return { ok: false, message: 'Accès réservé. Les employés n\'ont pas de compte d\'accès au tableau de bord.' };
        }

        storage.set(SESSION_KEY, JSON.stringify({ id: user.id, matricule: user.matricule }));
        return { ok: true, user };
    },

    logout() {
        storage.remove(SESSION_KEY);
    },

    getCurrentUser() {
        const raw = storage.get(SESSION_KEY);
        const db = loadDB();
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                const user = db.users.find(u => u.id === parsed.id);
                if (user) return user;
            } catch (e) {}
        }
        const defaultAdmin = db.users.find(u => u.role === 'super_admin' || u.role === 'admin') || db.users[0];
        if (defaultAdmin) {
            storage.set(SESSION_KEY, JSON.stringify({ id: defaultAdmin.id, matricule: defaultAdmin.matricule }));
        }
        return defaultAdmin || null;
    },

    // --- Dashboard ---
    async getDashboardStats() {
        await this._delay(250);
        const db = loadDB();
        const today = todayISO();
        const todayPoints = db.pointages.filter(p => p.date === today);

        const total = db.users.length;
        const entrees = todayPoints.length;
        const sorties = todayPoints.filter(p => p.sortie !== null).length;
        const retards = todayPoints.filter(p => isRetard(p.entree)).length;
        const absents = Math.max(0, total - entrees);

        return { total, entrees, sorties, retards, absents, evenements: entrees + sorties };
    },

    async getActivity() {
        await this._delay(200);
        const db = loadDB();
        const max = Math.max(...db.activite.map(a => a.count), 1);
        return db.activite.map(a => ({ ...a, height: Math.round((a.count / max) * 100) }));
    },

    async getTodayPointages() {
        await this._delay(250);
        const db = loadDB();
        return db.pointages
            .filter(p => p.date === todayISO())
            .map(p => {
                const user = db.users.find(u => u.id === p.user_id);
                return { ...p, user };
            })
            .sort((a, b) => (a.entree || '').localeCompare(b.entree || ''));
    },

    // --- Pointage ---
    getTodayPointage(userId) {
        const db = loadDB();
        return db.pointages.find(p => p.user_id === userId && p.date === todayISO()) || null;
    },

    getHistory(userId) {
        const db = loadDB();
        return db.pointages
            .filter(p => p.user_id === userId)
            .sort((a, b) => b.date.localeCompare(a.date) || (b.entree || '').localeCompare(a.entree || ''))
            .slice(0, 30);
    },

    async scanFingerprint() {
        await this._delay(1500);
        const user = this.getCurrentUser();
        const db = loadDB();

        if (!user.empreinte) {
            return { ok: false, message: "Empreinte non reconnue. Aucune empreinte enregistrée pour ce compte." };
        }

        const today = this.getTodayPointage(user.id);

        if (!today) {
            db.pointages.push({ id: Date.now(), user_id: user.id, date: todayISO(), entree: timeNow(), sortie: null });
            saveDB(db);
            return { ok: true, type: 'entree', message: `Entrée pointée à ${timeNow().slice(0, 5)}. Bon travail !` };
        }

        if (today.sortie === null) {
            today.sortie = timeNow();
            saveDB(db);
            return { ok: true, type: 'sortie', message: `Sortie pointée à ${timeNow().slice(0, 5)}. À demain !` };
        }

        return { ok: false, type: 'deja', message: 'Vous avez déjà pointé entrée et sortie aujourd\'hui.' };
    },

    async manualPoint() {
        await this._delay(400);
        return this.scanFingerprint();
    },

    // --- Employés (admin) ---
    async getUsers() {
        await this._delay(250);
        const db = loadDB();
        return [...db.users].sort((a, b) => a.id - b.id);
    },

    async addUser(data) {
        await this._delay(400);
        const db = loadDB();
        if (db.users.some(u => u.matricule === data.matricule)) {
            return { ok: false, message: 'Ce matricule existe déjà.' };
        }
        const id = Math.max(...db.users.map(u => u.id)) + 1;
        db.users.push({ id, ...data, empreinte: false });
        saveDB(db);
        return { ok: true, user: db.users.find(u => u.id === id) };
    },

    async deleteUser(id) {
        await this._delay(300);
        const db = loadDB();
        db.users = db.users.filter(u => u.id !== id);
        db.pointages = db.pointages.filter(p => p.user_id !== id);
        saveDB(db);
        return { ok: true };
    },

    async enrollFingerprint(userId) {
        await this._delay(1500);
        const db = loadDB();
        const user = db.users.find(u => u.id === userId);
        if (!user) return { ok: false, message: 'Employé introuvable.' };
        user.empreinte = true;
        saveDB(db);
        return { ok: true, message: `Empreinte de ${user.prenom} ${user.nom} enregistrée.` };
    },

    async deleteFingerprint(userId) {
        await this._delay(300);
        const db = loadDB();
        const user = db.users.find(u => u.id === userId);
        if (user) user.empreinte = false;
        saveDB(db);
        return { ok: true };
    },
};