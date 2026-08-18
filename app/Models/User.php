<?php

namespace App\Models;

use App\Core\Model;

class User extends Model
{
    protected static string $table = 'users';

    public static function findByMatricule(string $matricule): ?array
    {
        $users = self::where('matricule', $matricule);
        return $users[0] ?? null;
    }

    public static function create(array $data): int
    {
        $data['password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        return parent::create($data);
    }
}