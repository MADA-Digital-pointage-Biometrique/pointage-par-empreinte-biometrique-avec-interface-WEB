<?php
session_start();
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit();
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta content="width=device-width, initial-scale=1.0" name="viewport">
    <title>Borne de Pointage Biométrique - P.Biometrique</title>
    <script>
        /* ── ANTI-FLASH : doit s'exécuter avant tout rendu ── */
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
    <link rel="stylesheet" href="assets/css/tailwind.css?v=<?= time() ?>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/app.css?v=<?= time() ?>">
</head>
<body class="bg-[#F7F8FA] dark:bg-stone-950 text-[#303030] dark:text-slate-100 antialiased flex" data-page="pointage">
    <div id="app-shell"></div>
    <div id="topbar-slot"></div>

    <div class="flex-1 md:ml-[280px] flex flex-col min-h-screen">
        <main class="flex-1 mt-16 p-md md:p-xl max-w-container-max mx-auto w-full">
            <div id="flash"></div>

            <!-- Page Header -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-lg">
                <div>
                    <h2 class="font-bold text-2xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-[#F46A21]">fingerprint</span>
                        Pointages
                    </h2>
                    <p class="text-slate-500 dark:text-slate-400 text-[13px] mt-0.5">Consultation et correction des horodatages</p>
                </div>
            </div>

            <!-- Registre des pointages -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col mb-lg">
                <!-- Toolbar de filtrage -->
                <div class="p-md border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-sm">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[#F46A21]">history</span>
                        <h3 class="font-bold text-sm text-slate-900 dark:text-white">Liste des Pointages</h3>
                        <button id="capteur-badge" type="button" title="État du lecteur biométrique — cliquer pour basculer"
                                class="ml-1 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border cursor-pointer transition-colors">
                            <span class="material-symbols-outlined text-[14px]" id="capteur-icon">sensors</span>
                            <span id="capteur-label">—</span>
                        </button>
                    </div>
                    <button class="text-xs font-semibold text-[#F46A21] dark:text-[#F9AE3F] hover:underline flex items-center gap-1 cursor-pointer" id="btn-refresh-history">
                        <span class="material-symbols-outlined text-[14px]">refresh</span> Actualiser
                    </button>
                </div>

                <!-- Filtres -->
                <div class="p-md border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-md">
                    <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs font-semibold" id="period-pills">
                        <button class="period-pill active px-3 py-1.5 rounded-lg cursor-pointer transition-all" data-period="today">Aujourd'hui</button>
                        <button class="period-pill text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg hover:text-slate-900 dark:hover:text-white cursor-pointer transition-all" data-period="date">Date</button>
                    </div>

                    <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 hidden" id="date-filter-wrap">
                        <span class="material-symbols-outlined text-slate-400 text-[18px]">calendar_month</span>
                        <input type="date" id="filter-date" class="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:ring-0">
                    </div>

                    <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700">
                        <span class="material-symbols-outlined text-slate-400 text-[18px]">filter_list</span>
                        <select id="filter-status" class="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:ring-0">
                            <option value="">Tous les Statuts</option>
                            <option value="present">Présents (À l'heure)</option>
                            <option value="retard">En Retard</option>
                            <option value="encours">Journée en cours (Sans sortie)</option>
                            <option value="sortie">Terminés (Sortie enregistrée)</option>
                        </select>
                    </div>

                    <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700">
                        <span class="material-symbols-outlined text-slate-400 text-[18px]">corporate_fare</span>
                        <select id="filter-dept" class="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:ring-0">
                            <option value="">Tous les Départements</option>
                            <!-- Populated by JS -->
                        </select>
                    </div>

                    <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 min-w-[220px]">
                        <span class="material-symbols-outlined text-slate-400 text-[18px]">search</span>
                        <input id="top-search" placeholder="Rechercher un employé..." class="bg-transparent border-none text-xs font-medium text-slate-700 dark:text-slate-200 outline-none w-full placeholder-slate-400">
                    </div>

                    <span class="ml-auto text-xs font-medium text-slate-500 dark:text-slate-400" id="pointage-count-summary"></span>
                </div>

                <!-- Table -->
                <div class="overflow-x-auto flex-1">
                    <table class="w-full text-left border-collapse text-[13px]">
                        <thead>
                            <tr class="border-b border-slate-200/60 dark:border-slate-800 font-semibold text-slate-400 uppercase text-[11px] tracking-wider bg-slate-50/30 dark:bg-slate-900">
                                <th class="py-md px-md">Employé</th>
                                <th class="py-md px-md">Date</th>
                                <th class="py-md px-md">Entrée</th>
                                <th class="py-md px-md">Sortie</th>
                                <th class="py-md px-md text-right">Statut</th>
                                <th class="py-md px-md text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60" id="history-body"></tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>

    <!-- Modal : Modifier les heures de pointage -->
    <div class="hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 items-center justify-center p-sm" id="modal-edit-pointage">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[420px] p-lg menu-dropdown-panel">
            <div class="flex justify-between items-center mb-lg border-b border-slate-100 dark:border-slate-800 pb-md">
                <div class="flex items-center gap-2">
                    <div class="w-9 h-9 rounded-xl bg-[#FFF1E8] dark:bg-orange-950 text-[#F46A21] flex items-center justify-center">
                        <span class="material-symbols-outlined">edit_calendar</span>
                    </div>
                    <div>
                        <h3 class="font-bold text-lg text-slate-900 dark:text-white">Modifier les heures</h3>
                        <p class="text-[11px] text-slate-400 font-mono" id="f-p-user">—</p>
                    </div>
                </div>
                <button class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer" data-close="modal-edit-pointage">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <form id="form-edit-pointage">
                <div class="space-y-md text-xs">
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-p-date">Date *</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-p-date" type="date" required>
                    </div>
                    <div class="grid grid-cols-2 gap-md">
                        <div>
                            <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-p-entree">Heure d'entrée *</label>
                            <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21] font-mono" id="f-p-entree" type="time" required>
                        </div>
                        <div>
                            <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-p-sortie">Heure de sortie</label>
                            <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21] font-mono" id="f-p-sortie" type="time">
                        </div>
                    </div>
                    <p class="text-[11px] text-slate-400">Laissez la sortie vide si la journée est toujours en cours.</p>
                </div>
                <div class="flex justify-end gap-sm mt-lg pt-md border-t border-slate-100 dark:border-slate-800">
                    <button type="button" class="px-md py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" data-close="modal-edit-pointage">Annuler</button>
                    <button type="submit" class="px-md py-2 rounded-xl text-xs font-semibold bg-[#F46A21] text-white hover:bg-[#EA580C] shadow-md shadow-orange-500/20 cursor-pointer">Enregistrer</button>
                </div>
            </form>
        </div>
    </div>

<script src="assets/js/data.js?v=<?= time() ?>"></script>
    <script src="assets/js/api.js?v=<?= time() ?>"></script>
    <script src="assets/js/templates.js?v=<?= time() ?>"></script>
    <script src="assets/js/app.js?v=<?= time() ?>"></script>
    <script src="assets/js/pages/pointage.js?v=<?= time() ?>"></script>
</body>
</html>
