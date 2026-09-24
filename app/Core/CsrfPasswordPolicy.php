<?php

/**
 * Helpers CSRF + politique mot de passe, testables sans session ni serveur web.
 * Namespace GLOBAL volontaire : appelés sans préfixe par api/*.php (contrat
 * identique à l'ancien code inline de api/db.php).
 * api/db.php requiert ce fichier — fonctions définies UNE seule fois.
 */

const PASSWORD_BCRYPT_COST = 12;

if (!function_exists('csrfToken')) {
    function csrfToken(): string {
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }
}

if (!function_exists('verifyCsrf')) {
    function verifyCsrf(?string $token): bool {
        return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token ?? '');
    }
}

if (!function_exists('passwordPolicyCheck')) {
    /** null si OK, sinon le message d'erreur (12 car. min, majuscule, minuscule, chiffre). */
    function passwordPolicyCheck(string $pwd): ?string {
        if (strlen($pwd) < 12) return 'Le mot de passe doit contenir au moins 12 caractères.';
        if (!preg_match('/[A-Z]/', $pwd) || !preg_match('/[a-z]/', $pwd) || !preg_match('/[0-9]/', $pwd)) {
            return 'Le mot de passe doit contenir majuscule, minuscule et chiffre.';
        }
        return null;
    }
}

if (!function_exists('hashPassword')) {
    function hashPassword(string $pwd): string {
        return password_hash($pwd, PASSWORD_BCRYPT, ['cost' => PASSWORD_BCRYPT_COST]);
    }
}
