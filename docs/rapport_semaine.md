# Rapport de stage — Semaine R307 / Supabase

## 1. Objet

Migrer le pointage biométrique de MySQL XAMPP vers **Supabase Postgres** (pooler `aws-1-eu-west-1.pooler.supabase.com:6543`) et intégrer le capteur **R307 + CP2102** (57600 bauds, protocole `0xEF01`) piloté **PHP → Python** (`SdkReader` → `exec r307_cli.py`). Sécuriser l'enrôlement 2 captures et fiabiliser l'affichage d'état `HS/En service` temps réel.

Architecture actuelle : `frontend (login/dashboard/pointage/empreintes)` → `api/biometric.php|sensor_status.php|sensor_mode.php|borne_pointage.php` → `app/Core/Biometric/SdkReader.php` → `python/r307_cli.py|r307_driver.py` → R307, BDD `Supabase`, mode `python/mode.json`.

## 2. Activités réalisées (synthèse)

* **BDD** : `config/database.php` `pgsql` pooler, `pdo_pgsql` activé, `api/db.php` DSN dynamique + `statement_timeout 5s`, migration `biometric_slots` et `historique_pointages` + `pg_cron` archivage minuit
* **R307** : `python/r307_driver.py` (`_read_ack` valide header/PID_ACK/addr/len/checksum), `wait_finger_removed` entre 2 captures, `timeout`/`password` depuis `config/biometric.php`/`R307_PASSWORD` env, `python/r307_cli.py` `--timeout/--password`, `allocateSlot()` évite `min(999)` silencieux
* **Mode Opératoire** : `app.js:112`/`empreintes.js:77` défaut `pointage`, sync `sensor_mode.php` → `mode.json`, R307 idle si `enrolement` sans cible, `r307_service.py` daemon `127.0.0.1:8765` (lock COM)
* **Pointage** : `api/biometric.php` transaction `FOR UPDATE` entrée/sortie par jour, anti-double 45s `409`, score `threshold 60`, `borne_pointage.php` `X-Device-Token`
* **UI** : sidebar badge `Pointage` + `pointage.js` poll `sensor_status.php` 5s, `empreintes` notice `Capteur En service requis` + boutons désactivés si `HS`, fix flash `…` neutre, `login.php:23` `data-page/data-no-shell` fix boucle infinie

## 3. Livrables produits cette semaine

* `config/database.php`, `config/biometric.php`, `api/db.php`, `api/biometric.php`, `api/borne_pointage.php`, `api/sensor_status.php`, `api/sensor_mode.php`, `api/sync_offline.php`, `app/Core/Biometric/SdkReader.php`
* `python/r307_driver.py`, `python/r307_cli.py`, `python/r307_service.py`, `database/migration_biometric_slots.sql`, `database/migration_historique.sql`
* `frontend/login.php`, `frontend/empreintes.php`, `frontend/assets/js/app.js`, `frontend/assets/js/pages/pointage.js`, `frontend/assets/js/pages/empreintes.js`, `frontend/assets/css/app.css`
* `README.md` mis à jour, `docs/rapport_semaine.md` (ce fichier)

## 4. Tests effectués

* `api/health.php` → `connected` Supabase (`SELECT 1` Postgres 17.6)
* `sensor_status.php` → `hs` (`Port COM3 introuvable`) sans R307, `en_service` avec, `r307_cli.py --mock` OK
* `sensor_mode.php` GET/POST `pointage→enrolement` avec cible, `mode.json` vérifié
* `pointage` badge + sidebar synchrones `capteurStatusChanged`, `login` déconnexion sans boucle (`data-page` fix), `Lova Razafy` simulé supprimé (`empreinte=0`)

## 5. Difficultés rencontrées / points d'attention

* `db.essf...supabase.co:5432` ne résolvait pas → pooler `aws-1-...:6543` obligatoire
* `psycopg` manquant, `COM3` absent (driver CP2102 non installé), `pyserial` à installer
* `health.php` masquait l'erreur (`exit` dans `getDB()`), `vendor` volumineux retiré du suivi, `.env` à ignorer, `__pycache__` à nettoyer
* `Mode HS` : boutons restaient actifs si `fetch` échouait → désactivés par défaut jusqu'à preuve `En service`

## 6. Planification de la semaine prochaine

* Installer `CP2102` + `pyserial`, tester enrôlement réel 2 captures sur R307, réconciliation `biometric_slots` vs `template_num`
* Finaliser `r307_service.py` en service Windows, durcir `BORNE_TOKEN`/`R307_PASSWORD` env, `journal_audit` immuable + offline queue sync
* Exploiter `horaires_travail`/`affectations` pour `isRetard` tolérance, écran borne dédié

## 7. Conclusion

Semaine stabilisée : BDD Supabase opérationnelle, R307 pilotage Python sécurisé, pointage atomique et UI temps réel fonctionnels sans capteur (HS géré). Base prête pour tests matériels et durcissement sécurité la semaine prochaine.
