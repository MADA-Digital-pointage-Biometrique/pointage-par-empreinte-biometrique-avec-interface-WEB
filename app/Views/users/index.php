<h1>Gestion des employés</h1>

<h2>Ajouter un employé</h2>
<form method="POST" action="/users" class="form-grid">
    <input type="hidden" name="csrf_token" value="<?= App\Core\Session::csrfToken() ?>">

    <div>
        <label for="matricule">Matricule *</label>
        <input type="text" id="matricule" name="matricule" required>
    </div>
    <div>
        <label for="nom">Nom *</label>
        <input type="text" id="nom" name="nom" required>
    </div>
    <div>
        <label for="prenom">Prénom</label>
        <input type="text" id="prenom" name="prenom">
    </div>
    <div>
        <label for="email">Email</label>
        <input type="email" id="email" name="email">
    </div>
    <div>
        <label for="role">Rôle</label>
        <select id="role" name="role">
            <option value="employe">Employé</option>
            <option value="admin">Administrateur</option>
        </select>
    </div>
    <div>
        <label for="password">Mot de passe *</label>
        <input type="password" id="password" name="password" required>
    </div>

    <button type="submit" class="btn btn-primary">Ajouter</button>
</form>

<h2>Liste des employés</h2>
<table class="table">
    <thead>
        <tr>
            <th>ID</th>
            <th>Matricule</th>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Email</th>
            <th>Rôle</th>
            <th>Empreinte</th>
            <th>Actions</th>
        </tr>
    </thead>
    <tbody>
        <?php foreach ($users as $u): ?>
            <tr>
                <td><?= $u['id'] ?></td>
                <td><?= htmlspecialchars($u['matricule']) ?></td>
                <td><?= htmlspecialchars($u['nom']) ?></td>
                <td><?= htmlspecialchars($u['prenom']) ?></td>
                <td><?= htmlspecialchars($u['email']) ?></td>
                <td><span class="badge <?= $u['role'] === 'admin' ? 'badge-warn' : 'badge-ok' ?>"><?= $u['role'] ?></span></td>
                <td>
                    <?php if (isset($enrolled[$u['id']])): ?>
                        <span class="badge badge-ok">Enregistrée</span>
                    <?php else: ?>
                        <span class="badge badge-danger">Aucune</span>
                    <?php endif; ?>
                </td>
                <td>
                    <a class="btn btn-primary btn-sm" href="/users/<?= $u['id'] ?>/empreinte">Enrôler l'empreinte</a>
                    <a class="btn btn-danger btn-sm" href="/users/delete/<?= $u['id'] ?>"
                       onclick="return confirm('Supprimer cet employé ?')">Supprimer</a>
                </td>
            </tr>
        <?php endforeach; ?>
    </tbody>
</table>