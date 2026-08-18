<?php

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Biometric\BiometricReader;
use App\Core\Config;
use App\Core\Controller;
use App\Core\Session;
use App\Models\Empreinte;
use App\Models\Pointage;

class PointageController extends Controller
{
    public function index(): void
    {
        $this->requireAuth();

        $user  = Auth::user();
        $today = Pointage::todayForUser($user['id']);

        $this->view('pointage/index', [
            'user'          => $user,
            'today'         => $today,
            'heureDebut'    => Config::heureDebutOfficielle(),
            'heureFin'      => Config::heureFinOfficielle(),
            'lecteur'       => BiometricReader::reader()->name(),
            'driver'        => Config::driverBiometrique(),
            'empreinte'     => Empreinte::forUser($user['id']) !== null,
            'historique'    => Pointage::query(
                'SELECT * FROM pointages WHERE user_id = ? ORDER BY date_pointage DESC LIMIT 30',
                [$user['id']]
            ),
        ]);
    }

    public function pointer(): void
    {
        $this->requireAuth();

        if (!Session::verifyCsrf($_POST['csrf_token'] ?? null)) {
            Session::flash('error', 'Jeton de sécurité invalide.');
            $this->redirect('/pointage');
        }

        $user  = Auth::user();
        $today = Pointage::todayForUser($user['id']);

        if ($today === null) {
            Pointage::create([
                'user_id'       => $user['id'],
                'date_pointage' => date('Y-m-d'),
                'heure_entree'  => date('H:i:s'),
            ]);
            Session::flash('success', 'Entrée pointée à ' . date('H:i') . '. Bon travail !');
        } elseif ($today['heure_sortie'] === null) {
            Pointage::update((int) $today['id'], ['heure_sortie' => date('H:i:s')]);
            Session::flash('success', 'Sortie pointée à ' . date('H:i') . '. À demain !');
        } else {
            Session::flash('error', 'Vous avez déjà pointé entrée et sortie aujourd\'hui.');
        }

        $this->redirect('/pointage');
    }
}