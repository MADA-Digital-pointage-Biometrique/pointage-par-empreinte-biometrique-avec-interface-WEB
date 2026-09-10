<?php

namespace App\Core\Biometric;

/**
 * Interface pour les lecteurs biométriques.
 */
interface FingerprintReader
{
    /**
     * Effectue un scan et retourne l'ID utilisateur si reconnu, null sinon.
     */
    public function scan(): ?int;

    /**
     * Enrôle un utilisateur. Retourne ['slot'=>N, 'hex'=>?string] —
     * hex brut UP_CHAR (512 o) ou null si dump impossible (bytea réel).
     */
    public function enroll(int $userId): array;

    /**
     * Nom du lecteur pour l'affichage.
     */
    public function name(): string;
}