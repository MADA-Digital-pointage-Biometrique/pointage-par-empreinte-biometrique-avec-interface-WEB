<?php

// Double cible officielle (l'environnement tranche toujours) :
//  - dev local  : Supabase pooler  (DB_HOST=...pooler.supabase.com, DB_PORT=6543, DB_SSLMODE=require)
//  - prod Dokploy : Postgres interne (DB_HOST=<service>, DB_PORT=5432, DB_SSLMODE=disable)
// Les défauts ci-dessous ne servent qu'en l'absence totale de variables
// (et échouent bruyamment par design : fail-secure, jamais de connexion
// silencieuse non chiffrée).
return [
    'driver'   => getenv('DB_DRIVER') ?: 'pgsql',
    'host'     => getenv('DB_HOST') ?: 'aws-1-eu-west-1.pooler.supabase.com',
    'port'     => (int)(getenv('DB_PORT') ?: 6543),
    'dbname'   => getenv('DB_NAME') ?: 'postgres',
    // C2 : JAMAIS de secrets en dur. DB_USERNAME/DB_PASSWORD via .env (ignoré par git).
    // Sans eux, getDB() lève une 500 explicite au lieu de connecter un compte inconnu.
    'username' => getenv('DB_USERNAME') ?: '',
    'password' => getenv('DB_PASSWORD') ?: '',
    'charset'  => getenv('DB_CHARSET') ?: 'utf8',
    'sslmode'  => getenv('DB_SSLMODE') ?: 'require',
];