# Docker — Centrale VPS (borne R307 native)

Périmètre : l'image contient **la centrale PHP-Apache seule**.
BDD = Supabase externe. Borne = `python/r307_service.py` sur le PC Windows du capteur.

## 1. Build + run

```bash
cp .env.example .env   # puis renseigner DB_*, APP_ENCRYPTION_KEY, BORNE_TOKEN, CRON_SECRET
docker compose up -d --build
# local : http://localhost:8080/login — santé : /api/health.php
```

## 2. Points d'attention VPS

* HTTPS : terminer TLS au reverse-proxy (Nginx/Traefik) devant `web:80`.
* `.htaccess` : le `RewriteBase /projet_Stage_MADA-Digital/` XAMPP est réécrit en `/`
  au build — ne pas modifier le fichier local.
* `R307_SERVICE_URL=""` (compose) désactive la sonde daemon dans le conteneur ;
  le badge capteur affichera `HS` côté serveur, normal : le pointage passe par la borne.
* Photos : volume `uploads_photos` (le `.htaccess` anti-webshell est baked dans l'image).
* `APP_ENCRYPTION_KEY` : figée, jamais régénérée (gabarits illisibles sinon).

## 3. Borne Windows (hors Docker)

Sur le PC du capteur : `py -m pip install pyserial`, renseigner dans l'environnement
`BORNE_TOKEN` (identique au VPS) + `R307_API_URL=https://VOTRE-VPS/api/borne_pointage.php`,
lancer `python\start_r307_service.bat`. Horloge NTP obligatoire (anti-rejeu `ts ±120 s`).
