<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Connexion - Pointage Bio</title>
    <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body class="auth-body">
    <div class="auth-card">
        <h1>Pointage Bio</h1>
        <p class="muted">Connectez-vous avec votre matricule</p>

        <?php $flash = App\Core\Session::flash('error'); ?>
        <?php if ($flash): ?>
            <div class="alert alert-danger"><?= htmlspecialchars($flash) ?></div>
        <?php endif; ?>

        <form method="POST" action="/login">
            <input type="hidden" name="csrf_token" value="<?= App\Core\Session::csrfToken() ?>">

            <label for="matricule">Matricule</label>
            <input type="text" id="matricule" name="matricule" required autofocus>

            <label for="password">Mot de passe</label>
            <input type="password" id="password" name="password" required>

            <button type="submit" class="btn btn-primary btn-block">Se connecter</button>
        </form>
    </div>
</body>
</html>