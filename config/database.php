<?php

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