// ============================================================
// Client WebSocket pour notifications temps réel
// ============================================================

class WebSocketClient {
    constructor() {
        this.ws = null;
        this.url = '';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 2000;
        this.heartbeatInterval = null;
        this.listeners = new Map();
        this.isAuthenticated = false;
        this.userId = null;
    }

    // Configuration de l'URL du serveur WebSocket
    setServerUrl(url) {
        this.url = url;
    }

    // Connexion au serveur WebSocket
    connect(userId, authToken) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }

        if (!this.url) {
            return Promise.reject(new Error('URL WebSocket non configurée'));
        }

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);
                this.ws.binaryType = 'arraybuffer';

                this.ws.onopen = () => {
                    console.log('[WS] Connecté au serveur');
                    this.reconnectAttempts = 0;
                    this.startHeartbeat();

                    // Authentification
                    this.send({
                        type: 'auth',
                        user_id: userId,
                        token: this.getSessionToken()
                    }).then(() => {
                        this.isAuthenticated = true;
                        this.userId = userId;
                        resolve();
                    }).catch(reject);
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (e) {
                        console.error('[WS] Erreur parsing message:', e);
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('[WS] Déconnecté:', event.code, event.reason);
                    this.stopHeartbeat();
                    this.isAuthenticated = false;
                    this.scheduleReconnect();
                };

                this.ws.onerror = (error) => {
                    console.error('[WS] Erreur:', error);
                    reject(new Error('Erreur WebSocket'));
                };
            } catch (e) {
                reject(e);
            }
        });
    }

    // Envoi d'un message
    send(data) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket non connecté'));
                return;
            }

            const message = JSON.stringify(data);
            this.ws.send(message);
            resolve();
        });
    }

    // Gestion des messages reçus
    handleMessage(data) {
        switch (data.type) {
            case 'auth_ok':
                this.emit('auth_ok', data);
                break;
            case 'auth_error':
                this.emit('auth_error', data);
                break;
            case 'pong':
                // Heartbeat réponse
                break;
            case 'notification':
                this.emit('notification', data);
                break;
            case 'pointage_ok':
                this.emit('pointage_ok', data);
                break;
            case 'enroll_ok':
                this.emit('enroll_ok', data);
                break;
            case 'alert':
                this.emit('alert', data);
                break;
            default:
                this.emit('message', data);
        }
    }

    // Système d'événements simple
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) callbacks.splice(index, 1);
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(data));
        }
    }

    // Heartbeat pour maintenir la connexion
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({ type: 'ping' }).catch(() => {});
            }
        }, 30000); // Toutes les 30 secondes
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    // Reconnexion automatique
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[WS] Max tentatives de reconnexion atteinte');
            this.emit('max_reconnect_reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
        console.log(`[WS] Reconnexion dans ${delay}ms (tentative ${this.reconnectAttempts})`);

        setTimeout(() => {
            // La reconnexion nécessite userId et token, à gérer par l'appelant
            this.emit('reconnect_needed');
        }, delay);
    }

    // Déconnexion propre
    disconnect() {
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        this.isAuthenticated = false;
        this.userId = null;
    }

    // Récupération du token de session
    getSessionToken() {
        try {
            const session = sessionStorage.getItem('mada_user_session');
            return session ? JSON.parse(session) : null;
        } catch {
            return null;
        }
    }
}

// Instance singleton
window.WSClient = new WebSocketClient();