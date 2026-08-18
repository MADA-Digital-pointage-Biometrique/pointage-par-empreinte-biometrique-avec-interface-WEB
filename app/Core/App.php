<?php

namespace App\Core;

class App
{
    private static string $basePath;

    public static function init(string $basePath): void
    {
        self::$basePath = rtrim($basePath, '/\\') . DIRECTORY_SEPARATOR;

        self::boot();

        $router = new Router();
        require self::$basePath . 'routes' . DIRECTORY_SEPARATOR . 'web.php';
        $router->dispatch();
    }

    public static function boot(): void
    {
        session_start();

        spl_autoload_register(function (string $class) {
            $prefix = 'App\\';
            if (str_starts_with($class, $prefix)) {
                $file = self::$basePath . str_replace('\\', DIRECTORY_SEPARATOR, substr($class, 4)) . '.php';
                if (file_exists($file)) {
                    require $file;
                }
            }
        });
    }

    public static function basePath(): string
    {
        return self::$basePath;
    }

    public static function view(string $path, array $data = []): void
    {
        extract($data);

        ob_start();
        require self::$basePath . 'app' . DIRECTORY_SEPARATOR . 'Views' . DIRECTORY_SEPARATOR . $path . '.php';
        $content = ob_get_clean();

        $layout = array_key_exists('layout', $data) ? $data['layout'] : 'layouts/app';
        $layoutFile = $layout
            ? self::$basePath . 'app' . DIRECTORY_SEPARATOR . 'Views' . DIRECTORY_SEPARATOR . $layout . '.php'
            : null;

        if ($layoutFile && file_exists($layoutFile)) {
            require $layoutFile;
        } else {
            echo $content;
        }
    }
}