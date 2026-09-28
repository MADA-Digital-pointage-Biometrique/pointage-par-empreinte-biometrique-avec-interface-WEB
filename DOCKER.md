# Docker — Centrale VPS (borne R307 native)

Périmètre : l'image contient **la centrale PHP-Apache seule**.
BDD = Supabase externe. Borne = `python/r307_service.py` sur le PC Windows du capteur.

## 1. Test local (PC dev)

```bash
docker compose up -d --build
# http://localhost:8080/login — santé : /api/health.php (protégé : 403 anonyme normal)
# badge capteur : HS par design (pas de COM dans le conteneur)
```

## 2. Déploiement VPS ( rocky/ubuntu + Docker)

```bash
# Sur le VPS :
git clone <repo> && cd <repo> && git checkout project-final-version
cp .env.example .env
# 1) Renseigner DB_* (Supabase), APP_TZ=Indian/Antananarivo
# 2) COPIER APP_ENCRYPTION_KEY depuis le .env actuel (jamais régénérer :
#    les gabarits biométriques deviendraient illisibles).
#    Cas actuel : clé ABSENTE → repli dérivé de DB_PASSWORD (vérifié : 8/8
#    gabarits lisibles). Règle d'or dans ce cas : NE JAMAIS changer DB_PASSWORD
#    (sinon re-chiffrer ou ré-enrôler). Ne PAS ajouter une clé fraîche sans
#    migration : les gabarits existants deviendraient illisibles.
# 3) Générer des secrets frais (ne pas réutiliser les valeurs de dev) :
php -r "echo bin2hex(random_bytes(32)),\"\n\";"   # -> BORNE_TOKEN
php -r "echo bin2hex(random_bytes(32)),\"\n\";"   # -> CRON_SECRET
# 4) TRUSTED_PROXIES = sous-réseau du reverse-proxy (voir §3)
docker compose up -d --build
```

## 3. HTTPS + reverse-proxy (obligatoire en prod)

L'app écoute en HTTP sur `web:80`. Exemple minimal Caddy (TLS auto) :

```
votre-domaine.mg {
    reverse_proxy web:80
}
```

* `session.php` détecte déjà `X-Forwarded-Proto: https` (cookies `Secure`/`SameSite=None` auto).
* Rate-limits (login 5/IP, borne 20/min) utilisent `clientIp()` : renseigner
  `TRUSTED_PROXIES` avec le(s) CIDR du proxy (ex. `172.18.0.0/16`), sinon tous
  les clients partagent le même compteur. Sans proxy : laisser vide.
* Pare-feu VPS : n'exposer que `80/443` (et SSH). Ne jamais exposer le
  port du conteneur directement sans proxy.

## 4. Sessions & multi-comptes (important)

Un navigateur = une seule session (`PHPSESSID` partagé par tous les onglets) :
2 onglets du même compte = OK ; **2 comptes différents dans le même
navigateur = conflit** (le 2e login invalide la session du 1er).
Règle : 1 compte par navigateur — 2e compte = autre navigateur ou profil
séparé. Si ça arrive, l'app affiche désormais « Compte changé dans un
autre onglet » et propose un re-login propre au lieu de boucler.

Note : les sessions vivent dans `/tmp` du conteneur — `down`/rebuild =
tout le monde reconnecte. Accepté (évite la complexité des sessions BDD).

## 5. Borne Windows (hors Docker)

Sur le PC du capteur : `py -m pip install pyserial`, puis dans l'environnement
(`..\.env` lu par `start_r307_service.bat`) :
`BORNE_TOKEN` (identique au VPS) + `R307_API_URL=https://VOTRE-VPS/api/borne_pointage.php`,
lancer `python\start_r307_service.bat`. Horloge NTP obligatoire (anti-rejeu `ts ±120 s`).

## 6. Sauvegardes & restauration auto

* BDD : `database/schema.sql` + `database/data.sql` (dumps live, régénérables
  via `php` + PDO — voir historique Git).
* **Restauration auto au déploiement** : le service `db-init`
  (`php database/restore.php --auto`) rejoue le schéma à chaque `up` et ne
  charge les données qu'en base vide. `--force` (purge+recharge) réservé aux
  bases jetables — jamais sur la base live.
* Photos : volume `uploads_photos` (`docker volume backup` / `docker cp`).
* `.env` prod : à coffrer hors Git (jamais commité, `.gitignore`).

## 7. Variante Dokploy (PaaS)

> Erreur `port is already allocated` = le mapping `"8080:80"` du compose
> local entre en conflit avec Traefik. Sur Dokploy on utilise
> `docker-compose.dokploy.yml` (aucun port hôte, routage par domaine).

1. Dokploy : nouveau service **Compose**, provider Git, branche
   `project-final-version`, Compose Path `./docker-compose.dokploy.yml`.
2. Onglet **Environment** : `DB_HOST`, `DB_PORT=6543`, `DB_NAME=postgres`,
   `DB_USERNAME`, `DB_PASSWORD`, `DB_SSLMODE=require`, `BORNE_TOKEN` + 
   `CRON_SECRET` (frais, `random_bytes`), `APP_TZ=Indian/Antananarivo`.
   `APP_ENCRYPTION_KEY` : laisser absent (repli `DB_PASSWORD`, cf. §2 VPS).
   `TRUSTED_PROXIES` : défaut déjà large (RFC1918) pour Traefik.
3. Onglet **Domains** : service `web`, port `80`, votre domaine
   (DNS pointé vers le serveur, HTTPS auto). Redeployer après ajout.
4. Borne : `R307_API_URL=https://VOTRE-DOMAINE/api/borne_pointage.php`.
5. Vérifs : `/login` via le domaine, 1er déploiement = `db-init` crée
   structure + données (no-op ensuite).
