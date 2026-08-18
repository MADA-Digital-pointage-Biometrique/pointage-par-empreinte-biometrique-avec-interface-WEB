<h1>Enrôlement de l'empreinte digitale</h1>

<?php $flash = App\Core\Session::flash('success'); ?>
<?php if ($flash): ?>
    <div class="alert alert-success"><?= htmlspecialchars($flash) ?></div>
<?php endif; ?>

<div class="bio-panel">
    <div class="bio-icon">&#128400;</div>
    <h2><?= htmlspecialchars($user['prenom'] . ' ' . $user['nom']) ?> (<?= htmlspecialchars($user['matricule']) ?>)</h2>

    <?php if ($empreinte !== null): ?>
        <p class="muted">Une empreinte est déjà enregistrée (le <?= $empreinte['created_at'] ?>). La remplacer ?</p>
    <?php else: ?>
        <p class="muted">Aucune empreinte enregistrée pour cet employé.</p>
    <?php endif; ?>

    <p>Lecteur connecté : <strong><?= htmlspecialchars($lecteur) ?></strong></p>

    <?php if ($driver === 'simulator'): ?>
        <div class="alert alert-warn">
            Mode simulateur : cliquez sur le bouton ci-dessous pour générer
            un template d'empreinte factice (équivalent à la pose du doigt sur le lecteur).
        </div>
    <?php endif; ?>

    <form method="POST" action="/users/<?= $user['id'] ?>/empreinte">
        <input type="hidden" name="csrf_token" value="<?= App\Core\Session::csrfToken() ?>">
        <button type="submit" class="btn btn-primary btn-lg">
            <?= $empreinte !== null ? 'Remplacer l\'empreinte' : 'Enregistrer l\'empreinte' ?>
        </button>
    </form>

    <?php if ($empreinte !== null): ?>
        <form method="POST" action="/users/<?= $user['id'] ?>/empreinte/delete">
            <input type="hidden" name="csrf_token" value="<?= App\Core\Session::csrfToken() ?>">
            <button type="submit" class="btn btn-danger"
                    onclick="return confirm('Supprimer l\'empreinte de cet employé ?')">
                Supprimer l'empreinte
            </button>
        </form>
    <?php endif; ?>
</div>

<a href="/users" class="btn btn-secondary">&larr; Retour à la liste</a>