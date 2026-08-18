<?php

namespace App\Models;

use App\Core\Config;
use App\Core\Model;

class Pointage extends Model
{
    protected static string $table = 'pointages';

    public static function todayForUser(int $userId): ?array
    {
        $rows = self::query(
            'SELECT * FROM pointages
             WHERE user_id = ? AND DATE(date_pointage) = CURDATE()
             ORDER BY date_pointage DESC',
            [$userId]
        );
        return $rows[0] ?? null;
    }

    public static function entreesAujourdhui(): int
    {
        $rows = self::query(
            'SELECT COUNT(*) AS total FROM pointages WHERE DATE(date_pointage) = CURDATE()'
        );
        return (int) ($rows[0]['total'] ?? 0);
    }

    public static function retardsAujourdhui(): int
    {
        $rows = self::query(
            'SELECT COUNT(*) AS total FROM pointages
             WHERE DATE(date_pointage) = CURDATE() AND TIME(heure_entree) > ?',
            [Config::heureDebutOfficielle()]
        );
        return (int) ($rows[0]['total'] ?? 0);
    }

    public static function absentsAujourdhui(int $totalUsers): int
    {
        return max(0, $totalUsers - self::entreesAujourdhui());
    }
}