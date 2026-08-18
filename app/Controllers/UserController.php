<?php

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Biometric\BiometricReader;
use App\Core\Controller;
use App\Core\Session;
use App\Models\Empreinte;
use App\Models\User;

class UserController extends Controller
{
    private function requireAdmin(): void
    {
        $this->requireAuth();
        if (!Auth::isAdmin()) {
            Session::flash('error', 'Accès réservé aux administrateurs.');
            $this->redirect('/');
        }
    }

    public function index(): void
    {
        $this->requireAdmin();

        $enrolled = [];
        foreach (\App\Models\Empreinte::all() as $emp) {
            $enrolled[(int) $emp['user_id']] = true;
        }

        $this->view('users/index', [
            'users'    => User::all(),
            'enrolled' => $enrolled,
        ]);
    }

    public function store(): void
    {
        $this->requireAdmin();

        if (!Session::verifyCsrf($_POST['csrf_token'] ?? null)) {
            Session::flash('error', 'Jeton de sécurité invalide.');
            $this->redirect('/users');
        }

        $matricule = trim($_POST['matricule'] ?? '');
        $nom       = trim($_POST['nom'] ?? '');
        $prenom    = trim($_POST['prenom'] ?? '');
        $email     = trim($_POST['email'] ?? '');
        $role      = $_POST['role'] === 'admin' ? 'admin' : 'employe';
        $password  = $_POST['password'] ?? '';

        if ($matricule === '' || $nom === '' || $password === '') {
            Session::flash('error', 'Veuillez remplir tous les champs obligatoires.');
            $this->redirect('/users');
        }

        if (User::findByMatricule($matricule) !== null) {
            Session::flash('error', 'Ce matricule existe déjà.');
            $this->redirect('/users');
        }

        User::create([
            'matricule' => $matricule,
            'nom'       => $nom,
            'prenom'    => $prenom,
            'email'     => $email,
            'role'      => $role,
            'password'  => $password,
        ]);

        Session::flash('success', 'Employé ajouté avec succès.');
        $this->redirect('/users');
    }

    public function destroy(int $id): void
    {
        $this->requireAdmin();

        if ((int) $id === (int) Auth::user()['id']) {
            Session::flash('error', 'Vous ne pouvez pas supprimer votre propre compte.');
            $this->redirect('/users');
        }

        User::delete($id);
        Session::flash('success', 'Employé supprimé.');
        $this->redirect('/users');
    }

    public function enrollForm(int $id): void
    {
        $this->requireAdmin();

        $user = User::find($id);
        if ($user === null) {
            Session::flash('error', 'Employé introuvable.');
            $this->redirect('/users');
        }

        $this->view('users/empreinte', [
            'user'      => $user,
            'empreinte' => Empreinte::forUser($id),
            'lecteur'   => BiometricReader::reader()->name(),
            'driver'    => \App\Core\Config::driverBiometrique(),
        ]);
    }

    public function storeEnroll(int $id): void
    {
        $this->requireAdmin();

        if (!Session::verifyCsrf($_POST['csrf_token'] ?? null)) {
            Session::flash('error', 'Jeton de sécurité invalide.');
            $this->redirect('/users/' . $id . '/empreinte');
        }

        $template = BiometricReader::reader()->enroll($id);

        $existing = Empreinte::forUser($id);
        if ($existing !== null) {
            Empreinte::update((int) $existing['id'], [
                'template' => $template,
                'appareil' => BiometricReader::reader()->name(),
            ]);
        } else {
            Empreinte::create([
                'user_id'  => $id,
                'template' => $template,
                'appareil' => BiometricReader::reader()->name(),
            ]);
        }

        Session::flash('success', 'Empreinte enregistrée avec succès.');
        $this->redirect('/users');
    }

    public function deleteEnroll(int $id): void
    {
        $this->requireAdmin();

        if (!Session::verifyCsrf($_POST['csrf_token'] ?? null)) {
            Session::flash('error', 'Jeton de sécurité invalide.');
            $this->redirect('/users');
        }

        $empreinte = Empreinte::forUser($id);
        if ($empreinte !== null) {
            Empreinte::delete((int) $empreinte['id']);
            Session::flash('success', 'Empreinte supprimée.');
        }

        $this->redirect('/users');
    }
}