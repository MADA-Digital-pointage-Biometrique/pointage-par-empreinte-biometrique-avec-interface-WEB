<?php

namespace App\Core\Biometric;

use App\Core\Session;
use App\Models\Empreinte;

/**
 * Mode simulateur : aucun matériel requis.
 * Le lecteur est simulé par la saisie du matricule, mais la vérification
 * (empreinte enregistrée ou non) reste identique au flux réel.
 */
class SimulatorReader implements FingerprintReader
{
    public function scan(): ?int
    {
        $matricule = trim($_POST['matricule_scan'] ?? '');
        if ($matricule === '') {
            return null;
        }

        $empreinte = Empreinte::findByMatricule($matricule);
        if ($empreinte === null) {
            Session::flash('error', 'Aucune empreinte enregistrée pour ce compte. Contactez l\'administrateur.');
            return null;
        }

        return (int) $empreinte['user_id'];
    }

    public function enroll(int $userId): string
    {
        // En mode simulé, le "template" est un jeton aléatoire.
        return bin2hex(random_bytes(32));
    }

    public function name(): string
    {
        return 'Lecteur simulé (démonstration)';
    }
}