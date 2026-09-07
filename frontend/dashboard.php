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
    <title>Tableau de bord - P.Biometrique</title>
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
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="assets/js/theme.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" crossorigin="anonymous">
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block" rel="stylesheet" crossorigin="anonymous">
    <link rel="stylesheet" href="assets/css/app.css?v=<?= time() ?>">
</head>
<body class="bg-[#F7F8FA] dark:bg-stone-950 text-[#303030] dark:text-slate-100 antialiased flex" data-page="dashboard">
<!-- Dynamic App Shell & Topbar loaded by app.js -->
<div id="app-shell"></div>
<div id="topbar-slot"></div>

<!-- Main Content Area -->
<div class="flex-1 md:ml-[280px] flex flex-col min-h-screen">
    <main class="flex-1 mt-16 p-md md:p-xl max-w-container-max mx-auto w-full">
        <div id="flash"></div>

        <!-- Header Bar & Period Selector Menu -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-lg bg-white dark:bg-stone-900 border border-slate-200/80 dark:border-stone-800 p-lg rounded-2xl shadow-sm">
            <div>
                <div class="flex items-center gap-sm">
                    <h2 class="font-bold text-2xl tracking-tight text-[#303030] dark:text-white">Tableau de Bord & Analytics</h2>
                    <span class="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Direct
                    </span>
                </div>
                <p class="text-slate-500 dark:text-stone-400 text-[13px] mt-0.5" id="today-date">Chargement de la date...</p>
            </div>

            <!-- Time Filter Menu Pills -->
            <div class="flex items-center gap-1 bg-slate-100 dark:bg-stone-800 p-1 rounded-xl border border-slate-200 dark:border-stone-700/60 text-[12px] font-medium" id="dashboard-period-menu">
                <button class="filter-pill active px-3 py-1.5 rounded-lg transition-colors cursor-pointer" data-period="today">Aujourd'hui</button>
                <button class="filter-pill text-slate-600 dark:text-stone-400 px-3 py-1.5 rounded-lg hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer" data-period="7d">Cette semaine</button>
                <button class="filter-pill text-slate-600 dark:text-stone-400 px-3 py-1.5 rounded-lg hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer" data-period="30d">Ce mois</button>
            </div>
        </div>

        <!-- 1. KPI Grid (5 Principal Cards) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-md mb-lg">
            <!-- Taux de Présence -->
            <div class="bg-white dark:bg-stone-900 border border-slate-200/80 dark:border-stone-800 rounded-2xl p-md shadow-sm card-hover flex flex-col justify-between relative overflow-hidden">
                <div class="flex items-center justify-between mb-sm">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-stone-400">Taux de Présence</span>
                    <div class="w-8 h-8 rounded-xl bg-[#FFF1E8] dark:bg-orange-950/40 text-[#F46A21] dark:text-[#F9AE3F] flex items-center justify-center">
                        <span class="material-symbols-outlined text-[20px]">donut_large</span>
                    </div>
                </div>
                <div>
                    <div class="text-3xl font-extrabold tracking-tight text-[#303030] dark:text-white" id="kpi-pct">—</div>
                    <div class="text-[11px] text-emerald-500 font-semibold mt-1 flex items-center gap-1">
                        <span class="material-symbols-outlined text-[13px]">trending_up</span> Objectif : >80%
                    </div>
                </div>
            </div>

            <!-- Présents -->
            <div class="bg-white dark:bg-stone-900 border border-slate-200/80 dark:border-stone-800 rounded-2xl p-md shadow-sm card-hover flex flex-col justify-between relative overflow-hidden">
                <div class="flex items-center justify-between mb-sm">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-stone-400">Présents</span>
                    <div class="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <span class="material-symbols-outlined text-[20px]">how_to_reg</span>
                    </div>
                </div>
                <div>
                    <div class="text-3xl font-extrabold tracking-tight text-[#303030] dark:text-white" id="kpi-presents">—</div>
                    <div class="text-[11px] text-slate-400 dark:text-stone-500 mt-1">Employés à leur poste</div>
                </div>
            </div>

            <!-- Absents -->
            <div class="bg-white dark:bg-stone-900 border border-slate-200/80 dark:border-stone-800 rounded-2xl p-md shadow-sm card-hover flex flex-col justify-between relative overflow-hidden">
                <div class="flex items-center justify-between mb-sm">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-stone-400">Absents</span>
                    <div class="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                        <span class="material-symbols-outlined text-[20px]">person_off</span>
                    </div>
                </div>
                <div>
                    <div class="text-3xl font-extrabold tracking-tight text-[#303030] dark:text-white" id="kpi-absents">—</div>
                    <div class="text-[11px] text-rose-500 font-medium mt-1">Non pointés</div>
                </div>
            </div>

            <!-- Retardataires -->
            <div class="bg-white dark:bg-stone-900 border border-slate-200/80 dark:border-stone-800 rounded-2xl p-md shadow-sm card-hover flex flex-col justify-between relative overflow-hidden">
                <div class="flex items-center justify-between mb-sm">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-stone-400">Retardataires</span>
                    <div class="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <span class="material-symbols-outlined text-[20px]">schedule</span>
                    </div>
                </div>
                <div>
                    <div class="text-3xl font-extrabold tracking-tight text-[#303030] dark:text-white" id="kpi-retards">—</div>
                    <div class="text-[11px] text-amber-500 font-medium mt-1">Arrivés après 09:00</div>
                </div>
            </div>

            <!-- Total Effectif -->
            <div class="bg-gradient-to-br from-[#F46A21] via-[#E05910] to-[#C44A00] text-white rounded-2xl p-md shadow-md card-hover flex flex-col justify-between relative overflow-hidden">
                <div class="flex items-center justify-between mb-sm">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-orange-100">Total Effectif</span>
                    <div class="w-8 h-8 rounded-xl bg-white/15 text-white flex items-center justify-center backdrop-blur-sm">
                        <span class="material-symbols-outlined text-[20px]">groups</span>
                    </div>
                </div>
                <div>
                    <div class="text-3xl font-extrabold tracking-tight" id="kpi-total">—</div>
                    <div class="text-[11px] text-orange-100/80 mt-1">Effectif total inscrit</div>
                </div>
            </div>
        </div>

        <!-- 2. Charts Row 1: Répartition (Donut) & Évolution (Bar/Line Chart) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-lg mb-lg">
            <!-- Donut Chart : Répartition des présences -->
            <div class="col-span-1 lg:col-span-5 bg-white dark:bg-stone-900 border border-slate-200/80 dark:border-stone-800 rounded-2xl p-lg shadow-sm flex flex-col justify-between">
                <div class="flex items-center justify-between mb-md pb-xs border-b border-slate-100 dark:border-stone-800">
                    <h3 class="font-bold text-[15px] text-[#303030] dark:text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-[#F46A21]">pie_chart</span>
                        Répartition des Présences
                    </h3>
                    <span class="text-[11px] text-slate-400 font-mono">En direct</span>
                </div>

                <div class="relative h-56 flex items-center justify-center my-auto">
                    <canvas id="chart-presence-donut" class="max-h-56"></canvas>
                    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                        <span class="text-2xl font-extrabold text-slate-900 dark:text-white" id="donut-center-pct">0%</span>
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assiduité</span>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-2 pt-md border-t border-slate-100 dark:border-stone-800 text-center text-xs">
                    <div class="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/50">
                        <div class="text-emerald-700 dark:text-emerald-300 font-bold" id="legend-presents">0</div>
                        <div class="text-[10px] text-slate-500 dark:text-slate-400">À l'heure</div>
                    </div>
                    <div class="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-900/50">
                        <div class="text-amber-700 dark:text-amber-300 font-bold" id="legend-retards">0</div>
                        <div class="text-[10px] text-slate-500 dark:text-slate-400">En retard</div>
                    </div>
                    <div class="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50 dark:border-rose-900/50">
                        <div class="text-rose-700 dark:text-rose-300 font-bold" id="legend-absents">0</div>
                        <div class="text-[10px] text-slate-500 dark:text-slate-400">Absents</div>
                    </div>
                </div>
            </div>

            <!-- Bar/Line Chart : Évolution de l'assiduité -->
            <div class="col-span-1 lg:col-span-7 bg-white dark:bg-stone-900 border border-slate-200/80 dark:border-stone-800 rounded-2xl p-lg shadow-sm flex flex-col justify-between">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-sm mb-md pb-xs border-b border-slate-100 dark:border-stone-800">
                    <div>
                        <h3 class="font-bold text-[15px] text-[#303030] dark:text-white flex items-center gap-2">
                            <span class="material-symbols-outlined text-[#F46A21]">show_chart</span>
                            Évolution de l'Assiduité
                        </h3>
                        <p class="text-[11px] text-slate-400 mt-0.5">Suivi historique des Présences, Retards et Absences</p>
                    </div>
                    <div class="flex items-center gap-1 bg-slate-100 dark:bg-stone-800 p-1 rounded-xl text-[11px] font-medium" id="chart-trend-selector">
                        <button class="trend-btn active bg-[#F46A21] text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer" data-view="7d">Semaine</button>
                        <button class="trend-btn text-slate-600 dark:text-stone-400 px-2.5 py-1 rounded-lg hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer" data-view="30d">Mois</button>
                    </div>
                </div>

                <div class="relative h-64 w-full">
                    <canvas id="chart-attendance-trend"></canvas>
                </div>
            </div>
        </div>

        <!-- 3. Heures Travaillées -->
        <div class="grid grid-cols-1 gap-lg mb-lg">
            <!-- Bar Chart : Heures Travaillées par Département -->
            <div class="bg-white dark:bg-stone-900 border border-slate-200/80 dark:border-stone-800 rounded-2xl p-lg shadow-sm flex flex-col justify-between">
                <div class="flex items-center justify-between mb-md pb-xs border-b border-slate-100 dark:border-stone-800">
                    <div>
                        <h3 class="font-bold text-[15px] text-[#303030] dark:text-white flex items-center gap-2">
                            <span class="material-symbols-outlined text-[#F46A21]">schedule</span>
                            Heures Travaillées & Volume
                        </h3>
                        <p class="text-[11px] text-slate-400 mt-0.5">Volume moyen d'heures effectuées par département</p>
                    </div>
                    <span class="bg-[#FFF1E8] dark:bg-orange-950/40 text-[#F46A21] dark:text-[#F9AE3F] text-[11px] font-bold px-2.5 py-1 rounded-full border border-[#F46A21]/25 dark:border-orange-900 font-mono" id="avg-hours-badge">
                        Moyenne: 7.8h / jour
                    </span>
                </div>

                <div class="relative h-60 w-full">
                    <canvas id="chart-hours-worked"></canvas>
                </div>
            </div>
        </div>

        <!-- 4. Derniers Pointages & Flux Horaires -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-lg">
            <!-- Table: Derniers Pointages -->
            <div class="col-span-1 lg:col-span-8 bg-white dark:bg-stone-900 border border-slate-200/80 dark:border-stone-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div class="p-md border-b border-slate-100 dark:border-stone-800 flex justify-between items-center bg-slate-50/50 dark:bg-stone-800/40">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[#F46A21]">history</span>
                        <h3 class="font-bold text-[15px] text-[#303030] dark:text-white">Derniers pointages enregistrés</h3>
                    </div>
                    <a class="text-xs font-semibold text-[#F46A21] hover:underline flex items-center gap-1" href="pointage.php">
                        Voir la borne <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </a>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-[13px]">
                        <thead>
                            <tr class="border-b border-slate-200/60 dark:border-slate-800 font-semibold text-slate-400 uppercase text-[11px] tracking-wider bg-slate-50/30 dark:bg-slate-900">
                                <th class="py-md px-md w-12 text-center">Photo</th>
                                <th class="py-md px-md">Employé</th>
                                <th class="py-md px-md">Heure</th>
                                <th class="py-md px-md">Département</th>
                                <th class="py-md px-md text-right">Statut</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60" id="today-table-body"></tbody>
                    </table>
                </div>
            </div>

            <!-- Flux Horaires (Hourly Peak Bar Graphic) -->
            <div class="col-span-1 lg:col-span-4 flex flex-col gap-lg">
                <div class="bg-white dark:bg-stone-900 border border-slate-200/80 dark:border-stone-800 rounded-2xl p-md shadow-sm">
                    <div class="flex items-center justify-between mb-md">
                        <h3 class="font-bold text-[15px] text-slate-900 dark:text-white flex items-center gap-2">
                            <span class="material-symbols-outlined text-[#F46A21]">equalizer</span>
                            Flux de Pointe (Horaires)
                        </h3>
                    </div>
                    <div class="relative h-36 w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl p-md flex items-end justify-between gap-1 border border-slate-100 dark:border-slate-800" id="activity-bars"></div>
                    <div class="flex justify-between mt-sm text-[11px] text-slate-400 font-mono">
                        <span>Horaires: 07h — 18h</span>
                        <span class="text-[#F46A21] font-semibold" id="activity-peak">Pic à 08h</span>
                    </div>
                </div>
            </div>
        </div>
    </main>
</div>

<!-- Modal: Forcer Pointage -->
<div class="hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 items-center justify-center p-sm" id="modal-force-pointage">
    <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-lg menu-dropdown-panel">
        <div class="flex justify-between items-center mb-md border-b border-slate-100 dark:border-slate-800 pb-sm">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <span class="material-symbols-outlined text-[#F46A21]">add_circle</span> Forcer un pointage
            </h3>
            <button class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer" onclick="closeModal('modal-force-pointage')">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>
        <form id="form-force-pointage">
            <div class="mb-md">
                <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Sélectionner l'employé</label>
                <select id="force-select-user" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-md py-2 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]">
                    <!-- Populated dynamically -->
                </select>
            </div>
            <div class="mb-lg">
                <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Type de pointage</label>
                <div class="grid grid-cols-2 gap-sm">
                    <label class="flex items-center gap-2 p-2 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                        <input type="radio" name="force-type" value="entree" checked class="text-[#F46A21] focus:ring-[#F46A21]">
                        <span class="text-xs font-semibold">Entrée</span>
                    </label>
                    <label class="flex items-center gap-2 p-2 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                        <input type="radio" name="force-type" value="sortie" class="text-[#F46A21] focus:ring-[#F46A21]">
                        <span class="text-xs font-semibold">Sortie</span>
                    </label>
                </div>
            </div>
            <div class="flex justify-end gap-sm">
                <button type="button" class="px-md py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" onclick="closeModal('modal-force-pointage')">Annuler</button>
                <button type="submit" class="px-md py-2 rounded-xl text-xs font-semibold bg-[#F46A21] text-white hover:bg-[#EA580C] shadow-md shadow-orange-500/20">Enregistrer</button>
            </div>
        </form>
    </div>
</div>

<script src="assets/js/data.js?v=<?= time() ?>"></script>
<script src="assets/js/api.js?v=<?= time() ?>"></script>
<script src="assets/js/templates.js?v=<?= time() ?>"></script>
<script src="assets/js/app.js?v=<?= time() ?>"></script>
<script src="assets/js/pages/dashboard.js?v=<?= time() ?>"></script>
</body>
</html>
