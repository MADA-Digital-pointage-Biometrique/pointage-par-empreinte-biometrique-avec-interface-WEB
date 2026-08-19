// ============================================================
// Données fictives (mock) — à remplacer par l'API réelle du backend
// ============================================================

const DB_KEY = 'pointage_db_v2';
const SESSION_KEY = 'pointage_session';

// Wrapper de stockage : localStorage si disponible, sinon mémoire vive
// (localStorage peut être bloqué sous protocole file:// selon le navigateur)
const storage = {
    _mem: {},
    get(k) {
        try { const v = localStorage.getItem(k); if (v !== null) return v; } catch (e) { /* bloqué */ }
        return this._mem[k] ?? null;
    },
    set(k, v) {
        this._mem[k] = v;
        try { localStorage.setItem(k, v); } catch (e) { /* bloqué */ }
    },
    remove(k) {
        delete this._mem[k];
        try { localStorage.removeItem(k); } catch (e) { /* bloqué */ }
    }
};

const HEURE_DEBUT = '09:00:00';
const HEURE_FIN = '17:00:00';

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function timeNow() {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
}

function seedDB() {
    return {
        users: [
            { id: 1, matricule: 'ADM001', nom: 'Ravelo', prenom: 'Mamy', email: 'superadmin@mada.com', role: 'super_admin', password: 'admin123', empreinte: true, departement: 'Web & mobile' },
            { id: 2, matricule: 'ADM002', nom: 'Razafy', prenom: 'Aina', email: 'admin.rh@mada.com', role: 'admin', password: 'admin123', empreinte: true, departement: 'Infogérance' },
            { id: 3, matricule: 'EMP001', nom: 'Rasolofoniaina', prenom: 'Hery', email: 'hery@mada.com', role: 'employe', password: null, empreinte: true, departement: 'ERP sur mesure' },
            { id: 4, matricule: 'EMP002', nom: 'Rakotomalala', prenom: 'Nomena', email: 'nomena@mada.com', role: 'employe', password: null, empreinte: false, departement: 'IA & data' },
            { id: 5, matricule: 'EMP003', nom: 'Andrianarivo', prenom: 'Faly', email: 'faly@mada.com', role: 'employe', password: null, empreinte: true, departement: 'Fintech Gplus' },
            { id: 6, matricule: 'EMP004', nom: 'Randria', prenom: 'Tanjona', email: 'tanjona@mada.com', role: 'employe', password: null, empreinte: true, departement: 'Sécurité' },
        ],
        pointages: [
            { id: 1, user_id: 1, date: todayISO(), entree: '08:52:00', sortie: null },
            { id: 2, user_id: 3, date: todayISO(), entree: '09:14:00', sortie: null },
            { id: 3, user_id: 5, date: todayISO(), entree: '08:30:00', sortie: '12:02:00' },
            { id: 4, user_id: 6, date: todayISO(), entree: '08:45:00', sortie: null },
            { id: 5, user_id: 1, date: '2026-08-15', entree: '08:45:00', sortie: '17:10:00' },
            { id: 6, user_id: 3, date: '2026-08-15', entree: '09:02:00', sortie: '17:05:00' },
            { id: 7, user_id: 4, date: '2026-08-15', entree: '08:50:00', sortie: '16:55:00' },
            { id: 8, user_id: 5, date: '2026-08-15', entree: '09:25:00', sortie: '17:00:00' },
        ],
        activite: [
            { heure: '06h', count: 2 },
            { heure: '07h', count: 18 },
            { heure: '08h', count: 45 },
            { heure: '09h', count: 14 },
            { heure: '10h', count: 6 },
        ],
    };
}

const DEPT_MAP = {
    'Direction Générale': 'Web & mobile',
    'Ressources Humaines': 'Infogérance',
    'Ingénierie & IT': 'ERP sur mesure',
    'Marketing & Comm': 'Fintech Gplus',
    'Technique & Support': 'Sécurité'
};

function loadDB() {
    const raw = storage.get(DB_KEY);
    if (!raw) return seedDB();
    try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users)) {
            let modified = false;
            parsed.users.forEach(u => {
                if (DEPT_MAP[u.departement]) {
                    u.departement = DEPT_MAP[u.departement];
                    modified = true;
                }
            });
            if (modified) saveDB(parsed);
        }
        return parsed;
    } catch (e) {
        return seedDB();
    }
}

function saveDB(db) {
    storage.set(DB_KEY, JSON.stringify(db));
}

function resetDB() {
    storage.remove(DB_KEY);
    storage.remove(SESSION_KEY);
}

// Aide à la date affichée en français
function formatDate(dateISO) {
    const d = new Date(dateISO + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function isRetard(entree) {
    return entree !== null && entree > HEURE_DEBUT;
}