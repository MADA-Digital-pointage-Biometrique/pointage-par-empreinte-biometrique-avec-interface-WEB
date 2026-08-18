<?php use App\Core\Auth; ?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $title ?? 'Pointage biométrique' ?></title>
    <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
    <header class="navbar">
        <a class="navbar-brand" href="/">Pointage Bio</a>
        <nav>
            <a href="/">Tableau de bord</a>
            <a href="/pointage">Mon pointage</a>
            <?php if (Auth::isAdmin()): ?>
                <a href="/users">Employés</a>
            <?php endif; ?>
            <a href="/logout" class="btn btn-danger btn-sm">Déconnexion</a>
        </nav>
    </header>

    <main class="container">
        <?php $flash = App\Core\Session::flash('success'); ?>
        <?php if ($flash): ?>
            <div class="alert alert-success"><?= htmlspecialchars($flash) ?></div>
        <?php endif; ?>

        <?php $flash = App\Core\Session::flash('error'); ?>
        <?php if ($flash): ?>
            <div class="alert alert-danger"><?= htmlspecialchars($flash) ?></div>
        <?php endif; ?>

        <?= $content ?>
    </main>
</body>
</html>