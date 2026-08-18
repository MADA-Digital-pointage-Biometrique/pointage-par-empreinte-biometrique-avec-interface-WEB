// ============================================================
// Données fictives (mock) — à remplacer par l'API réelle du backend
// ============================================================

const DB_KEY = 'pointage_db_v2';
const SESSION_KEY = 'pointage_session';

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
            { id: 1, matricule: 'ADM001', nom: 'Ravelo', prenom: 'Mamy', email: 'superadmin@mada.com', role: 'super_admin', password: 'admin123', empreinte: true, departement: 'Direction Générale' },
            { id: 2, matricule: 'ADM002', nom: 'Razafy', prenom: 'Aina', email: 'admin.rh@mada.com', role: 'admin', password: 'admin123', empreinte: true, departement: 'Ressources Humaines' },
            { id: 3, matricule: 'EMP001', nom: 'Rasolofoniaina', prenom: 'Hery', email: 'hery@mada.com', role: 'employe', password: null, empreinte: true, departement: 'Ingénierie & IT' },
            { id: 4, matricule: 'EMP002', nom: 'Rakotomalala', prenom: 'Nomena', email: 'nomena@mada.com', role: 'employe', password: null, empreinte: false, departement: 'Ressources Humaines' },
            { id: 5, matricule: 'EMP003', nom: 'Andrianarivo', prenom: 'Faly', email: 'faly@mada.com', role: 'employe', password: null, empreinte: true, departement: 'Marketing & Comm' },
            { id: 6, matricule: 'EMP004', nom: 'Randria', prenom: 'Tanjona', email: 'tanjona@mada.com', role: 'employe', password: null, empreinte: true, departement: 'Technique & Support' },
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

function loadDB() {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return seedDB();
    try {
        return JSON.parse(raw);
    } catch (e) {
        return seedDB();
    }
}

function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function resetDB() {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(SESSION_KEY);
}

// Aide à la date affichée en français
function formatDate(dateISO) {
    const d = new Date(dateISO + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function isRetard(entree) {
    return entree !== null && entree > HEURE_DEBUT;
}