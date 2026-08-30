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
     * Enrôle un utilisateur et retourne le template de l'empreinte.
     */
    public function enroll(int $userId): string;

    /**
     * Nom du lecteur pour l'affichage.
     */
    public function name(): string;
}