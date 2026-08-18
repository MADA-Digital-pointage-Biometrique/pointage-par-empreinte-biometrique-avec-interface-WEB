<?php

namespace App\Core\Biometric;

/**
 * Contrat d'un lecteur d'empreintes digitales.
 *
 * Implémenter cette interface pour brancher un lecteur réel
 * (DigitalPersona, SecuGen, ZKTeco...) avec son SDK.
 */
interface FingerprintReader
{
    /**
     * Attend la pose du doigt et retourne l'identifiant de l'employé
     * reconnu par l'empreinte, ou null si aucune correspondance.
     */
    public function scan(): ?int;

    /**
     * Enregistre le template de l'empreinte d'un employé.
     * Retourne le template brut (binaire) à stocker en base.
     */
    public function enroll(int $userId): string;

    /**
     * Nom lisible du lecteur (affiché dans l'interface).
     */
    public function name(): string;
}