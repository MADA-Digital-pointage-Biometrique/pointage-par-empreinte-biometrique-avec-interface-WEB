<?php
/**
 * Serveur WebSocket Ratchet pour notifications temps réel
 * Démarrage : php api/websocket-server.php
 * Port par défaut : 8080
 */

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/db.php';

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use Ratchet\Wamp\WampServer;

// Configuration
$host = '0.0.0.0';
$port = (int)($_ENV['WS_PORT'] ?? $_SERVER['WS_PORT'] ?? 8080);

/**
 * Stockage des connexions actives par utilisateur
 */
class WebSocketHandler implements MessageComponentInterface {
    protected $clients;
    protected $userConnections;
    protected $pdo;

    public function __construct() {
        $this->clients = new \SplObjectStorage();
        $this->userConnections = [];
        $this->pdo = getDB();
    }

    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        echo "Nouvelle connexion: {$conn->resourceId}\n";
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        $data = json_decode($msg, true);
        if (!$data) return;

        switch ($data['type'] ?? '') {
            case 'auth':
                $this->handleAuth($from, $data);
                break;
            case 'ping':
                $from->send(json_encode(['type' => 'pong']));
                break;
            case 'subscribe':
                $this->handleSubscribe($from, $data);
                break;
            case 'mobile_config_update':
                // Broadcast à tous les clients (mobile + PC) sans auth requise
                $payload = ['type' => 'mobile_config', 'config' => $data['config'] ?? $data];
                foreach ($this->clients as $client) {
                    $client->send(json_encode($payload));
                }
                // aussi aux users authentifiés
                $this->broadcast($payload);
                echo "Broadcast mobile_config: " . json_encode($payload) . "\n";
                break;
        }
    }

    protected function handleAuth(ConnectionInterface $conn, array $data) {
        $token = $data['token'] ?? '';
        $userId = $data['user_id'] ?? 0;

        if (!$token || !$userId) {
            $conn->send(json_encode(['type' => 'auth_error', 'message' => 'Token ou user_id manquant']));
            return;
        }

        // Vérifier le token en base (session)
        $stmt = $this->pdo->prepare('SELECT id_utilisateur FROM utilisateurs_systeme WHERE id_utilisateur = ? AND statut = "actif"');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user) {
            $conn->send(json_encode(['type' => 'auth_error', 'message' => 'Utilisateur invalide']));
            return;
        }

        // Associer connexion à l'utilisateur
        $this->userConnections[$userId] = $conn;
        $conn->userId = $userId;

        $conn->send(json_encode([
            'type' => 'auth_ok',
            'user_id' => $userId,
            'message' => 'Connecté aux notifications temps réel'
        ]));
        echo "Utilisateur $userId authentifié sur WS\n";
    }

    protected function handleSubscribe(ConnectionInterface $conn, array $data) {
        // Pour futures extensions (topics, rooms)
        $conn->send(json_encode(['type' => 'subscribed', 'topics' => $data['topics'] ?? []]));
    }

    public function onClose(ConnectionInterface $conn) {
        $this->clients->detach($conn);
        if (isset($conn->userId)) {
            unset($this->userConnections[$conn->userId]);
            echo "Utilisateur {$conn->userId} déconnecté\n";
        }
        echo "Connexion fermée: {$conn->resourceId}\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "Erreur WS: {$e->getMessage()}\n";
        $conn->close();
    }

    // Méthodes publiques pour envoyer des notifications depuis l'API
    public function sendToUser(int $userId, array $data): bool {
        if (isset($this->userConnections[$userId])) {
            $conn = $this->userConnections[$userId];
            $conn->send(json_encode($data));
            return true;
        }
        return false;
    }

    public function broadcast(array $data): void {
        foreach ($this->userConnections as $conn) {
            $conn->send(json_encode($data));
        }
    }

    public function sendToAdmins(array $data): void {
        // Récupérer les admins connectés
        foreach ($this->userConnections as $userId => $conn) {
            $stmt = $this->pdo->prepare('SELECT role FROM utilisateurs_systeme WHERE id_utilisateur = ?');
            $stmt->execute([$userId]);
            $role = $stmt->fetchColumn();
            if (in_array($role, ['admin', 'admin_systeme', 'super_admin'])) {
                $conn->send(json_encode($data));
            }
        }
    }
}

// ============================================================
// Point d'entrée
// ============================================================
$handler = new WebSocketHandler();

$server = IoServer::factory(
    new HttpServer(
        new WsServer($handler)
    ),
    $port,
    $host
);

echo "Serveur WebSocket démarré sur $host:$port\n";
echo "Accessible via ws://<IP_LOCALE>:$port\n";

$server->run();