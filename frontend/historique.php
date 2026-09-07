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
    <title>Historique des Pointages & Rapports - P.Biometrique</title>
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
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <script src="assets/js/theme.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/app.css?v=<?= time() ?>">
</head>
<body class="bg-[#F7F8FA] dark:bg-stone-950 text-[#303030] dark:text-slate-100 antialiased flex" data-page="historique" data-search="1">
    <!-- Dynamic App Shell & Topbar loaded by app.js -->
    <div id="app-shell"></div>
    <div id="topbar-slot"></div>

    <div class="flex-1 md:ml-[280px] flex flex-col min-h-screen">
        <main class="flex-1 mt-16 p-md md:p-xl max-w-container-max mx-auto w-full">
            <div id="flash"></div>

            <!-- Page Header & Action Controls -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-lg">
                <div>
                    <h2 class="font-bold text-2xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-[#F46A21]">history</span>
                        Historique Général des Pointages
                    </h2>
                    <p class="text-slate-500 dark:text-slate-400 text-[13px] mt-0.5">Registre complet des entrées, sorties et heures de présence biométriques</p>
                </div>
                <div class="flex items-center gap-sm">
                    <button class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-md py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-2 cursor-pointer" id="btn-export-history">
                        <span class="material-symbols-outlined text-[18px]">download</span> Exporter CSV
                    </button>
                    <button class="bg-gradient-to-r from-[#F46A21] to-[#F9AE3F] hover:from-[#EA580C] hover:to-[#F59E0B] text-white text-xs font-semibold px-md py-2.5 rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 cursor-pointer" onclick="window.print()">
                        <span class="material-symbols-outlined text-[18px]">print</span> Imprimer Rapport
                    </button>
                </div>
            </div>

            <!-- Header Summary KPI Stats Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md mb-lg">
                <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-md shadow-sm">
                    <div class="flex items-center justify-between text-slate-400 mb-2">
                        <span class="text-xs font-semibold uppercase tracking-wider">Total Registres</span>
                        <span class="material-symbols-outlined text-[#F46A21]">receipt_long</span>
                    </div>
                    <div class="text-2xl font-black text-slate-900 dark:text-white" id="stat-total-records">0</div>
                    <div class="text-[11px] text-slate-400 mt-1">Horodatages enregistrés sur la période</div>
                </div>

                <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-md shadow-sm">
                    <div class="flex items-center justify-between text-slate-400 mb-2">
                        <span class="text-xs font-semibold uppercase tracking-wider">Taux de Ponctualité</span>
                        <span class="material-symbols-outlined text-emerald-600">verified</span>
                    </div>
                    <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400" id="stat-ponctualite">0%</div>
                    <div class="text-[11px] text-slate-400 mt-1">Pointages avant 09:00 AM</div>
                </div>

                <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-md shadow-sm">
                    <div class="flex items-center justify-between text-slate-400 mb-2">
                        <span class="text-xs font-semibold uppercase tracking-wider">Total Retards</span>
                        <span class="material-symbols-outlined text-amber-600">warning</span>
                    </div>
                    <div class="text-2xl font-black text-amber-600 dark:text-amber-400" id="stat-retards-count">0</div>
                    <div class="text-[11px] text-slate-400 mt-1">Horodatages après l'heure légale</div>
                </div>

                <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-md shadow-sm">
                    <div class="flex items-center justify-between text-slate-400 mb-2">
                        <span class="text-xs font-semibold uppercase tracking-wider">Présences Complètes</span>
                        <span class="material-symbols-outlined text-[#F46A21]">task_alt</span>
                    </div>
                    <div class="text-2xl font-black text-[#F46A21] dark:text-[#F9AE3F]" id="stat-completes">0</div>
                    <div class="text-[11px] text-slate-400 mt-1">Pointages entrée et sortie enregistrés</div>
                </div>
            </div>

            <!-- History Multi-Criteria Filter Menu Toolbar -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm p-md mb-lg flex flex-wrap items-center justify-between gap-md">
                <div class="flex flex-wrap items-center gap-md">
                    <!-- Period Filter Menu -->
                    <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs font-semibold" id="period-pills">
                        <button class="period-pill active px-3 py-1.5 rounded-lg cursor-pointer transition-all" data-period="today">Aujourd'hui</button>
                        <button class="period-pill text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg hover:text-slate-900 dark:hover:text-white cursor-pointer transition-all" data-period="date">Date</button>
                    </div>

                    <!-- Date Picker (visible quand « Date » est actif) -->
                    <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 hidden" id="date-filter-wrap">
                        <span class="material-symbols-outlined text-slate-400 text-[18px]">calendar_month</span>
                        <input type="date" id="filter-date" class="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:ring-0">
                    </div>

                    <!-- Status Filter Menu Dropdown -->
                    <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700">
                        <span class="material-symbols-outlined text-slate-400 text-[18px]">filter_list</span>
                        <select id="filter-status" class="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:ring-0">
                            <option value="">Tous les Statuts</option>
                            <option value="present">Présents (À l'heure)</option>
                            <option value="retard">En Retard</option>
                            <option value="encours">Journée en cours (Sans sortie)</option>
                        </select>
                    </div>

                    <!-- Department Filter Menu Dropdown -->
                    <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700">
                        <span class="material-symbols-outlined text-slate-400 text-[18px]">corporate_fare</span>
                        <select id="filter-dept" class="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:ring-0">
                            <option value="">Tous les Départements</option>
                            <option value="Direction Générale">Direction Générale</option>
                            <option value="Ressources Humaines">Ressources Humaines</option>
                            <option value="Informatique & Tech">Informatique &amp; Tech</option>
                            <option value="Finance & Comptabilité">Finance &amp; Comptabilité</option>
                            <option value="Marketing & Ventes">Marketing &amp; Ventes</option>
                        </select>
                    </div>
                </div>

                <div class="text-xs font-mono text-slate-400" id="records-count-summary">
                    Affichage du registre...
                </div>
            </div>

            <!-- Attendance History Table Card -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-[13px]">
                        <thead>
                            <tr class="border-b border-slate-200/60 dark:border-slate-800 font-semibold text-slate-400 uppercase text-[11px] tracking-wider bg-slate-50/50 dark:bg-slate-900">
                                <th class="py-md px-md">Employé</th>
                                <th class="py-md px-md">Date</th>
                                <th class="py-md px-md">Département</th>
                                <th class="py-md px-md">Heure Entrée</th>
                                <th class="py-md px-md">Heure Sortie</th>
                                <th class="py-md px-md">Durée Estimée</th>
                                <th class="py-md px-md text-right">Statut Biométrique</th>
                                <th class="py-md px-md text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60" id="history-table-body">
                            <!-- Dynamically loaded -->
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>

    <!-- Modal : Modifier un pointage -->
    <div class="hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 items-center justify-center p-sm" id="modal-edit-pointage">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[420px] p-lg menu-dropdown-panel">
            <div class="flex justify-between items-center mb-lg border-b border-slate-100 dark:border-slate-800 pb-md">
                <div class="flex items-center gap-2">
                    <div class="w-9 h-9 rounded-xl bg-[#FFF1E8] dark:bg-orange-950 text-[#F46A21] flex items-center justify-center">
                        <span class="material-symbols-outlined">edit_calendar</span>
                    </div>
                    <div>
                        <h3 class="font-bold text-lg text-slate-900 dark:text-white">Modifier un pointage</h3>
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
    <script src="assets/js/app.js?v=<?= time() ?>"></script>
    <script src="assets/js/pages/historique.js?v=<?= time() ?>"></script>
</body>
</html>
