# Documentation — Flux biométriques complets (enrôlement & pointage)

> MADA Digital — Terminal biométrique R307 (ZFM, 57600 bauds, COM5)
> Document généré à partir du code réel (sources citées à chaque étape).
> Dernière mise à jour : 23/09/2026 — inclut le plafond 2 entrées / 2 sorties,
> la table `heures_mensuelles` et le fuseau applicatif UTC+3.

---

## 0. Architecture d'ensemble

```
┌──────────────┐ USB/série   ┌──────────────────┐ HTTP 127.0.0.1:8765 ┌──────────────┐
│  CAPTEUR     │◄───────────►│  DAEMON PYTHON   │◄───────────────────►│  API PHP     │
│  R307 (COM5) │             │  r307_service.py │                     │  (XAMPP)     │
└──────────────┘             │  + r307_driver   │                     └──────┬───────┘
                             └────────┬─────────┘                            │
                                      │ POST /borne_pointage.php             │ SQL (PDO)
                                      │ header X-Device-Token                ▼
                                      │ (BORNE_TOKEN, .env)           ┌──────────────┐
                                      └──────────────────────────────►│  SUPABASE    │
                                                                      │  PostgreSQL  │
                                                                      └──────────────┘
 Navigateur ── poll 1 s ──► api/sensor_status.php ── HTTP ──► daemon /status et /enroll_status
```

| Composant | Fichier | Rôle |
|---|---|---|
| Capteur R307 | — | Capture optique, bibliothèque flash 999 slots, 2 buffers de travail (CharBuffer1/2) |
| Driver Python | `python/r307_driver.py` | Protocole série (paquets HEADER/PID/ADDR/LEN/CRC), commandes brutes |
| Daemon | `python/r307_service.py` | Serveur HTTP threadé (port 8765) : surveillance + enrôlement + verrou série |
| API web | `api/biometric.php` | Scan web, enrôlement (step1/step2), purge, réconciliation, `enroll_status` |
| API borne | `api/borne_pointage.php` | Pointage depuis le daemon (auth par token, sans session) |
| Service partagé | `app/Core/PointageService.php` | Décision entrée/sortie, anti-double, plafond journalier, insertion |
| Heures | `app/Core/WorkHours.php` | Calcul des sessions et totaux mensuels (`heures_mensuelles`) |
| Chiffrement | `app/Core/Crypto.php` | AES-256-GCM (format ENC1) des gabarits en base |
| Widget temps réel | `frontend/assets/js/pages/sensor-live.js` | Badge flottant sur toutes les pages (poll 1 s) |
| Page capteur | `frontend/assets/js/pages/capteur.js` | Modes, enrôlement, bandeau temps réel du modal |

**Verrou série global** (`SERIAL_LOCK`) : une seule opération parle au capteur à la fois.
Le watchdog **pause** sa surveillance en mode enrôlement (lecture de `mode.json` à chaque
cycle) et pendant `CAPTURE_LOCK` — pas de course entre les deux flux.

**Mode opératoire** : `python/mode.json` = `{"mode": "pointage"|"enrolement", "target_id": ?}`.
Chaque cycle de surveillance le relit : mode ≠ pointage → surveillance en pause.

---

## 1. FLUX 1 — ENRÔLEMENT

### 1.1 Prérequis et préparation

1. Admin (super-admin requis) → page **Capteur** → mode **Enrôlement** → sélection de l'employé cible.
2. Front : `POST biometric.php action=set_mode` → `mode.json` = `{mode: "enrolement", target_id: N}`.
   → le **watchdog se met en pause** au cycle suivant (≤ 0,4 s) : le port série est libéré.
3. Clic **« Lancer l'enrôlement »** → le widget temps réel se masque (surveillance inactive).
4. `POST biometric.php action=enroll_start` :
   - **Allocation du slot** : première page libre de la bibliothèque R307
     (`template_num` → pages occupées → plus petit slot libre).
   - **Upsert `biometric_slots`** (device_id=`r307_main`, slot_number, id_employe) — **avant** la capture :
     si le process meurt, la réconciliation voit le mapping et purgera l'orphelin.
   - `set-mode` (idempotent) puis `POST daemon /enroll1`.

### 1.2 Algorithme — Capture 1 (daemon `/enroll1`)

```
ENROLL_SET(active, phase='waiting_finger', step=1, captures_ok=0)
OUVRIR session série (timeout global = args.timeout + 90 s)
BOUCLE capture_until_finger (max 90 s) :
    ENROLL_SET(message=f"Scrutation {n} — posez le doigt…")         # → /enroll_status
    GenImg (0x01)                                                   # image → frame buffer
    ├─ CONFIRM_OK         → ENROLL_SET(finger=True, "Doigt détecté…") ; SORTIR
    ├─ ERR_NOFINGER (0x02) → sleep 0,25 s ; CONTINUER                # scrutation ~4 Hz
    └─ autre code          → ERREUR fatale (matériel) ; ABANDONNER
Img2Tz(1)                        # frame buffer → gabarit partiel dans CharBuffer1
FERMER session
ENROLL_SET(phase='idle', captures_ok=1, "Capture 1 validée — retirez puis reposez le doigt")
RÉPONDRE {ok, step:1, slot, timeout:15}      # le front enchaîne step2 IMMÉDIATEMENT
```

- Le gabarit partiel **survit dans la RAM du capteur** entre les deux requêtes HTTP
  (CharBuffer1 n'est pas effacé tant qu'on ne le réécrit pas).
- Toute exception → `ENROLL_SET(error=…)` + réponse 500 avec `err:'timeout'` si transient
  → **relance automatique côté front** (`enrollWithAutoRetry`, ≤ 10 essais, détection par
  message ; les erreurs fatales — port, employé inactif, slot — arrêtent tout).

### 1.3 Algorithme — Capture 2 (daemon `/enroll2`)

```
ENROLL_SET(step=2, captures_ok=1, "Capture 2/2 — retirez puis reposez le doigt…")
OUVRIR session série
PHASE retrait (anti-fusion du même doigt) :
    ENROLL_SET("Retirez le doigt…")
    wait_finger_removed(timeout=4 s)             # GenImg toutes les 0,2 s
    ├─ ERR_NOFINGER avant 4 s → OK (doigt retiré)
    └─ timeout 4 s            → continuer quand même (option B : ne pas bloquer)
PHASE capture : capture_until_finger (cf. 1.2, ~0,3 s si doigt déjà posé)
Img2Tz(2)                        # 2e gabarit partiel → CharBuffer2
ENROLL_SET(phase='merging', "Fusion des 2 captures (RegModel)…")
RegModel (0x05)                  # croise CharBuffer1 × CharBuffer2 → gabarit 512 o
    └─ échec (images trop identiques / qualité faible) → erreur, slot réutilisable
ENROLL_SET(phase='saving', "Stockage dans le capteur…")
Store(1, slot) (0x06)            # gabarit → bibliothèque flash, page = slot
FERMER session
ENROLL_SET(phase='idle', active=False, captures_ok=2,
           "Empreinte stockée en page {slot} — enrôlement terminé ✓")
RÉPONDRE {ok, step:2, page_id}
```

### 1.4 Persistance côté serveur (`biometric.php` action=enroll_step2)

```
UpChar(2)                        # gabarit 512 o : flash → daemon → PHP (hex)
TRANSACTION PostgreSQL :
    Crypto::encryptHex(hex)      # → "ENC1" || IV(12) || TAG(16) || CHIFFRÉ (AES-256-GCM)
    upsert donnees_biometriques (type_biometrie='empreinte', statut='actif',
                                algorithme='R307_ZFM_UPCHAR_512_AESGCM')
    id_appareil_enrolement = resolveAppareilId()   ← HORS transaction (savepoint-safe)
COMMIT
auditLog 'enrolement_termine'    (journal_audit)
```

**3 stockages synchronisés** : flash R307 (page N) ↔ `biometric_slots` (mapping) ↔
`donnees_biometriques` (gabarit chiffré, RGPD Art. 9). La base est la source de vérité
d'activité : une empreinte présente en flash mais inactive en base → pointage refusé
(`assertEmpreinteActive` → « Empreinte révoquée »).

### 1.5 Temps réel, robustesse, nettoyage

- **Bandeau live du modal** : `poll 1 s` sur `biometric.php action=enroll_status` →
  proxy HTTP vers daemon `GET /enroll_status` (serveur threadé → répond **pendant** la capture).
  Machine à états : `idle` / scrutation (vert, icône battante, n° de scrutation) /
  doigt détecté (vert fixe) / échec transient (rouge, secousse) / offline.
  Compteur de captures réussies à droite. Disparaît au succès final ou à la fermeture.
- **Réconciliation slots** (bouton capteur) : compare mapping BDD ↔ pages réellement
  occupées en flash ; propose la purge des mappings orphelins (`repair=1`).
- **Suppression par employé** (🗑) : `Delete(slot)` flash + `biometric_slots` + `donnees_biometriques`.
- **« Tout supprimer »** (super-admin, double confirmation) : `Empty` (999 pages) +
  purge des 2 tables + audit `purge_totale_biometrie`.

### 1.6 Pourquoi 2 captures ?

`RegModel` croise les minuties (bifurcations, terminaisons de crêtes) des deux poses et
ne garde que celles confirmées **aux deux** — le gabarit final décrit le cœur stable de
l'empreinte, débarrassé des artefacts d'une pose unique (pression, décalage, sécheresse).
→ moins de faux refus, moins de fausses acceptations. Le retrait du doigt entre les deux
captures est indispensable (2 images identiques = fusion sans valeur, voire refusée).

---

## 2. FLUX 2 — POINTAGE

### 2.1 Algorithme — Surveillance (watchdog du daemon, thread dédié)

```
BOUCLE (toutes les `interval` = 0,10 s) :
    SI surveillance désactivée (interrupteur UI) OU CAPTURE_LOCK pris → dormir 0,3 s ; continuer
    SI SERIAL_LOCK indisponible (2 s max) → dormir 0,2 s ; continuer
    OUVRIR session série ; lire mode.json
    SI mode ≠ 'pointage' → watching=false ; dormir 0,5 s ; continuer           # pause enrôlement
    watching=true
    DETECTION = _detect_scan(finger_timeout=2,0) :
        BOUCLE 2 s (GenImg toutes les 0,10 s) :
            GenImg → NOFINGER → continuer ; OK → doigt présent :
                Img2Tz(1)
                Search : HighSpeedSearch (0x1B) si supporté, sinon 0x04 (repli permanent)
                ├─ trouvé (page_id, score) → ('match', page_id, score)
                └─ aucun        → ('nomatch',)
        (rien en 2 s) → None
    marquer le matériel OK (heartbeat allégé : vérif approfondie toutes les 30 s seulement)
    FERMER session (port LIBRE entre les cycles — modèle « ancienne version »)
    SI 'match' :
        POST serveur (HORS lock série) → cf. 2.2
        ATTENDRE LE RETRAIT RÉEL du doigt (_wait_finger_gone)                 # fix anti-double
    SI 'nomatch' :
        ENREGISTRER l'événement (seq++ ; last_result={message:"Empreinte non reconnue", http:404})
        ATTENDRE le retrait du doigt                                          # pas de spam 404
    SI exception : marquer HS, backoff progressif (0,5 s × nb échecs, max 5 s), session neuve
```

**Chronologie d'un pointage** : détection ≤ 0,1–0,5 s + identification ~0,3 s
(HighSpeedSearch) + POST Supabase 1–2 s + widget poll 1 s → **visible en ~1,2–1,8 s**.

### 2.2 Algorithme — Réception serveur (`borne_pointage.php`)

```
AUTH : header X-Device-Token (ou Bearer) == BORNE_TOKEN (.env), hash_equals, fail-closed
       (pas de token configuré → 500 ; token faux → 401). CSRF exempté (machine, pas navigateur).
ANTI-REJEU : rate limit par IP — ≥ 0,8 s entre 2 POST, max 20/min → 429.
REVALIDATION (pas de confiance aveugle dans le résultat capteur) :
    identified=true ? page_id ∈ [0..999] et score ≥ seuil config, sinon scan direct
    (chemin fallback CLI, sans daemon)
RÉSOLUTION EMPLOYÉ : SELECT id_employe FROM biometric_slots WHERE slot_number=? AND device_id=?
EMPLOYÉ ACTIF ? (assertEmployeActif) — sinon 403
EMPREINTE ACTIVE en base ? (assertEmpreinteActive) — sinon 403 « Empreinte révoquée »
(seuil de score : config biometric 'threshold', 60 par défaut)
ANTI-DOUBLE : dernier pointage toutes tables ; si < anti_double_seconds (45 s par défaut)
              → 409 {message, retry_after}           # le daemon reste silencieux sur 409
RECORD (PointageService::recordScanPointage) → cf. 2.3
RÉPONDRE {ok, user_id, nom, type, score, heure}
```

L'API web (`biometric.php action=scan`) suit la même logique pour un scan déclenché
depuis le navigateur (auth par session admin au lieu du token).

### 2.3 Algorithme — Enregistrement (`PointageService::recordScanPointage`)

```
TRANSACTION :
    SELECT statut FROM employes WHERE id_employe=? FOR UPDATE      # verrou : sérialise
                                                                   # les scans concurrents
    PLAFOND : COUNT(pointages du jour) ≥ 4 → DomainException
              « Journée complète (2 entrées / 2 sorties) »          # refus net du 5e
    DERNIER TYPE du jour : typeForLast :
        (null | sortie | pause_fin) → 'entree'    sinon → 'sortie'  # règle unique web+borne
    resolveAppareilId()    # savepoint-safe : un échec SQL ici n'abort pas la transaction
    INSERT pointages (id_uuid_local=UUIDv4, type, date_heure=NOW(), methode='empreinte',
                      score, source='serveur', statut='valide')
    auditBorne 'borne_entree'/'borne_sortie'
COMMIT
cacheClear dash_today / 7d / 30d            # dashboard
WorkHours::recalcMonth(employé, mois)       # total heures_mensuelles mis à jour (non bloquant)
→ {type, uuid}
```

**Cas 409** (anti-double) : aucun enregistrement — le daemon le sait silencieusement ;
le widget continue d'afficher le dernier état valide.

### 2.4 Widget temps réel (`sensor-live.js`)

- Poll **1 s** de `sensor_status.php` (proxy daemon `/status`, heartbeat ≤ 30 s, `hw_ok`).
- Détection de NOUVELLE détection par **`seq` monotone** du daemon : chaque événement
  (match, nomatch, anti-double) incrémente `seq` → le widget joue l'événement une seule fois.
- Machine à états : **En service** (vert) / **HS** (rouge, daemon ou capteur injoignable) /
  **Surveillance OFF** (gris) ; mini-historique ; minimiser/fermer persistants (`localStorage`) ;
  jamais injecté sur la page de connexion. Fermeture du modal d'enrôlement → arrêt du poll dédié.

### 2.5 Heures de travail mensuelles (`WorkHours`)

```
recalcMonth(employé, mois) :
    UNION pointages + historique_pointages (l'archive nocturne reste comptée)
    TRI chronologique des événements du mois
    secondsFromEvents : machine à états
        entree      → ouvre une session (t)
        pause_debut → ferme la session en cours, entre en pause
        pause_fin   → sort de pause, rouvre une session
        sortie      → ferme la session
        (sessions bornées au [1er du mois, 1er du mois suivant) — les sessions
         à cheval sont réparties sur les 2 mois)
    UPSERT heures_mensuelles (total_secondes, nb_pointages, calcule_le=NOW())
```

Déclencheurs : chaque pointage scan (2.3), chaque création/modification manuelle
(POST/PUT `pointages.php`), script de migration (backfill de tous les mois passés :
`php database/migration_heures_mensuelles.php --backfill`).
Panneau **« Heures de travail du mois »** en haut de la page Pointage :
`GET pointages.php?totals=1` → `monthTotals()` (employés actifs + « Employé #N » si supprimé).

### 2.6 Journée à 2 paires + édition manuelle

- **Plafond** : 2 entrées / 2 sorties (4 pointages) par jour — imposé côté capteur
  (2.3), côté création manuelle (POST, 409 si 4 déjà présents ou > 2 par type) et
  côté modification (PUT, même contrôle).
- **Vue** : la liste groupe par employé × jour (`ROW_NUMBER()` par chronologie) et
  expose `entree, sortie, entree2, sortie2, total_secondes` ; affichage `e1 → s1 → e2 → s2`
  (2ᵉ paire masquée si absente) + colonne **Total**.
- **PUT** : sémantique « clés absentes = inchangées » (l'éditeur sans champs paire 2 ne
  la détruit pas) ; upsert par position ordonnée (index 0/1 par type) ; suppression si champ vidé.
- **Création manuelle** : date passée → le pointage va dans la table active, la page
  Historique lit l'union actif+archive (donc visible immédiatement).

### 2.7 Archivage nocturne

```
archive_pointages()   (plpgsql, pg_cron '0 0 * * *' ou api/cron_archive.php) :
    INSERT INTO historique_pointages SELECT *, NOW() FROM pointages WHERE date_heure::date < CURRENT_DATE
    DELETE FROM pointages  WHERE date_heure::date < CURRENT_DATE
```

Toutes les lectures de flux (totaux, historique, heures mensuelles) lisent l'UNION
des deux tables — l'archivage est donc invisible pour l'utilisateur.

### 2.8 Fuseau horaire (règle des heures)

`api/db.php` pose **le fuseau applicatif à chaque requête** :
`APP_TZ` (.env) sinon `Indian/Antananarivo` (UTC+3) ; `php.ini` aligné.
La session PostgreSQL suit (`SET TIME ZONE`) → `NOW()` écrit l'heure locale réelle,
et les regroupements par jour (`date_heure::date`) sont faits dans le même fuseau.
⚠️ Le pointage utilise l'horloge du **serveur** (Supabase évalue NOW() en UTC absolu,
affiché selon le fuseau de session) : la référence est le serveur, pas la borne.

---

## 3. Références rapides

### Tables

| Table | Contenu |
|---|---|
| `employes` | Employés (`id_employe`, matricule, statut) |
| `biometric_slots` | Mapping slot flash ↔ employé (device_id, slot_number) |
| `donnees_biometriques` | Gabarits chiffrés ENC1 (type, statut, algorithme) |
| `pointages` | Pointages du jour (CHECK type, UUID unique, FK employé) |
| `historique_pointages` | Archive nocturne (LIKE pointages + archived_at) |
| `heures_mensuelles` | PK (id_employe, mois) — total_secondes, nb_pointages |
| `journal_audit` | Piste d'audit (scan_*, borne_*, enrolement_*, purge_*) |

### Endpoints du daemon (127.0.0.1:8765)

Routage : l'action vient du chemin (`/enroll1`) ou du corps JSON (`{"action": ...}`) —
même table d'actions dans les deux cas (`ACTIONS`, r307_service.py:432).

| Route / action | Rôle |
|---|---|
| `GET /status` | État (ok, port, count, watching, hw_ok, last_result, last_error) |
| `POST /set-mode` · `/get-mode` | Écrit/lit `mode.json` (pointage / enrolement+target) — sans accès série |
| `POST /watch-on` · `/watch-off` | Interrupteur de surveillance (fichier/état, aucun accès série) |
| `POST /enroll1`, `/enroll2` | Captures d'enrôlement (boucle auto, longues) |
| `GET /enroll_status` | État temps réel de l'enrôlement en cours |
| `POST /search`, `/verify`, `/template`, `/probe`, `/count` | Diagnostics et fallback CLI |
| `POST /delete`, `/empty` | Suppression slot unique / purge bibliothèque |

### Garde-fous transverses

- Verrou série + pauses croisées (watchdog ↔ enrôlement) → aucune collision port.
- Fail-closed partout (BORNE_TOKEN, CSRF, rôle super-admin pour purge).
- Audit non bloquant (un échec d'audit ne fait jamais échouer un pointage).
- Relance auto des captures transient (≤ 10), refus net des erreurs fatales.
- Réconciliation base ↔ flash pour converger après tout incident matériel.
