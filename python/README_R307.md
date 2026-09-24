# R307 + CP2102 — Intégration PHP -> Python -> Capteur

## Architecture
```
Frontend (empreintes.js -> api/biometric.php)  --POST enroll/scan-->
  -> SdkReader.php (transport daemon-first)
    -> [1] daemon r307_service.py  http://127.0.0.1:8765  (propriétaire du COM)
    -> [2] fallback exec("python python/r307_cli.py --port COM3 --action ...")
      -> r307_driver.py (0xEF01) -> CP2102 -> R307
      -> retour JSON {ok, page_id}
  -> PHP enregistre dans donnees_biometriques / pointages

Surveillance continue (mode pointage) :
  daemon --GenImg en boucle--> R307 (capteur actif)
  doigt détecté -> identification LOCALE (Img2Tz + Search → page_id + score)
  → POST api/borne_pointage.php {identified:true, page_id, score, ts, nonce}
  → PHP : décision entrée/sortie/pause, anti-double, INSERT pointages, audit
```

Python **ne touche jamais la BDD directement** : PHP reste le seul à écrire en base.

## Démarrer la surveillance (mode pointage)

1. Remplir dans `.env` : `BORNE_TOKEN` (token borne) et `R307_API_URL`
   (URL complète de `api/borne_pointage.php`, ex.
   `http://localhost/projet_Stage_MADA-Digital/api/borne_pointage.php`)
2. Lancer `python/start_r307_service.bat` (double-clic) — ou
   `py python/r307_service.py --port auto`
3. La fenêtre doit rester ouverte. Pour un démarrage automatique : créer un
   raccourci vers le .bat dans `shell:startup` (Win+R).

Sans daemon lancé, l'interface fonctionne en mode à la demande (fallback CLI)
 et la page Capteur affiche « Surveillance inactive ».

## Matériel
- R307 (optique) + CP2102 USB-UART, branché direct PC
- Baud 57600, adresse 0xFFFFFFFF, pwd 0x00000000 (par défaut R307)
- Port : `COM3` (ou `COM4`) — mettre `auto` pour détection CP2102 (VID 10C4:EA60)

## Installation PC
```bash
pip install -r python/requirements.txt  # pyserial
# Vérifier port
python python/r307_cli.py --list-ports
python python/r307_cli.py --port COM3 --action status
```

## Configuration
`config/biometric.php` :
```php
'driver' => 'r307',
'drivers' => ['r307' => [
  'port' => 'COM3',      // ou 'auto'
  'baud' => 57600,
  'python' => 'python',  // ou C:/Python312/python.exe
  'cli' => __DIR__ . '/../python/r307_cli.py',
]]
```

## Flux PHP

### Enrôlement (mode enrôlement)
Frontend `empreintes.php -> Enrôler` -> `POST api/biometric.php {action:enroll, userId:12}`
-> `SdkReader::enroll(12)` -> daemon (ou CLI) : set-mode enrolement → enroll1 → enroll2
-> R307 : `GenImg(pose1) -> Img2Tz(1) -> GenImg(pose2) -> Img2Tz(2) -> RegModel -> Store(1,page=slot)`
-> PHP stocke le gabarit chiffré AES-256-GCM dans `donnees_biometriques`

### Pointage (mode pointage)

**Avec daemon (recommandé)** : détection continue + identification locale,
POST `borne_pointage.php {identified:true,...}` → création `pointages`.

**À la demande (sans daemon)** : `POST api/biometric.php {action:scan}` ->
`SdkReader::scan()` -> `search` -> `GenImg -> Img2Tz(1) -> Search(1,0,1000)` ->
retour `page_id=12` -> `user_id=12` -> créer `pointages`

### Sans matériel (dev)
Si R307 non branché, `SdkReader` lève `R307 non branché` et `api/biometric.php` fallback simulé `bin2hex(random_bytes)` pour ne pas bloquer le dev.
Test mock : `python python/r307_cli.py --mock --action enroll --id 12`

## Test rapide sans capteur
```bash
python python/r307_cli.py --mock --action status
python python/r307_cli.py --mock --action enroll --id 1
python python/r307_cli.py --mock --action search
```

## Dépannage
- **« Le capteur ne s'allume pas »** -> le daemon n'est pas lancé : démarrer
  `python/start_r307_service.bat` et vérifier « Surveillance active » dans la
  page Capteur. La surveillance ne tourne QUE si `BORNE_TOKEN` + `R307_API_URL`
  sont dans `.env` et en mode **pointage**.
- `Réponse R307 invalide` -> mauvais port/baud, vérifier `Gestionnaire de périphériques -> Ports (COM)`
- `Aucune empreinte détectée` -> poser doigt, timeout 8s
- `VerifyPwd échoué` -> adresse/pwd non défaut, réinit R307
- Permission XAMPP `exec` : vérifier `php.ini` `disable_functions` ne bloque pas `exec`
- `HTTP 401 Borne non authentifiée` dans last_error du daemon -> `BORNE_TOKEN` du .env différent de celui attendu par l'API
