# MADA Digital — Centrale PHP-Apache (VPS entreprise)
# Périmètre : application WEB seule. BDD = Supabase externe, borne R307 = PC Windows natif.
FROM php:8.2-apache

# Extensions PHP requises : pgsql Supabase (pooler 6543, sslmode=require) via pdo_pgsql
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev \
    && docker-php-ext-install pdo_pgsql pgsql \
    && apt-get purge -y --auto-remove \
    && rm -rf /var/lib/apt/lists \
    && a2enmod rewrite headers

# Fuseau entreprise (Madagascar UTC+3, cf. api/db.php APP_TZ)
ENV TZ=Indian/Antananarivo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /var/www/html
COPY . /var/www/html/

# Racine Docker = / : le RewriteBase XAMPP (/projet_Stage_MADA-Digital/) devient /
RUN sed -i 's#RewriteBase /projet_Stage_MADA-Digital/#RewriteBase /#' /var/www/html/.htaccess

# Dossiers d'écriture (photos employés, tmp PHP) pour www-data
RUN mkdir -p /var/www/html/uploads/photos \
    && chown -R www-data:www-data /var/www/html/uploads \
    && chmod -R 775 /var/www/html/uploads

# Pas de .env dans l'image : fourni au runtime (compose env_file / secrets VPS)
EXPOSE 80
