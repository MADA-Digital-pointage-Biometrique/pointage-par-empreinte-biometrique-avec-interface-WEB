<h1>Tableau de bord</h1>
<p>Bonjour <strong><?= htmlspecialchars($user['prenom'] . ' ' . $user['nom']) ?></strong> (<?= htmlspecialchars($user['matricule']) ?>)</p>

<div class="stats">
    <div class="card">
        <h3><?= $totalUsers ?></h3>
        <p>Employés</p>
    </div>
    <div class="card">
        <h3><?= $entrees ?></h3>
        <p>Entrées aujourd'hui</p>
    </div>
    <div class="card card-warn">
        <h3><?= $retards ?></h3>
        <p>Retards</p>
    </div>
    <div class="card card-danger">
        <h3><?= $absents ?></h3>
        <p>Absents</p>
    </div>
</div>

<div class="action-box">
    <?php if ($isCheckedIn): ?>
        <p>Vous êtes pointé présent depuis ce matin.</p>
        <a class="btn btn-danger" href="/pointage">Pointer la sortie</a>
    <?php else: ?>
        <p>Vous n'avez pas encore pointé aujourd'hui.</p>
        <a class="btn btn-primary" href="/pointage">Pointer maintenant</a>
    <?php endif; ?>
</div>