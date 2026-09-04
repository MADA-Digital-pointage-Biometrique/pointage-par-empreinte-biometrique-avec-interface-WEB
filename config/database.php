<?php

return [
    'driver'   => getenv('DB_DRIVER') ?: 'pgsql',
    'host'     => getenv('DB_HOST') ?: 'aws-1-eu-west-1.pooler.supabase.com',
    'port'     => (int)(getenv('DB_PORT') ?: 6543),
    'dbname'   => getenv('DB_NAME') ?: 'postgres',
    'username' => getenv('DB_USERNAME') ?: 'postgres.essfbbsnjiomiijomwgi',
    'password' => getenv('DB_PASSWORD') ?: 'Myproject_1234',
    'charset'  => getenv('DB_CHARSET') ?: 'utf8',
    'sslmode'  => getenv('DB_SSLMODE') ?: 'require',
];