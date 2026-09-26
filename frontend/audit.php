<?php
require_once __DIR__ . '/../config/session.php';
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit();
}
if (!isset($_SESSION['role']) || !in_array($_SESSION['role'], ['super_admin', 'admin_systeme'])) {
    header('Location: dashboard.php');
    exit();
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta content="width=device-width, initial-scale=1.0" name="viewport">
    <title>Journal d'audit - P.Biometrique</title>
    <script src="assets/js/theme-init.js"></script>
    <link rel="stylesheet" href="assets/css/tailwind.css?v=<?= asset_ver('assets/css/tailwind.css') ?>">
    <link rel="stylesheet" href="assets/css/app.css?v=<?= asset_ver('assets/css/app.css') ?>">
</head>
<body class="bg-[#F7F8FA] dark:bg-stone-950 text-[#303030] dark:text-slate-100 antialiased flex" data-page="audit">
    <div id="app-shell"></div>
    <div id="topbar-slot"></div>

    <div class="flex-1 md:ml-[280px] flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <main class="flex-1 mt-16 p-md md:p-xl max-w-container-max mx-auto w-full max-w-full overflow-x-hidden min-w-0">
            <div id="flash"></div>

            <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-lg">
                <div>
                    <h2 class="font-bold text-2xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-[#F46A21]">receipt_long</span>
                        Journal d'audit
                    </h2>
                    <p class="text-slate-500 dark:text-slate-400 text-[13px] mt-0.5">Traçabilité : enrôlements, suppressions, scans, borne et capteur</p>
                </div>
                <button id="btn-refresh-audit" class="btn-refresh self-start md:self-auto" type="button">
                    <span class="material-symbols-outlined">refresh</span>
                    Actualiser
                </button>
                <button id="btn-delete-audit" class="btn-refresh self-start md:self-auto opacity-50 cursor-not-allowed" type="button" disabled>
                    <span class="material-symbols-outlined">delete</span>
                    Supprimer (<span id="audit-selected-count">0</span>)
                </button>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-md rounded-2xl shadow-sm mb-lg flex flex-wrap items-center gap-sm w-full max-w-full">
                <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-1.5 border border-slate-200 dark:border-slate-700">
                    <span class="material-symbols-outlined text-slate-400 text-[18px]">filter_list</span>
                    <select id="filter-audit-action" class="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:ring-0">
                        <option value="">Toutes actions</option>
                        <option value="enrolement">Enrôlements</option>
                        <option value="delete">Suppressions</option>
                        <option value="scan">Scans</option>
                        <option value="borne">Borne</option>
                    </select>
                </div>
                <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-1.5 border border-slate-200 dark:border-slate-700">
                    <span class="material-symbols-outlined text-slate-400 text-[18px]">list</span>
                    <select id="filter-audit-limit" class="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:ring-0">
                        <option value="50">50 dernières</option>
                        <option value="100">100 dernières</option>
                        <option value="200">200 dernières</option>
                    </select>
                </div>
                <div class="text-xs font-mono text-slate-400 ml-auto" id="audit-count-summary">Chargement…</div>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden w-full max-w-full" id="card-audit">
                <div class="overflow-x-auto w-full max-w-full overscroll-x-contain">
                    <table class="w-full min-w-[640px] text-left border-collapse text-[13px]">
                        <thead>
                            <tr class="border-b border-slate-200/60 dark:border-slate-800 font-semibold text-slate-400 uppercase text-[11px] tracking-wider bg-slate-50/50 dark:bg-slate-900">
                                <th class="py-md px-md w-10"><input type="checkbox" id="audit-select-all" class="accent-[#F46A21] w-4 h-4 cursor-pointer" title="Tout sélectionner"></th>
                                <th class="py-md px-md">Heure</th>
                                <th class="py-md px-md">Action</th>
                                <th class="py-md px-md hidden md:table-cell">Table</th>
                                <th class="py-md px-md">Détail</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60" id="audit-body">
                            <tr><td colspan="5" class="py-lg px-md text-center text-slate-400">Chargement…</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>

<script src="assets/js/data.js?v=<?= asset_ver('assets/js/data.js') ?>"></script>
    <script src="assets/js/api.js?v=<?= asset_ver('assets/js/api.js') ?>"></script>
    <script src="assets/js/templates.js?v=<?= asset_ver('assets/js/templates.js') ?>"></script>
    <script src="assets/js/app.js?v=<?= asset_ver('assets/js/app.js') ?>"></script>
    <script src="assets/js/pages/audit.js?v=<?= asset_ver('assets/js/pages/audit.js') ?>"></script>
</body>
</html>
