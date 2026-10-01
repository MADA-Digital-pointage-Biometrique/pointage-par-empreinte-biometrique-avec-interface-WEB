#!/usr/bin/env python3
"""
Service local R307 — sessions COURTES (modèle de l'ancienne version).

Chaque opération capteur suit le cycle qui marchait avant le daemon :
OUVRIR le port → déverrouiller (VerifyPwd) → échanger → REFERMER.
Le port n'est jamais retenu entre deux opérations : les enrôlements,
réconciliations, scans manuels et cycles de surveillance se partagent le
COM sans jamais se verrouiller mutuellement (Accès refusé) et sans
accumuler de handles périmés (WinError 22).

Deux rôles :
1. Surveillance continue (mode pointage) : à chaque cycle, une session
   courte envoie GenImg en boucle (~2 s) — le voyant du capteur reste
   actif. À la détection d'un doigt il identifie l'empreinte LOCALEMENT
   (Img2Tz + Search → page_id + score) puis POST le résultat à
   api/borne_pointage.php (auth X-Device-Token, anti-rejeu ts+nonce).
   Python ne touche JAMAIS la BDD.
2. Ordonnancement des opérations capteur (enroll/search/delete/status/...)
   via HTTP localhost:8765 — PHP (SdkReader) passe par lui en priorité,
   et chaque requête reçoit sa propre session série courte.

Le mode (pointage/enrolement) est relu dans python/mode.json à chaque cycle :
la surveillance se met en PAUSE automatiquement en mode enrolement (les deux
captures d'enrôlement passent alors sans concurrence) et reprend toute seule.

Usage:
  py r307_service.py --port auto --baud 57600
Env (.env du projet) :
  BORNE_TOKEN=<token borne>   R307_API_URL=<URL complète de api/borne_pointage.php>
Sans BORNE_TOKEN/R307_API_URL la surveillance est désactivée (message clair),
les actions à la demande restent disponibles.
"""
import argparse
import json
import os
import signal
import sys
import threading
import time
import uuid
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib import request as _urlreq
from urllib.error import HTTPError as _urlHTTPError

try:
    from r307_driver import R307, PID_CMD, CMD_GEN_IMG, CONFIRM_OK, ERR_NOFINGER
except ImportError:
    R307 = None

# État temps réel de l'enrôlement en cours (exposé par GET /enroll_status).
# Reconnecte l'UI aux phases matérielles : attente doigt → capture OK → fusion.
ENROLL_STATE = {
    'active': False,
    'phase': 'idle',          # idle|waiting_finger|processing|merging|saving
    'step': 0,                # 0, 1 ou 2
    'finger': False,          # doigt détecté sur le capteur en ce moment
    'captures_ok': 0,
    'message': '',
    'error': '',
    'updated_at': None,
}


def _enroll_set(**kw):
    """Mise à jour atomique de l'état d'enrôlement (lecture sans lock côté HTTP)."""
    ENROLL_STATE.update(kw)
    ENROLL_STATE['updated_at'] = time.strftime('%Y-%m-%dT%H:%M:%S')
try:
    from r307_cli import read_mode, write_mode
except ImportError:
    read_mode = write_mode = None

# ---------------------------------------------------------------------------
# Verrous
# ---------------------------------------------------------------------------
# SERIAL_LOCK : une seule opération parle au capteur à la fois (watch, HTTP, enroll).
# CAPTURE_LOCK : section critique enrôlement — la surveillance se suspend
# immédiatement (pas de GenImg concurrent pendant les 2 captures) et le POST
# du pointage détecté ne s'exécute jamais pendant un enrôlement.
SERIAL_LOCK = threading.Lock()
CAPTURE_LOCK = threading.Lock()
STOP_EVENT = threading.Event()

# État de surveillance exposé par /status (lecture sans lock : affectations atomiques)
WATCH_STATE = {
    'watch_enabled': False,   # config BORNE_TOKEN + R307_API_URL présente
    'watch_user_enabled': False,  # interrupteur manuel (sensor_watch.php) — désactivé par défaut, activation via UI
    'watching': False,        # boucle active ET mode pointage
    'hw_ok': None,            # HEARTBEAT : le capteur a répondu récemment (True/False/None)
    'hw_checked_at': None,    # ts du dernier verdict matériel (cycle watch ou /status live)
    'count': 0,               # dernier TemplateNum connu (rafraîchi par watch / /status)
    'last_detection': None,   # ISO local de la dernière détection de doigt
    'last_result': None,      # {'page_id','score','http','message'}
    'last_error': None,
}

# ---------------------------------------------------------------------------
# Config .env (le daemon ne dépend pas de PHP pour lire la config)
# ---------------------------------------------------------------------------
def load_env(path=None):
    """Parse un fichier .env (clé=valeur) sans écraser l'environnement existant."""
    if path is None:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env')
    try:
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v
    except OSError:
        pass


@contextmanager
def _serial_session(timeout=30.0):
    """Encadre une opération capteur par le lock série (échec net si occupé)."""
    if not SERIAL_LOCK.acquire(timeout=timeout):
        raise RuntimeError('Port série occupé (surveillance ou autre opération en cours)')
    try:
        yield
    finally:
        SERIAL_LOCK.release()


@contextmanager
def _serial_open_session(r, timeout=30.0):
    """Lock série + SESSION FRAÎCHE : ouverture au début, FERMETURE GARANTIE à
    la fin (modèle de l'ancienne version CLI : open → échange → close). Le
    port n'est jamais retenu entre deux opérations : les erreurs transitoires
    ne s'accumulent plus et aucun handle périmé ne bloque les autres."""
    if not SERIAL_LOCK.acquire(timeout=timeout):
        raise RuntimeError('Port série occupé (surveillance ou autre opération en cours)')
    try:
        r._ensure_open()
        yield
    finally:
        r._close_quiet()
        SERIAL_LOCK.release()


# ---------------------------------------------------------------------------
# Instance partagée + surveillance
# ---------------------------------------------------------------------------
r307_instance = None
args_global = None
WATCH_THREAD = None


class WatchMixin:
    """Boucle de surveillance — mixte sur la classe R307 (partage l'instance)."""

    def _close_quiet(self):
        """Ferme le port sans bruit — le handle est TOUJOURS libéré après
        l'opération (jamais de handle résiduel qui verrouille le COM)."""
        try:
            if self.ser and self.ser.is_open:
                self.ser.close()
        except Exception:
            pass
        self.ser = None

    def _ensure_open(self):
        """SESSION FRAÎCHE à l'ANCIENNE (celle qui marchait) : referme tout
        handle résiduel, ouvre le port et déverrouille le capteur — exactement
        ce que faisait le CLI (un processus par opération : open → échange →
        close). Tenir le handle ouvert en permanence fabrique des handles
        périmés (WinError 22) et verrouille le port pour les autres processus
        (Accès refusé) — c'est ce qui rendait la détection intermittente.
        En --port auto, re-détecte le port à chaque échec (capteur (re)branché
        ailleurs)."""
        self._close_quiet()
        try:
            self.open()
        except Exception:
            retried = False
            if (getattr(args_global, 'port', '') == 'auto'):
                now = time.time()
                if now - getattr(self, '_last_rescan', 0) > 3.0:
                    self._last_rescan = now
                    detected = R307.auto_detect() if R307 else None
                    if detected and detected != self.port:
                        self.port = detected
                        WATCH_STATE['last_error'] = None
                        self.open()  # 2e tentative sur le nouveau port
                        retried = True
            if not retried:
                raise

    def _hw_mark_ok(self, cnt=None):
        """Verdict matériel positif : une réussite efface toute série d'échecs."""
        WATCH_STATE['_fail_streak'] = 0
        WATCH_STATE['_fails'] = 0
        WATCH_STATE['hw_ok'] = True
        WATCH_STATE['hw_checked_at'] = time.time()
        WATCH_STATE['last_error'] = None
        if cnt is not None:
            WATCH_STATE['count'] = cnt
            WATCH_STATE['_count_at'] = time.time()

    def _hw_mark_fail(self, err):
        """Verdict matériel négatif ANTI-CLIGNOTEMENT : l'interface ne passe
        en HS qu'après 2 échecs CONSÉCUTIFS — une erreur USB transitoire
        (WinError 22 sur CP2102) ne doit pas faire osciller
        « En service » → « HS » → « En service » en boucle."""
        WATCH_STATE['last_error'] = str(err)
        streak = WATCH_STATE.get('_fail_streak', 0) + 1
        WATCH_STATE['_fail_streak'] = streak
        if streak >= 2 or WATCH_STATE.get('hw_ok') is None:
            WATCH_STATE['hw_ok'] = False
            WATCH_STATE['hw_checked_at'] = time.time()

    def _resilient(self, fn, *a, **kw):
        """Opération série robuste : 1re erreur → NOUVEL essai sur le MÊME handle
        (les erreurs USB transitoires type WinError 22 sont absorbées sans
        churn) ; 2e échec seulement → fermeture + réouverture + 3e essai.
        Le port doit rester ouvert AU MAXIMUM : chaque cycle ouverture/fermeture
        sur CP2102 est une occasion de collision avec un processus externe et
        de bloquer le pilote (c'est ce qui rendait la détection intermittente).
        À appeler SOUS SERIAL_LOCK."""
        try:
            return fn(*a, **kw)
        except Exception:
            time.sleep(0.15)
            try:
                return fn(*a, **kw)  # 2e essai, même handle
            except Exception:
                try:
                    if self.ser and self.ser.is_open:
                        self.ser.close()
                except Exception:
                    pass
                time.sleep(0.4)
                self._ensure_open()
                return fn(*a, **kw)

    def _detect_scan(self, finger_timeout=2.0):
        """Un cycle de détection. Retourne None (aucun doigt), ('nomatch',) ou ('match', page_id, score).

        À exécuter SOUS SERIAL_LOCK. GenImg à répétition maintient le capteur actif.
        """
        t0 = time.time()
        while time.time() - t0 < finger_timeout and not STOP_EVENT.is_set():
            self.ser.reset_input_buffer()
            self.ser.write(self._packet(PID_CMD, bytes([CMD_GEN_IMG])))
            confirm, _ = self._read_ack(timeout=0.6)
            if confirm == CONFIRM_OK:
                # Doigt détecté → identification locale (une seule capture)
                self.img2tz(1)
                res = self.search(1)
                if res:
                    return ('match', int(res[0]), int(res[1]))
                return ('nomatch',)
            if confirm != ERR_NOFINGER:
                raise RuntimeError(f'GenImg erreur 0x{confirm:02X}')
            time.sleep(0.10)
        return None

    def _wait_finger_gone(self, timeout=5.0):
        """Attend le retrait REEL du doigt — en boucle jusqu'a confirmation.

        L'ancienne version rendait la main au bout de ~8 s meme si le doigt
        etait encore pose : le cycle suivant re-identifiait et, des que la
        fenetre anti-double du serveur expirait, le POST enregistrait un
        pointage non desire (sortie fantome). Ici on boucle jusqu'au retrait.
        """
        while not STOP_EVENT.is_set():
            if CAPTURE_LOCK.locked():
                return  # un enroll attend le port : lui laisser la place
            try:
                with _serial_open_session(self, timeout=10.0):
                    gone = self.wait_finger_removed(timeout=timeout)
                self._hw_mark_ok()  # heartbeat : le capteur repond
                if gone:
                    return
            except Exception:
                pass
            time.sleep(0.3)

    def _post_identified(self, page_id, score):
        """POST le résultat d'identification à borne_pointage.php (sans lock série)."""
        payload = json.dumps({
            'identified': True,
            'page_id': int(page_id),
            'score': int(score),
            'ts': int(time.time()),
            'nonce': uuid.uuid4().hex,
        }).encode('utf-8')
        req = _urlreq.Request(
            self.api_url, data=payload, method='POST',
            headers={'Content-Type': 'application/json',
                     'X-Device-Token': self.borne_token},
        )
        try:
            with _urlreq.urlopen(req, timeout=20) as resp:
                body = json.loads(resp.read().decode('utf-8') or '{}')
                msg = body.get('message') or body.get('type') or 'ok'
                return True, resp.status, msg, body
        except _urlHTTPError as he:
            try:
                body = json.loads(he.read().decode('utf-8') or '{}')
            except Exception:
                body = {}
            return False, he.code, body.get('message') or (f'HTTP {he.code}'), body
        except Exception as e:
            return False, 0, str(e), {}

    def _api_base(self):
        """Base API dérivée de R307_API_URL (borne_pointage.php -> /api)."""
        url = (self.api_url or '').strip()
        if not url:
            return ''
        return url.rsplit('/', 1)[0] if '/' in url else url

    def _server_post(self, path, payload, timeout=15):
        """POST JSON authentifié vers le serveur (token + anti-rejeu)."""
        base = self._api_base()
        if not base or not self.borne_token:
            return False, 0, 'non configuré', {}
        body = dict(payload or {})
        body.setdefault('ts', int(time.time()))
        body.setdefault('nonce', uuid.uuid4().hex)
        req = _urlreq.Request(
            base + path, data=json.dumps(body).encode('utf-8'), method='POST',
            headers={'Content-Type': 'application/json',
                      'X-Device-Token': self.borne_token},
        )
        try:
            with _urlreq.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode('utf-8') or '{}')
                return True, resp.status, data.get('message') or 'ok', data
        except _urlHTTPError as he:
            try:
                data = json.loads(he.read().decode('utf-8') or '{}')
            except Exception:
                data = {}
            return False, he.code, data.get('message') or (f'HTTP {he.code}'), data
        except Exception as e:
            return False, 0, str(e), {}

    def _server_get(self, path, params=None, timeout=10):
        """GET authentifié vers le serveur (commandes en attente)."""
        base = self._api_base()
        if not base or not self.borne_token:
            return None
        url = base + path
        if params:
            url += '?' + '&'.join(f'{k}={v}' for k, v in params.items())
        req = _urlreq.Request(url, method='GET',
                              headers={'X-Device-Token': self.borne_token})
        try:
            with _urlreq.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode('utf-8') or '{}')
        except Exception:
            return None

    def _send_heartbeat(self):
        """État borne → serveur (badge « En service » distant + dernier
        événement pour le widget d'un autre appareil). Silencieux."""
        ok, _, _, _ = self._server_post('/sensor_heartbeat.php', {
            'device_id': os.getenv('R307_DEVICE_ID', 'r307_main'),
            'count': int(WATCH_STATE.get('count') or 0),
            'hw_ok': WATCH_STATE.get('hw_ok'),
            'watching': bool(WATCH_STATE.get('watching')),
            # Dernier événement détection (None si aucun) : le serveur
            # l'expose via sensor_status.php, branche « borne ».
            'last_detection': WATCH_STATE.get('last_detection'),
            'last_result': WATCH_STATE.get('last_result'),
        })
        return ok

    def _apply_server_command(self, cmd):
        """Applique un ordre serveur (set_mode / watch_on / watch_off)."""
        ctype = (cmd or {}).get('type', '')
        payload = (cmd or {}).get('payload') or {}
        if ctype == 'set_mode' and write_mode is not None:
            mode = payload.get('mode')
            target = payload.get('target_id')
            if mode in ('enrolement', 'pointage') and (mode == 'pointage' or target):
                write_mode(mode, target, 'serveur')
                return True
            return False
        if ctype in ('watch_on', 'watch_off'):
            enabled = (ctype == 'watch_on')
            if enabled and not WATCH_STATE.get('watch_enabled'):
                return False
            WATCH_STATE['watch_user_enabled'] = enabled
            try:
                sp = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'watch_state.json')
                with open(sp, 'w', encoding='utf-8') as f:
                    json.dump({'watch_user_enabled': enabled}, f)
            except Exception:
                pass
            if not enabled:
                WATCH_STATE['watching'] = False
            return True
        return False

    def _poll_commands(self):
        """Récupère + applique les ordres serveur, puis ACK. Jamais bloquant."""
        data = self._server_get('/borne_commandes.php',
                                {'device_id': os.getenv('R307_DEVICE_ID', 'r307_main')})
        if not isinstance(data, dict) or not data.get('ok'):
            return
        acked = []
        for cmd in data.get('commandes') or []:
            try:
                if self._apply_server_command(cmd) and cmd.get('id') is not None:
                    acked.append(int(cmd['id']))
            except Exception:
                pass
        if acked:
            self._server_post('/borne_commandes.php', {'ack_ids': acked}, timeout=10)

    def _link_loop(self):
        """Liaison PC → serveur : heartbeat ~15 s + ordres ~3 s. Sortant seul."""
        tick = 0
        while not STOP_EVENT.is_set():
            try:
                if tick % 5 == 0:
                    self._send_heartbeat()
                self._poll_commands()
            except Exception:
                pass
            tick += 1
            STOP_EVENT.wait(3.0)

    def _handle_detection(self, det):
        """Doigt détecté identifié → envoi serveur HORS lock série (jamais de
        deadlock : PHP peut rappeler le daemon pendant le POST)."""
        _, page_id, score = det
        ok, http_code, msg, body = self._post_identified(page_id, score)
        WATCH_STATE['last_detection'] = time.strftime('%Y-%m-%dT%H:%M:%S')
        # Numéro d'événement monotone : le widget temps réel détecte ainsi
        # chaque NOUVELLE détection (doigt posé / identifié / anti-double...).
        WATCH_STATE['_event_seq'] = WATCH_STATE.get('_event_seq', 0) + 1
        WATCH_STATE['last_result'] = {
            'page_id': page_id, 'score': score,
            'http': http_code, 'ok': ok, 'message': msg,
            'seq': WATCH_STATE['_event_seq'],
            'at': WATCH_STATE['last_detection'],
        }
        # Détails utiles au widget temps réel : nom de l'employé, type de
        # pointage (entree/sortie/pause), heure, délai anti-double.
        if isinstance(body, dict):
            for k in ('nom', 'type', 'heure', 'retry_after', 'user_id'):
                if body.get(k) is not None:
                    WATCH_STATE['last_result'][k] = body[k]
        # 404 « Aucune empreinte » et 409 anti-double sont normaux : silencieux.
        if not ok and http_code not in (404, 409):
            WATCH_STATE['last_error'] = f'API {http_code}: {msg}'

    def _watchdog_loop(self):
        interval = max(0.05, float(getattr(args_global, 'watch_interval', 0.10) or 0.10))
        while not STOP_EVENT.is_set():
            try:
                # Surveillance active seulement si : config présente + interrupteur
                # manuel ON + pas de capture (enrôlement) en cours.
                if not WATCH_STATE.get('watch_enabled') \
                        or not WATCH_STATE.get('watch_user_enabled', False) \
                        or CAPTURE_LOCK.locked():
                    WATCH_STATE['watching'] = False
                    time.sleep(0.3)
                    continue
                if not SERIAL_LOCK.acquire(timeout=2.0):
                    time.sleep(0.2)
                    continue
                detection = None
                try:
                    self._ensure_open()
                    mj = (read_mode() or {}) if read_mode else {}
                    if mj.get('mode') != 'pointage':
                        # Mode enrolement (ou fichier absent/corrompu hors pointage) : pause.
                        WATCH_STATE['watching'] = False
                        time.sleep(0.5)
                        continue
                    WATCH_STATE['watching'] = True
                    detection = self._resilient(self._detect_scan, finger_timeout=2.0)
                    # HEARTBEAT : ce cycle qui vient de réussir prouve que le
                    # capteur répond — /status s'appuiera dessus sans refaire
                    # d'I/O série (sinon il attend le lock et timeout côté PHP).
                    self._hw_mark_ok()
                    if time.time() - WATCH_STATE.get('_count_at', 0) > 30:
                        try:
                            self._hw_mark_ok(self._resilient(self.template_num))
                        except Exception:
                            pass
                finally:
                    # Modèle ancienne version : le port est REFERMÉ à chaque
                    # fin de cycle — entre deux cycles il est LIBRE pour toute
                    # autre opération (enrôlement, réconcilier, CLI...).
                    self._close_quiet()
                    SERIAL_LOCK.release()
                if detection:
                    if detection[0] == 'match':
                        self._handle_detection(detection)
                        # FIX anti-double : un doigt maintenu (ou re-scanne sans
                        # decoller) repostait toutes les ~2 s ; quand la fenetre
                        # anti-double (45 s) expirait, le cycle suivant
                        # enregistrait une sortie fantome - l'alerte doublon
                        # s'affichait mais le pointage passait quand meme.
                        # Desormais un doigt pose = UNE evaluation : on attend
                        # le retrait reel avant de reprendre la scrutation.
                        self._wait_finger_gone()
                    elif detection[0] == 'nomatch':
                        # Doigt inconnu posé : on attend le retrait sans POSTer.
                        # ÉVÉNEMENT complet pour le widget temps réel : seq
                        # croissant + http:404 (aucune correspondance) — sinon
                        # l'interface ne peut pas distinguer ce cas d'une
                        # scrutation sans doigt.
                        WATCH_STATE['_event_seq'] = WATCH_STATE.get('_event_seq', 0) + 1
                        WATCH_STATE['last_detection'] = time.strftime('%Y-%m-%dT%H:%M:%S')
                        WATCH_STATE['last_result'] = {
                            'message': 'Empreinte non reconnue',
                            'http': 404, 'seq': WATCH_STATE['_event_seq'],
                            'at': WATCH_STATE['last_detection'],
                        }
                        self._wait_finger_gone()
                time.sleep(interval)
            except Exception as e:
                WATCH_STATE['watching'] = False
                self._hw_mark_fail(e)
                # Session courte : le port est déjà refermé par le finally du
                # cycle — le prochain cycle repart d'une ouverture neuve
                # (l'équivalent du processus neuf de l'ancienne version).
                time.sleep(min(5.0, 0.5 * (WATCH_STATE.get('_fails', 0) + 1)))
                WATCH_STATE['_fails'] = WATCH_STATE.get('_fails', 0) + 1


class R307Watched(WatchMixin, R307):
    """R307 + boucle de surveillance + config API borne."""
    borne_token = None
    api_url = None


def _sigterm(signum, frame):
    STOP_EVENT.set()
    threading.Thread(target=os._exit, args=(0,), daemon=True).start()


# ---------------------------------------------------------------------------
# Serveur HTTP
# ---------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    # Toutes les actions capteur + gestion du mode. get-mode/set-mode ne
    # touchent pas le matériel (traités avant toute acquisition de lock).
    ACTIONS = ('enroll', 'search', 'verify', 'delete', 'status', 'count',
               'empty', 'get-mode', 'set-mode', 'enroll1', 'enroll2',
               'probe', 'template', 'watch-on', 'watch-off')

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if length else b'{}'
        try:
            data = json.loads(body)
        except Exception:
            data = {}
        action = self.path.strip('/').split('?')[0]
        if action not in self.ACTIONS:
            action = data.get('action', 'status')
        if action not in self.ACTIONS:
            self.send_json({'ok': False, 'message': 'action inconnue'}, code=400)
            return
        page_id = int(data.get('id') or data.get('page_id') or 0)
        try:
            # ── Interrupteur de surveillance : fichier/état seulement, aucun accès série ──
            if action in ('watch-on', 'watch-off'):
                enabled = (action == 'watch-on')
                if enabled and not WATCH_STATE.get('watch_enabled'):
                    self.send_json({'ok': False, 'message': 'Surveillance impossible : BORNE_TOKEN/R307_API_URL manquants'}, code=400)
                    return
                WATCH_STATE['watch_user_enabled'] = enabled
                # Persistance : l'interrupteur SURVIT au redémarrage du daemon
                # (sinon chaque relance réactivait la surveillance perdue).
                try:
                    sp = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'watch_state.json')
                    with open(sp, 'w', encoding='utf-8') as f:
                        json.dump({'watch_user_enabled': enabled}, f)
                except Exception:
                    pass
                if not enabled:
                    # Retour immédiat : la boucle abandonne son cycle en cours.
                    WATCH_STATE['watching'] = False
                self.send_json({'ok': True, 'watch_user_enabled': enabled,
                                'watching': bool(WATCH_STATE.get('watching')),
                                'message': 'Surveillance activée' if enabled else 'Surveillance désactivée'})
                return

            # ── Mode opératoire : fichier seulement, aucun accès série ──
            if action == 'get-mode':
                if read_mode is None:
                    raise RuntimeError('r307_cli introuvable')
                self.send_json({'ok': True, **read_mode()})
                return
            if action == 'set-mode':
                if write_mode is None:
                    raise RuntimeError('r307_cli introuvable')
                mode = data.get('mode')
                target_id = data.get('target_id') or data.get('id')
                updated_by = data.get('updated_by')
                if mode not in ('enrolement', 'pointage'):
                    self.send_json({'ok': False, 'message': 'mode invalide (enrolement|pointage)'}, code=400)
                    return
                if mode == 'enrolement' and not target_id:
                    self.send_json({'ok': False, 'message': 'target_id requis pour le mode enrolement'}, code=400)
                    return
                result = write_mode(mode, target_id, updated_by)
                self.send_json({'ok': True, **result})
                return

            if self.path == '/enroll_status':
                # Temps réel enrôlement : polling léger (≤ 1 s) — lecture directe.
                self.send_json({'ok': True, **ENROLL_STATE})
                return

            if R307 is None or r307_instance is None:
                raise RuntimeError('pyserial manquant ou capteur non initialisé')
            r = r307_instance

            # ── Enrôlement : section critique (suspend la surveillance) ──
            if action in ('enroll', 'enroll1', 'enroll2'):
                if not CAPTURE_LOCK.acquire(timeout=90):
                    self.send_json({'ok': False, 'message': 'Capteur occupé, réessayez'}, code=409)
                    return
                try:
                    self._do_enroll(r, action, page_id)
                except Exception as e:
                    # Échec capture → état clean pour l'UI (message d'erreur exposé).
                    _enroll_set(active=False, phase='idle', finger=False,
                                message='', error=f'Enrôlement échoué : {e}')
                    raise
                finally:
                    CAPTURE_LOCK.release()
                return

            # ── Actions simples : lock série + réouverture lazy par opération ──
            if action in ('search', 'verify'):
                with _serial_open_session(r, timeout=args_global.timeout + 10):
                    res = r.verify_once(timeout=args_global.timeout)
                if res:
                    self.send_json({'ok': True, 'page_id': res[0], 'score': res[1]})
                else:
                    self.send_json({'ok': False, 'message': 'Aucune correspondance'})
            elif action == 'delete':
                if page_id < 0 or page_id > 999:
                    raise RuntimeError(f'slot invalide {page_id}')
                with _serial_open_session(r, timeout=args_global.timeout + 10):
                    r.delete(page_id)
                self.send_json({'ok': True})
            elif action in ('status', 'count'):
                # HEARTBEAT + ANTI-OSCILLATION (cf. _hw_mark_fail) — ne JAMAIS
                # bloquer sur le lock série (le poll PHP timeout à 2 s) :
                # 1) Verdict frais (< 10 s, watch active ou vérif récente) →
                #    réponse immédiate depuis le cache.
                # 2) Sinon, lock libre → vérification live AVEC 1 retry après
                #    réouverture : sur CP2102 la 1re écriture après (re)ouverture
                #    échoue parfois (WinError 22) — sans retry, l'interface
                #    voyait « HS » à tort. C'est ce qui rendait la détection
                #    intermittente.
                # 3) Lock occupé (enrôlement/capture) → dernier verdict connu.
                now = time.time()
                fresh = (WATCH_STATE.get('hw_checked_at') is not None
                         and now - WATCH_STATE['hw_checked_at'] < 10)
                public = {k: v for k, v in WATCH_STATE.items() if not k.startswith('_')}
                if fresh:
                    ok = bool(WATCH_STATE.get('hw_ok'))
                    st = {'ok': ok, 'port': r.port}
                    if not ok:
                        st['message'] = WATCH_STATE.get('last_error') or 'Capteur indisponible'
                    self.send_json({**st, 'count': WATCH_STATE.get('count', 0), **public})
                    return
                got_lock = SERIAL_LOCK.acquire(timeout=0.1)
                if got_lock:
                    try:
                        cnt = r._resilient(r.template_num)
                        r._hw_mark_ok(cnt)
                    except Exception as e:
                        r._hw_mark_fail(e)
                        self.send_json({'ok': False, 'message': str(e), 'port': r.port, **public})
                        return
                    finally:
                        r._close_quiet()
                        SERIAL_LOCK.release()
                    self.send_json({'ok': True, 'count': WATCH_STATE.get('count', 0),
                                    'port': r.port, **public})
                    return
                # Lock occupé (enrôlement/capture en cours) : dernier verdict connu.
                ok = bool(WATCH_STATE.get('hw_ok'))
                st = {'ok': ok, 'port': r.port}
                if not ok:
                    st['message'] = WATCH_STATE.get('last_error') or 'Capteur occupé (capture en cours)'
                self.send_json({**st, 'count': WATCH_STATE.get('count', 0), **public})
            elif action == 'empty':
                with _serial_open_session(r, timeout=args_global.timeout + 30):
                    r.empty()
                self.send_json({'ok': True})
            elif action == 'probe':
                if page_id < 0 or page_id > 999:
                    raise RuntimeError(f'slot invalide {page_id} (0..999)')
                try:
                    with _serial_open_session(r, timeout=args_global.timeout + 10):
                        r.load(page_id, 1)
                    self.send_json({'ok': True, 'page_id': page_id, 'present': True})
                except Exception as e:
                    self.send_json({'ok': True, 'page_id': page_id, 'present': False, 'message': str(e)})
            elif action == 'template':
                if page_id < 1 or page_id > 999:
                    raise RuntimeError(f'slot invalide {page_id} (1..999)')
                with _serial_open_session(r, timeout=args_global.timeout + 20):
                    r.load(page_id, 1)
                    blob = r.up_char(1)
                self.send_json({'ok': True, 'page_id': page_id, 'size': len(blob), 'template': blob.hex()})
            else:
                self.send_json({'ok': False, 'message': 'action inconnue'}, code=400)
        except Exception as e:
            self.send_json({'ok': False, 'message': str(e)}, code=500)

    def _do_enroll(self, r, action, page_id):
        # Boucle de capture automatique : tant qu'aucun doigt n'est détecté,
        # GenImg est relancé (le driver renvoie ERR_NOFINGER en boucle) — la
        # requête ne « timeout » que sur un vrai échec matériel.
        def capture_until_finger(poll_cb, max_wait=90.0):
            t0 = time.time()
            attempt = 0
            while time.time() - t0 < max_wait:
                attempt += 1
                _enroll_set(finger=False, message=f'Scrutation {attempt} — posez le doigt…')
                try:
                    confirm, _ = r._cmd(CMD_GEN_IMG, timeout=1)
                except Exception as e:
                    _enroll_set(error=f'Erreur série : {e}')
                    raise
                if confirm == CONFIRM_OK:
                    _enroll_set(finger=True, message='Doigt détecté — conversion du gabarit…')
                    return
                if confirm != ERR_NOFINGER:
                    raise RuntimeError(f'GenImg erreur 0x{confirm:02X}')
                time.sleep(0.25)
            raise RuntimeError('Aucune empreinte détectée (attente interrompue)')

        if action == 'enroll':
            if page_id < 1 or page_id > 999:
                raise RuntimeError(f'slot invalide {page_id}')
            _enroll_set(active=True, phase='waiting_finger', step=0, captures_ok=0,
                        finger=False, error='', message='Enrôlement démarré — posez le doigt…')
            with _serial_open_session(r, timeout=180):
                r.enroll(page_id, timeout=args_global.timeout)
            self.send_json({'ok': True, 'page_id': page_id})
        elif action == 'enroll1':
            # Étape 1/2 : boucle de captures automatique → CharBuffer1 (le buffer
            # survit entre appels). mode.json est déjà 'enrolement'
            # (SdkReader::enrollStep1 fait set-mode avant d'appeler) → la
            # surveillance est en pause.
            _enroll_set(active=True, phase='waiting_finger', step=1, captures_ok=0,
                        finger=False, error='', message='Capture 1/2 — posez le doigt…')
            with _serial_open_session(r, timeout=args_global.timeout + 90):
                capture_until_finger(None)
                _enroll_set(phase='processing')
                r.img2tz(1)
            _enroll_set(phase='idle', captures_ok=1,
                        message='Capture 1 validée — retirez puis reposez le doigt')
            self.send_json({'ok': True, 'step': 1, 'message': 'Capture 1 validée — retirez puis reposez le doigt'})
        else:  # enroll2
            if page_id < 1 or page_id > 999:
                raise RuntimeError(f'slot invalide {page_id} (1..999)')
            _enroll_set(active=True, phase='waiting_finger', step=2, captures_ok=1,
                        finger=False, error='', message='Capture 2/2 — retirez puis reposez le doigt…')
            with _serial_open_session(r, timeout=args_global.timeout + 90):
                # Retrait du doigt attendu avant la 2e capture (anti-fusion même doigt).
                # Option B : 4 s max — si l'utilisateur n'a pas retiré le doigt
                # (retrait déjà fait pendant l'aller-retour HTTP, cas le plus
                # courant), on ne bloque pas 15 s : on capture le doigt présent.
                _enroll_set(phase='waiting_finger', message='Retirez le doigt…')
                r.wait_finger_removed(timeout=4.0)
                capture_until_finger(None)
                _enroll_set(phase='merging', finger=True,
                            message='Fusion des 2 captures (RegModel)…')
                r.img2tz(2)
                r.reg_model()
                _enroll_set(phase='saving', message='Stockage dans le capteur…')
                r.store(1, page_id)
            _enroll_set(phase='idle', active=False, captures_ok=2,
                        message=f'Empreinte stockée en page {page_id} — enrôlement terminé ✓')
            self.send_json({'ok': True, 'step': 2, 'page_id': page_id,
                            'message': f'Capture 2 validée — empreinte stockée page {page_id}'})

    def do_GET(self):
        if self.path in ('', '/'):
            self.path = '/status'
        self.do_POST()

    # CORS navigateur : la page (même en HTTPS Dokploy) pilote le daemon
    # localhost en cross-origin. Sans ces headers, le fetch est bloqué
    # (net::ERR_FAILED) alors même que le daemon répond. Écoute limitée à
    # 127.0.0.1 : aucun accès réseau externe.
    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.send_header('Content-Length', '0')
        self.end_headers()

    def send_json(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(b)))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(b)

    def log_message(self, fmt, *a):
        pass


def main():
    global r307_instance, args_global, WATCH_THREAD
    # Console Windows cp1252 : évite UnicodeEncodeError sur les messages accentués
    # quand la sortie est redirigée vers un fichier de log.
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    p = argparse.ArgumentParser()
    p.add_argument('--port', default='auto')
    p.add_argument('--baud', type=int, default=57600)
    p.add_argument('--timeout', type=int, default=15)
    p.add_argument('--password', default='00000000')
    p.add_argument('--host', default='127.0.0.1')
    p.add_argument('--http-port', type=int, default=8765)
    p.add_argument('--watch-interval', type=float, default=0.10,
                   help='pause entre 2 cycles de détection (0.3 = défaut, 0 désactive)')
    args = p.parse_args()
    args_global = args

    load_env()

    port = args.port
    if port == 'auto' and R307:
        port = R307.auto_detect() or 'COM3'
    pwd = args.password
    try:
        if pwd.lower().startswith('0x'):
            pwd = int(pwd, 16)
        else:
            pwd = int(pwd, 16) if len(pwd) == 8 and all(c in '0123456789abcdefABCDEF' for c in pwd) else int(pwd)
    except Exception:
        pwd = 0

    r307_instance = R307Watched(port=port, baud=args.baud, timeout=args.timeout, pwd=pwd)
    try:
        r307_instance.open()
    except Exception as e:
        print(f'R307 open échoué {port}: {e}')

    # ── Config de la surveillance (env/.env du projet) ──
    r307_instance.borne_token = os.getenv('BORNE_TOKEN', '')
    r307_instance.api_url = os.getenv('R307_API_URL', '')
    if args.watch_interval > 0 and r307_instance.borne_token and r307_instance.api_url:
        WATCH_STATE['watch_enabled'] = True
        # L'interrupteur manuel survit au redémarrage (watch_state.json écrit
        # par watch-on/watch-off) — sinon chaque relance réactivait la
        # surveillance alors que l'utilisateur l'avait désactivée.
        try:
            sp = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'watch_state.json')
            with open(sp, 'r', encoding='utf-8') as f:
                WATCH_STATE['watch_user_enabled'] = bool(json.load(f).get('watch_user_enabled', False))
        except Exception:
            pass
        signal.signal(signal.SIGTERM, _sigterm)
        signal.signal(signal.SIGINT, _sigterm)
        WATCH_THREAD = threading.Thread(target=r307_instance._watchdog_loop, daemon=True)
        WATCH_THREAD.start()
        # Liaison serveur (heartbeat + ordres) : 100 % sortante, même config.
        LINK_THREAD = threading.Thread(target=r307_instance._link_loop, daemon=True)
        LINK_THREAD.start()
        print(f'R307 surveillance ACTIVE (mode pointage) → {r307_instance.api_url}')
    else:
        reasons = []
        if args.watch_interval <= 0:
            reasons.append('--watch-interval 0')
        if not r307_instance.borne_token:
            reasons.append('BORNE_TOKEN manquant (.env)')
        if not r307_instance.api_url:
            reasons.append('R307_API_URL manquant (.env)')
        print(f'R307 surveillance DÉSACTIVÉE ({", ".join(reasons)}) — actions à la demande seules')

    srv = ThreadingHTTPServer((args.host, args.http_port), Handler)
    print(f'R307 service http://{args.host}:{args.http_port} port={port} baud={args.baud}')
    try:
        srv.serve_forever()
    finally:
        STOP_EVENT.set()
        try:
            r307_instance.close()
        except Exception:
            pass


if __name__ == '__main__':
    main()
