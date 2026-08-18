<?php

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Controller;
use App\Core\Session;

class AuthController extends Controller
{
    public function showLogin(): void
    {
        if (Auth::check()) {
            $this->redirect('/');
        }
        $this->view('auth/login', ['layout' => null]);
    }

    public function login(): void
    {
        if (!Session::verifyCsrf($_POST['csrf_token'] ?? null)) {
            Session::flash('error', 'Jeton de sécurité invalide.');
            $this->redirect('/login');
        }

        $matricule = trim($_POST['matricule'] ?? '');
        $password  = $_POST['password'] ?? '';

        if (Auth::login($matricule, $password)) {
            Session::flash('success', 'Bienvenue !');
            $this->redirect('/');
        }

        Session::flash('error', 'Matricule ou mot de passe incorrect.');
        $this->redirect('/login');
    }

    public function logout(): void
    {
        Auth::logout();
        $this->redirect('/login');
    }
}