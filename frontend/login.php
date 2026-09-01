<?php
session_start();
if (isset($_SESSION['user_id'])) {
    header('Location: dashboard.php');
    exit();
}
?>
<!DOCTYPE html>
<html class="dark" lang="fr">
<head>
    <meta charset="utf-8">
    <meta content="width=device-width, initial-scale=1.0" name="viewport">
    <title>Connexion - P.Biometrique</title>
    <script>!function(){var e=localStorage.getItem('mada-theme'),d=window.matchMedia('(prefers-color-scheme: dark)').matches;var isDark=(e==='dark'||(e===null&&d));document.documentElement.classList.toggle('dark',isDark);}();</script>
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <script src="assets/js/theme.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/app.css?v=<?= time() ?>">
</head>
<body class="login-bg antialiased min-h-screen flex items-center justify-center p-md relative overflow-hidden">

    <!-- Decorative Animated Glow Elements -->
    <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 login-glow rounded-full blur-3xl pointer-events-none"></div>

    <div class="w-full max-w-[420px] login-card backdrop-blur-xl rounded-3xl p-xl relative z-10 menu-dropdown-panel">
        <button id="btn-login-theme" type="button" title="Changer de thème">
            <span class="material-symbols-outlined ticon-light">light_mode</span>
            <span class="material-symbols-outlined ticon-dark">dark_mode</span>
        </button>
        <div class="flex flex-col items-center text-center mb-lg">
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center mb-md shadow-lg shadow-orange-500/25">
                <span class="material-symbols-outlined text-[36px]">fingerprint</span>
            </div>
            <h1 class="font-extrabold text-2xl tracking-tight login-title">P.Biometrique</h1>
            <p class="text-xs mt-1 login-subtitle">Système Biométrique de Gestion de Présence</p>
        </div>

        <div id="flash"></div>

        <form id="login-form">
            <div class="mb-md">
                <label class="text-xs font-semibold uppercase tracking-wider mb-1.5 block login-label" for="matricule">Matricule</label>
                <div class="flex items-center rounded-xl px-md transition-all login-field">
                    <span class="material-symbols-outlined mr-sm text-[18px] login-field-icon">badge</span>
                    <input class="bg-transparent border-none text-sm w-full py-2.5 outline-none font-mono" id="matricule" name="matricule" placeholder="ex: ADM001" required autofocus>
                </div>
            </div>

            <div class="mb-lg">
                <label class="text-xs font-semibold uppercase tracking-wider mb-1.5 block login-label" for="password">Mot de passe</label>
                <div class="flex items-center rounded-xl px-md transition-all login-field">
                    <span class="material-symbols-outlined mr-sm text-[18px] login-field-icon">lock</span>
                    <input class="bg-transparent border-none text-sm w-full py-2.5 outline-none" id="password" name="password" type="password" placeholder="••••••••" required>
                </div>
            </div>

            <button type="submit" id="btn-submit"
                    class="w-full bg-gradient-to-r from-[#F46A21] to-[#F9AE3F] hover:from-[#E05910] hover:to-[#E89D2E] text-white font-semibold text-xs py-3 px-md rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98">
                <span class="material-symbols-outlined text-[18px]">login</span>
                Se connecter au système
            </button>
        </form>

        <!-- Note d'accès -->
        <div class="mt-lg pt-md login-note">
            <span class="text-[11px] font-semibold uppercase block text-center login-note-text">Accès Réservé aux Administrateurs</span>
            <p class="text-[11px] text-center mt-sm login-note-text">Note: Les employés s'identifient exclusivement par leur empreinte sur la borne biométrique.</p>
        </div>
    </div>

<script src="assets/js/data.js"></script>
    <script src="assets/js/api.js"></script>
    <script src="assets/js/app.js"></script>
    <script>
        document.getElementById('btn-login-theme').addEventListener('click', () => toggleDarkMode());

        document.getElementById('login-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mat = document.getElementById('matricule').value.trim();
            const pwd = document.getElementById('password').value;
            const btn = document.getElementById('btn-submit');

            btn.disabled = true;
            btn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">sync</span> Connexion en cours...';

            try {
                const res = await api.login(mat, pwd);

                if (res && res.ok) {
                    window.location.href = 'dashboard.php';
                } else {
                    flash(res ? res.message : 'Identifiants incorrects.', 'danger');
                    btn.disabled = false;
                    btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">login</span> Se connecter au système';
                }
            } catch (err) {
                console.error(err);
                flash('Erreur de connexion au serveur.', 'danger');
                btn.disabled = false;
                btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">login</span> Se connecter au système';
            }
        });
    </script>
</body>
</html>
