// ============================================================
// Données et utilitaires P.Biometrique - Connexion Directe MySQL
// ============================================================

// Supprime définitivement les données fictives sauvegardées en localStorage
try {
    localStorage.removeItem('pointage_db_v2');
    localStorage.removeItem('pointage_session');
    localStorage.removeItem('mada_db');
} catch (e) {}

const DB_KEY = 'pointage_db_v2';
const SESSION_KEY = 'pointage_session';

// Module de stockage (utilise sessionStorage uniquement pour la session courante)
const storage = {
    get(k) {
        try { return sessionStorage.getItem(k); } catch (e) { return null; }
    },
    set(k, v) {
        try { sessionStorage.setItem(k, v); } catch (e) {}
    },
    remove(k) {
        try { sessionStorage.removeItem(k); } catch (e) {}
    }
};

// Horaires officiels : 08h30 – 17h00 (repos le dimanche)
const HEURE_DEBUT = '08:30:00';
const HEURE_FIN = '17:00:00';

function isWorkday(dateISO) {
    const d = new Date(dateISO + 'T00:00:00');
    return !isNaN(d.getTime()) && d.getDay() !== 0;
}

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function timeNow() {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
}

function formatDate(dateISO) {
    const d = new Date(dateISO + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function isRetard(entree) {
    return entree !== null && entree > HEURE_DEBUT;
}

function resetDB() {
    try {
        localStorage.removeItem(DB_KEY);
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.clear();
    } catch (e) {}
}