<?php
/**
 * Seed : crée le compte administrateur par défaut.
 * Usage : php database/seed.php
 */

use App\Core\App;
use App\Models\User;

require dirname(__DIR__) . '/app/Core/App.php';

App::boot();

if (User::findByMatricule('ADM001') === null) {
    User::create([
        'matricule' => 'ADM001',
        'nom'       => 'Administrateur',
        'prenom'    => 'Système',
        'email'     => 'admin@mada.com',
        'role'      => 'admin',
        'password'  => 'admin123',
    ]);
    echo "Admin créé : ADM001 / admin123\n";
} else {
    echo "L'administrateur ADM001 existe déjà.\n";
}