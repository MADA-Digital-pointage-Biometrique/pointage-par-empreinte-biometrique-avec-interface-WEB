<?php

namespace App\Models;

use App\Core\Model;

class Empreinte extends Model
{
    protected static string $table = 'empreintes';

    public static function findByMatricule(string $matricule): ?array
    {
        $rows = self::query(
            'SELECT e.*, u.matricule FROM empreintes e
             JOIN users u ON u.id = e.user_id
             WHERE u.matricule = ?',
            [$matricule]
        );
        return $rows[0] ?? null;
    }

    public static function forUser(int $userId): ?array
    {
        $rows = self::where('user_id', $userId);
        return $rows[0] ?? null;
    }
}