<?php

namespace App\Core;

use App\Models\User;

class Auth
{
    public static function login(string $matricule, string $password): bool
    {
        $users  = User::where('matricule', $matricule);
        $user   = $users[0] ?? null;

        if ($user && password_verify($password, $user['password'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            return true;
        }

        return false;
    }

    public static function logout(): void
    {
        session_unset();
        session_destroy();
    }

    public static function check(): bool
    {
        return isset($_SESSION['user_id']);
    }

    public static function user(): ?array
    {
        if (!self::check()) {
            return null;
        }
        return User::find((int) $_SESSION['user_id']);
    }

    public static function isAdmin(): bool
    {
        $user = self::user();
        return $user !== null && $user['role'] === 'admin';
    }
}