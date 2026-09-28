# MADA Digital — Centrale PHP-Apache (VPS entreprise)
# Périmètre : application WEB seule. BDD = Supabase externe, borne R307 = PC Windows natif.
FROM php:8.2-apache

# Extensions PHP requises : pgsql Supabase (pooler 6543, sslmode=require) via pdo_pgsql.
# Couche 1 (cacheable) : paquets système avec retries — le réseau vers les miroirs
# Debian peut être instable derrière certains pare-feu (2e tentative après 15 s).
RUN set -eux; \
    (apt-get update && apt-get install -y --no-install-recommends --fix-missing libpq-dev) \
    || (sleep 15 && apt-get update && apt-get install -y --no-install-recommends --fix-missing libpq-dev); \
    rm -rf /var/lib/apt/lists

# Couche 2 : compilation des extensions PHP (rejouée sans re-télécharger si le code change)
RUN set -eux; \
    docker-php-ext-install pdo_pgsql pgsql; \
    a2enmod rewrite headers; \
    php -m | grep -E '^(pdo_pgsql|pgsql)$'

# Fuseau entreprise (Madagascar UTC+3, cf. api/db.php APP_TZ)
ENV TZ=Indian/Antananarivo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /var/www/html
COPY . /var/www/html/

# ZAP : masque la version Apache (Server: Apache) — interdit en .htaccess.
# Préfixe zz- : charge APRES le security.conf Debian (ServerTokens OS) qui
# sinon écrase notre réglage (ordre alphabétique dans conf-enabled/).
RUN cp /var/www/html/docker/apache-security.conf /etc/apache2/conf-available/zz-mada-security.conf \
    && a2enconf zz-mada-security

# Cosmetique : supprime le warning AH00558 (ServerName indetermine -> IP du
# conteneur devine). Sans impact fonctionnel.
RUN echo "ServerName localhost" > /etc/apache2/conf-available/zz-mada-servername.conf \
    && a2enconf zz-mada-servername

# Racine Docker = / : le RewriteBase XAMPP (/projet_Stage_MADA-Digital/) devient /
RUN sed -i 's#RewriteBase /projet_Stage_MADA-Digital/#RewriteBase /#' /var/www/html/.htaccess

# Dossiers d'écriture (photos employés, tmp PHP) pour www-data
RUN mkdir -p /var/www/html/uploads/photos \
    && chown -R www-data:www-data /var/www/html/uploads \
    && chmod -R 775 /var/www/html/uploads

# Pas de .env dans l'image : fourni au runtime (compose env_file / secrets VPS)
EXPOSE 80
