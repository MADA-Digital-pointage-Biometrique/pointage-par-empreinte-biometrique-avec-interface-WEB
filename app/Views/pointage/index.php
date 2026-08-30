<h1>Mon pointage</h1>

<div class="bio-panel">
    <div class="bio-icon">&#128400;</div>
    <h2>Pointer avec votre empreinte digitale</h2>
    <p class="muted">Lecteur : <?= htmlspecialchars($lecteur) ?></p>

    <?php if (!$empreinte): ?>
        <div class="alert alert-danger">Votre empreinte n'est pas encore enregistrée. Contactez l'administrateur pour l'enrôler.</div>
    <?php elseif ($today === null): ?>
        <form method="POST" action="/pointage/scan">
            <input type="hidden" name="csrf_token" value="<?= App\Core\Session::csrfToken() ?>">
            <button type="submit" class="btn btn-primary btn-lg">&#128400; Poser votre doigt sur le lecteur</button>
        </form>
    <?php elseif ($today['heure_sortie'] === null): ?>
        <p>Entrée pointée à <strong><?= $today['heure_entree'] ?></strong></p>
        <form method="POST" action="/pointage/scan">
            <input type="hidden" name="csrf_token" value="<?= App\Core\Session::csrfToken() ?>">
            <button type="submit" class="btn btn-danger btn-lg">&#128400; Poser votre doigt sur le lecteur (sortie)</button>
        </form>
    <?php else: ?>
        <p>Journée complète : entrée <strong><?= $today['heure_entree'] ?></strong>, sortie <strong><?= $today['heure_sortie'] ?></strong></p>
    <?php endif; ?>
</div>

<div class="action-box">
    <h2>Pointage manuel (secours)</h2>
    <?php if ($today === null): ?>
        <form method="POST" action="/pointage/pointer">
            <input type="hidden" name="csrf_token" value="<?= App\Core\Session::csrfToken() ?>">
            <button type="submit" class="btn btn-secondary">Pointer l'entrée manuellement</button>
        </form>
    <?php elseif ($today['heure_sortie'] === null): ?>
        <form method="POST" action="/pointage/pointer">
            <input type="hidden" name="csrf_token" value="<?= App\Core\Session::csrfToken() ?>">
            <button type="submit" class="btn btn-secondary">Pointer la sortie manuellement</button>
        </form>
    <?php else: ?>
        <p class="muted">Pointages complétés pour aujourd'hui.</p>
    <?php endif; ?>
</div>

<p class="muted">Heures officielles : <?= $heureDebut ?> – <?= $heureFin ?></p>

<h2>Historique (30 derniers jours)</h2>
<table class="table">
    <thead>
        <tr>
            <th>Date</th>
            <th>Entrée</th>
            <th>Sortie</th>
            <th>Status</th>
        </tr>
    </thead>
    <tbody>
        <?php foreach ($historique as $row): ?>
            <?php $retard = $row['heure_entree'] > $heureDebut && $row['heure_entree'] !== null; ?>
            <tr>
                <td><?= $row['date_pointage'] ?></td>
                <td><?= $row['heure_entree'] ?? '—' ?></td>
                <td><?= $row['heure_sortie'] ?? '—' ?></td>
                <td>
                    <?php if ($retard): ?>
                        <span class="badge badge-warn">Retard</span>
                    <?php else: ?>
                        <span class="badge badge-ok">Présent</span>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; ?>
        <?php if (empty($historique)): ?>
            <tr><td colspan="4" class="muted">Aucun pointage pour le moment.</td></tr>
        <?php endif; ?>
    </tbody>
</table>

<script>
    setInterval(() => {
        const el = document.getElementById('clock');
        if (el) el.textContent = new Date().toLocaleTimeString('fr-FR');
    }, 1000);
</script>