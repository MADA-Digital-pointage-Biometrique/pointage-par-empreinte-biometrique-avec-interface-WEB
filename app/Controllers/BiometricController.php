<?php

namespace App\Controllers;

use App\Core\Biometric\BiometricReader;
use App\Core\Controller;
use App\Core\Session;
use App\Models\Pointage;
use App\Models\User;

/**
 * Pointage par empreinte digitale : l'employé pose le doigt
 * sur le lecteur et sa présence est enregistrée automatiquement.
 */
class BiometricController extends Controller
{
    public function scan(): void
    {
        if (!Session::verifyCsrf($_POST['csrf_token'] ?? null)) {
            Session::flash('error', 'Jeton de sécurité invalide.');
            $this->redirect('/pointage');
        }

        $reader  = BiometricReader::reader();
        $userId  = $reader->scan();

        if ($userId === null) {
            Session::flash('error', 'Empreinte non reconnue. Essayez de nouveau.');
            $this->redirect('/pointage');
        }

        $user = User::find($userId);
        if ($user === null) {
            Session::flash('error', 'Employé introuvable.');
            $this->redirect('/pointage');
        }

        $today = Pointage::todayForUser($userId);

        if ($today === null) {
            Pointage::create([
                'user_id'       => $userId,
                'date_pointage' => date('Y-m-d'),
                'heure_entree'  => date('H:i:s'),
            ]);
            Session::flash('success', 'Bienvenue ' . $user['prenom'] . ' ' . $user['nom']
                . ' ! Entrée pointée à ' . date('H:i') . ' (empreinte reconnue).');
        } elseif ($today['heure_sortie'] === null) {
            Pointage::update((int) $today['id'], ['heure_sortie' => date('H:i:s')]);
            Session::flash('success', 'Au revoir ' . $user['prenom'] . ' ' . $user['nom']
                . ' ! Sortie pointée à ' . date('H:i') . ' (empreinte reconnue).');
        } else {
            Session::flash('error', $user['prenom'] . ' ' . $user['nom']
                . ' a déjà pointé entrée et sortie aujourd\'hui.');
        }

        $this->redirect('/pointage');
    }
}