// ============================================================
// Configuration dynamique de l'application
// IP du serveur configurable pour WiFi local
// ============================================================

window.AppConfig = {
    // Configuration par défaut
    defaults: {
        wsPort: 8080,
        apiBase: '/api',
        wsPath: '/api/websocket-server.php'
    },

    // Configuration courante (surchargée par localStorage)
    current: {},

    // Initialisation
    init() {
        this.load();
        this.applyToGlobals();
    },

    // Chargement depuis localStorage
    load() {
        try {
            const saved = localStorage.getItem('app_config');
            if (saved) {
                this.current = { ...this.defaults, ...JSON.parse(saved) };
            } else {
                this.current = { ...this.defaults };
            }
        } catch {
            this.current = { ...this.defaults };
        }
    },

    // Sauvegarde dans localStorage
    save() {
        localStorage.setItem('app_config', JSON.stringify(this.current));
    },

    // Appliquer aux variables globales
    applyToGlobals() {
        window.WS_URL = this.getWsUrl();
        window.API_BASE = this.current.apiBase;
        window.RP_ID = this.getRpId();
    },

    // URL WebSocket complète
    getWsUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = this.current.wsHost || window.location.hostname;
        const port = this.current.wsPort || this.defaults.wsPort;
        return `${protocol}//${host}:${port}`;
    },

    // RP ID pour WebAuthn (hostname sans port)
    getRpId() {
        return this.current.wsHost || window.location.hostname;
    },

    // Setters avec sauvegarde auto
    setWsHost(host) {
        this.current.wsHost = host;
        this.save();
        this.applyToGlobals();
    },

    setWsPort(port) {
        this.current.wsPort = parseInt(port) || this.defaults.wsPort;
        this.save();
        this.applyToGlobals();
    },

    // Récupération config pour API
    getApiHeaders() {
        return {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        };
    },

    // URL API complète
    getApiUrl(endpoint) {
        const base = this.current.apiBase || this.defaults.apiBase;
        return `${window.location.origin}${base}/${endpoint}`;
    }
};

// Initialisation auto
document.addEventListener('DOMContentLoaded', () => {
    window.AppConfig.init();
});

// Export pour modules
window.AppConfig;