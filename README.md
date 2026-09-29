# Pointage biométrique — MADA Digital

Application de pointage par **empreinte R307 + CP2102** (USB-UART) + interface WEB, **Supabase Postgres** (pooler) au lieu de MySQL XAMPP.

## Architecture actuelle (semaine)

* **BDD** : `Postgres` via `pdo_pgsql` — prod Dokploy = service interne (`5432`, `sslmode=disable`) ; dev local = `Supabase Postgres 17` pooler (`aws-1-eu-west-1.pooler.supabase.com:6543`, `sslmode=require`). Cible choisie par les 6 `DB_*` d’env (`config/database.php`, `.env.example` § variantes).
* **Capteur** : `R307` 57600 bauds, `CP2102` auto-detect, piloté **PHP → Python** `python/r307_cli.py` → `SdkReader.php` (`exec`), `python/r307_driver.py` protocole `0xEF01` (checksum, `_read_ack` validé, `wait_finger_removed`, `timeout`/`password` depuis `config/biometric.php`)
* **Mode Opératoire du Terminal** : `frontend/assets/js/app.js` + `empreintes.js` (`mada-mode` `localStorage`, défaut `pointage`), sync `api/sensor_mode.php` → `python/mode.json` + `.mode_trigger` (R307 idle si `enrolement` sans cible)
* **Pointage** : `api/biometric.php` transaction atomique `FOR UPDATE`, décision `entree/sortie` par `DATE(date_heure)`, `INSERT pointages` (`id_uuid_local`, `score_correspondance`, `device_id`, `NOW()`), anti-double 45s `409`, audit `journal_audit`
* **Slots** : `database/migration_biometric_slots.sql` table `biometric_slots(device_id,slot 0..999 UNIQUE)` — `SdkReader::allocateSlot()` évite `min(999)` silencieux (`507` si plein)
* **Score** : `scanWithScore()` → `threshold 60` (`config/biometric.php:17`) rejet si < seuil
* **Borne** : `api/borne_pointage.php` auth `X-Device-Token` (`BORNE_TOKEN` env), rate-limit, CSRF exempt (`api/db.php:131`), `api/sync_offline.php` queue UUID idempotent
* **Service local** : `python/r307_service.py` `http://127.0.0.1:8765` **propriétaire unique du COM** — surveillance continue du capteur en mode pointage (détection doigt → identification locale → POST `borne_pointage.php`), lock unique (fin des conflits poll 5s / scans), lancer via `python/start_r307_service.bat` (nécessite `BORNE_TOKEN` + `R307_API_URL` dans `.env`)
* **Transport SdkReader** : daemon-first (`R307_SERVICE_URL`) avec fallback `exec` CLI — l'UI affiche « Surveillance active/inactive » (page Capteur, `sensor_status.php`)
* **UI** : sidebar badge `Pointage` → `HS`/`En service` temps réel (`sensor_status.php` + `pointage.js:88` poll 5s), `empreintes` notice `Capteur En service requis` + boutons désactivés si `HS`, flash `HS→En service` fixé (`…` neutre), `login.php:23` `data-page="login" data-no-shell="1"` fix boucle `login.php?v=Date.now()`

## Installation (XAMPP)

1. Copier dans `C:\xampp\htdocs\projet_Stage_MADA-Digital`
2. `php.ini` activer `extension=pdo_pgsql` + `extension=pgsql`, `Apache Restart`
3. `py -m pip install pyserial`
4. `.env` depuis `.env.example` (`BORNE_TOKEN`, `R307_PASSWORD`)
5. `config/biometric.php:12` `port` = `COMx` ou `auto`, `python` chemin
6. Surveillance capteur : `python\start_r307_service.bat` (ou `py python/r307_service.py --port auto`) — obligatoire pour la détection continue des doigts en mode pointage. Autostart : raccourci du .bat dans `shell:startup`

BDD déjà sur Supabase — si vide : `psql < database/migration_biometric_slots.sql`

## Accès

* `http://localhost/projet_Stage_MADA-Digital/frontend/login.php` (`ADM001/admin123`)
* Santé : `api/health.php` (`connected` si Supabase OK), `api/sensor_status.php` (`hs`/`en_service`)

## Pages

`login.php` `dashboard.php` `pointage.php` (poll capteur) `empreintes.php` (mode + 2 captures) `employes.php` `historique.php` (archivage `pg_cron` minuit `historique_pointages`)

## Comptes démo

| Matricule | mdp | rôle |
|-----------|-----|------|
| `ADM001` | `admin123` | super_admin |
