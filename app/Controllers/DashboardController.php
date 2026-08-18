<?php

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Controller;
use App\Models\Pointage;
use App\Models\User;

class DashboardController extends Controller
{
    public function index(): void
    {
        $this->requireAuth();

        $user          = Auth::user();
        $totalUsers    = count(User::all());
        $todayPointage = Pointage::todayForUser($user['id']);

        $data = [
            'user'       => $user,
            'totalUsers' => $totalUsers,
            'entrees'    => Pointage::entreesAujourdhui(),
            'retards'    => Pointage::retardsAujourdhui(),
            'absents'    => Pointage::absentsAujourdhui($totalUsers),
            'isCheckedIn' => $todayPointage !== null && $todayPointage['heure_sortie'] === null,
        ];

        $this->view('dashboard/index', $data);
    }
}