# Pointage biométrique — MADA Digital (version dispositif générique)

Application de pointage par **empreinte (dispositif réseau / Wi-Fi)** + interface WEB, **Supabase Postgres** (pooler) au lieu de MySQL XAMPP.

## Architecture actuelle (semaine)

* **BDD** : `Supabase Postgres 17` via `aws-1-eu-west-1.pooler.supabase.com:6543` (Transaction Pooler), `sslmode=require`, `pdo_pgsql` (`config/database.php:5`)
* **Capteur** : dispositif biométrique **HTTP / Wi-Fi** générique, piloté **PHP → HTTP** via `app/Core/Biometric/HttpDeviceReader.php` (contrat JSON documenté en en-tête de classe, config `DEVICE_*` dans `config/biometric.php`) — aucun pilote local requis
* **Mode Opératoire du Terminal** : `frontend/assets/js/app.js` + `capteur.js` (`mada-mode` `localStorage`, défaut `pointage`), sync `api/sensor_mode.php` → `config/sensor_mode.json` (le dispositif réseau peut sonder le mode en GET avec `X-Device-Token`)
* **Pointage** : `api/biometric.php` transaction atomique `FOR UPDATE`, décision `entree/sortie` par `DATE(date_heure)`, `INSERT pointages` (`id_uuid_local`, `score_correspondance`, `device_id`, `NOW()`), anti-double 45s `409`, audit `journal_audit`
* **Slots** : `database/migration_biometric_slots.sql` table `biometric_slots(device_id,slot 0..999 UNIQUE)` — `HttpDeviceReader::allocateSlot()` (identifiants de gabarits, `507` si plein)
* **Score** : `scanWithScore()` → `threshold 60` (`config/biometric.php`) rejet si < seuil
* **Borne** : `api/borne_pointage.php` auth `X-Device-Token` (`BORNE_TOKEN` env), rate-limit, CSRF exempt (`api/db.php`), `api/sync_offline.php` queue UUID idempotent
* **UI** : sidebar badge `Capteur` → `HS`/`En service` temps réel (`sensor_status.php` poll 5s), `capteur` notice `Dispositif En service requis` + boutons désactivés si `HS`, `login.php` `data-page="login" data-no-shell="1"` fix boucle `login.php?v=Date.now()`

## Installation (XAMPP)

1. Copier dans `C:\xampp\htdocs\projet_Stage_MADA-Digital`
2. `php.ini` activer `extension=pdo_pgsql` + `extension=pgsql`, `Apache Restart`
3. `.env` depuis `.env.example` (`BORNE_TOKEN`, `DEVICE_BASE_URL`, `DEVICE_TOKEN`)
4. `config/biometric.php` : `base_url` = adresse HTTP du dispositif (vide = HS assumé)

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
