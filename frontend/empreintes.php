<?php
session_start();
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit();
}
if (!isset($_SESSION['role']) || !in_array($_SESSION['role'], ['admin', 'super_admin', 'admin_systeme'])) {
    header('Location: dashboard.php');
    exit();
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta content="width=device-width, initial-scale=1.0" name="viewport">
    <title>Empreintes Biométriques - P.Biometrique</title>
    <script>
        (function() {
            document.documentElement.classList.add('page-loading');
            var saved = localStorage.getItem('mada-theme');
            var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (saved === 'dark' || (saved === null && prefersDark)) {
                document.documentElement.classList.add('dark');
            }
            function removeLoading() {
                requestAnimationFrame(function() {
                    requestAnimationFrame(function() {
                        document.documentElement.classList.remove('page-loading');
                    });
                });
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', removeLoading);
            } else {
                removeLoading();
            }
            setTimeout(removeLoading, 300);
        })();
    </script>
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <script src="assets/js/theme.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/app.css?v=<?= time() ?>">
</head>
<body class="bg-[#F7F8FA] dark:bg-stone-950 text-[#303030] dark:text-slate-100 antialiased flex" data-page="empreintes" data-search="1">
    <div id="app-shell"></div>
    <div id="topbar-slot"></div>

    <div class="flex-1 md:ml-[280px] flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <main class="flex-1 mt-16 p-md md:p-xl max-w-container-max mx-auto w-full max-w-full overflow-x-hidden min-w-0">
            <div id="flash"></div>

            <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-lg">
                <div>
                    <h2 class="font-bold text-2xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-[#F46A21]">fingerprint</span>
                        Empreintes Biométriques
                    </h2>
                    <p class="text-slate-500 dark:text-slate-400 text-[13px] mt-0.5">Enrôlement et gestion des empreintes digitales</p>
                </div>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-md rounded-2xl shadow-sm mb-lg flex flex-wrap items-center justify-between gap-md w-full max-w-full overflow-hidden">
                <div class="flex flex-wrap items-center gap-sm flex-1">
                    <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-1.5 border border-slate-200 dark:border-slate-700">
                        <span class="material-symbols-outlined text-slate-400 text-[18px]">domain</span>
                        <select id="filter-dept" class="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:ring-0">
                            <option value="">Tous les Départements</option>
                        </select>
                    </div>
                    <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-1.5 border border-slate-200 dark:border-slate-700">
                        <span class="material-symbols-outlined text-slate-400 text-[18px]">fingerprint</span>
                        <select id="filter-emp" class="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:ring-0">
                            <option value="">Toutes les Empreintes</option>
                            <option value="yes">Empreinte Enregistrée</option>
                            <option value="no">Sans Empreinte</option>
                        </select>
                    </div>
                </div>
                <div class="text-xs font-mono text-slate-400" id="emp-count-summary">
                    Calcul en cours...
                </div>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden w-full max-w-full">
                <div class="overflow-x-auto w-full max-w-full overscroll-x-contain">
                    <table class="w-full min-w-[520px] md:min-w-[640px] text-left border-collapse text-[13px]">
                        <thead>
                            <tr class="border-b border-slate-200/60 dark:border-slate-800 font-semibold text-slate-400 uppercase text-[11px] tracking-wider bg-slate-50/50 dark:bg-slate-900">
                                <th class="py-md px-md">Employé</th>
                                <th class="py-md px-md hidden md:table-cell">Matricule</th>
                                <th class="py-md px-md">Département</th>
                                <th class="py-md px-md">Empreinte</th>
                                <th class="py-md px-md text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60" id="users-body"></tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>

    <!-- Modal : Enrôlement empreinte -->
    <div class="hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 items-center justify-center p-sm" id="modal-enroll">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[420px] p-lg text-center relative overflow-hidden menu-dropdown-panel">
            <div class="flex justify-between items-center mb-md relative border-b border-slate-100 dark:border-slate-800 pb-sm">
                <h3 class="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span class="material-symbols-outlined text-[#F46A21]">fingerprint</span> Enrôlement Biométrique
                </h3>
                <button class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer" data-close="modal-enroll">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="relative flex flex-col items-center py-md">
                <div class="w-24 h-24 rounded-full bg-[#FFF1E8] dark:bg-orange-950 text-[#F46A21] flex items-center justify-center mb-lg transition-colors duration-300 shadow-inner" id="enroll-icon">
                    <span class="material-symbols-outlined text-[48px]">fingerprint</span>
                </div>
                <h4 class="font-bold text-base text-slate-900 dark:text-white" id="enroll-person">—</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 min-h-[1.25rem]" id="enroll-step">Placez le doigt de l'employé sur le capteur.</p>
                <button class="mt-lg bg-gradient-to-r from-[#F46A21] to-[#F9AE3F] hover:from-[#EA580C] hover:to-[#F59E0B] text-white font-semibold text-xs py-2.5 px-xl rounded-xl shadow-md shadow-orange-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-98" id="btn-enroll">
                    <span class="material-symbols-outlined text-[18px]">touch_app</span>
                    Poser le doigt sur le lecteur
                </button>
                <p class="text-[11px] text-slate-400 mt-sm">Placez votre doigt sur le lecteur biométrique.</p>
            </div>
        </div>
    </div>

<script src="assets/js/data.js?v=<?= time() ?>"></script>
    <script src="assets/js/api.js?v=<?= time() ?>"></script>
    <script src="assets/js/templates.js?v=<?= time() ?>"></script>
    <script src="assets/js/app.js?v=<?= time() ?>"></script>
    <script src="assets/js/pages/empreintes.js?v=<?= time() ?>"></script>
</body>
</html>
