<?php

namespace App\Core;

class Router
{
    private array $routes = [];

    public function get(string $path, array $handler): void
    {
        $this->add('GET', $path, $handler);
    }

    public function post(string $path, array $handler): void
    {
        $this->add('POST', $path, $handler);
    }

    private function add(string $method, string $path, array $handler): void
    {
        $this->routes[] = [
            'method'  => $method,
            'pattern' => '#^' . preg_replace('#\{([a-zA-Z0-9_]+)\}#', '(?P<$1>[a-zA-Z0-9_]+)', $path) . '$#',
            'handler' => $handler,
        ];
    }

    public function dispatch(): void
    {
        $uri    = strtok($_SERVER['REQUEST_URI'], '?');
        $method = $_SERVER['REQUEST_METHOD'];

        $basePath = rtrim(str_replace('/index.php', '', $_SERVER['SCRIPT_NAME']), '/');
        if (!empty($basePath) && str_starts_with($uri, $basePath)) {
            $uri = substr($uri, strlen($basePath));
        }
        $uri = $uri === '' ? '/' : $uri;

        foreach ($this->routes as $route) {
            if ($route['method'] === $method && preg_match($route['pattern'], $uri, $matches)) {
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
                $this->call($route['handler'], $params);
                return;
            }
        }

        http_response_code(404);
        App::view('errors/404', ['layout' => null]);
    }

    private function call(array $handler, array $params): void
    {
        [$controller, $action] = $handler;
        $controller = 'App\\Controllers\\' . $controller;
        call_user_func_array([new $controller(), $action], $params);
    }
}