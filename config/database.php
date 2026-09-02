<?php

return [
    // Supabase Postgres via Transaction Pooler (plus rapide pour XAMPP)
    'driver'   => 'pgsql',
    'host'     => 'aws-1-eu-west-1.pooler.supabase.com',
    'port'     => 6543, // Transaction mode (6543) > Session 5432 pour serverless
    'dbname'   => 'postgres',
    'username' => 'postgres.essfbbsnjiomiijomwgi',
    'password' => 'Myproject_1234',
    'charset'  => 'utf8',
    'sslmode'  => 'require',
];