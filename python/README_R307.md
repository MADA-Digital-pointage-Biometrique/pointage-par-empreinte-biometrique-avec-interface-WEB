# R307 + CP2102 — Intégration PHP -> Python -> Capteur

## Architecture
```
Frontend (empreintes.js -> api/biometric.php)  --POST enroll/scan-->
  -> SdkReader.php (fromConfig: port COM3, 57600)
    -> exec("python python/r307_cli.py --port COM3 --action enroll --id 12")
      -> r307_driver.py (0xEF01) -> CP2102 -> R307
      -> retour JSON {ok, page_id}
  -> PHP enregistre dans donnees_biometriques / pointages
```

Python **ne touche jamais la BDD directement** : PHP reste le seul à écrire en MySQL (via `api/biometric.php` puis `donnees_biometriques`).

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
-> `SdkReader::enroll(12)` -> `python r307_cli.py --port COM3 --action enroll --id 12`
-> R307 : `GenImg(pose1) -> Img2Tz(1) -> GenImg(pose2) -> Img2Tz(2) -> RegModel -> Store(1,page=12)`
-> PHP stocke `R307:12:...` dans `donnees_biometriques`

### Pointage (mode pointage)
`POST api/biometric.php {action:scan}` -> `SdkReader::scan()` -> `python --action search`
-> `GenImg -> Img2Tz(1) -> Search(1,0,1000)` -> retour `page_id=12` -> `user_id=12` -> créer `pointages`

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
- `Réponse R307 invalide` -> mauvais port/baud, vérifier `Gestionnaire de périphériques -> Ports (COM)`
- `Aucune empreinte détectée` -> poser doigt, timeout 8s
- `VerifyPwd échoué` -> adresse/pwd non défaut, réinit R307
- Permission XAMPP `exec` : vérifier `php.ini` `disable_functions` ne bloque pas `exec`
