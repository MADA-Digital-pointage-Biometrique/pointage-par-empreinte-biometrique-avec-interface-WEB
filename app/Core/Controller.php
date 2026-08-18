<?php

namespace App\Core;

abstract class Controller
{
    protected function view(string $path, array $data = []): void
    {
        App::view($path, $data);
    }

    protected function redirect(string $path): void
    {
        header('Location: ' . $path);
        exit;
    }

    protected function json(array $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }

    protected function requireAuth(): void
    {
        if (!Auth::check()) {
            $this->redirect('/login');
        }
    }
}