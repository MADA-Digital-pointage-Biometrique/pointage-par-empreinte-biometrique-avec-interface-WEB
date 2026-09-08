<?php
require_once __DIR__ . '/../config/session.php';
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
    <script src="assets/js/theme-init.js"></script>
    <link rel="stylesheet" href="assets/css/tailwind.css?v=<?= time() ?>">
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

            <!-- Card : Mode Opératoire & Choix Employé Cible -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-lg shadow-sm mb-lg" id="card-mode-operatoire">
                <div class="flex items-center gap-2 mb-xs">
                    <span class="material-symbols-outlined text-[#F46A21] text-[20px]">tune</span>
                    <h3 class="font-bold text-[15px] text-slate-900 dark:text-white">Mode Opératoire du Terminal</h3>
                </div>
                <p class="text-[13px] text-slate-500 dark:text-slate-400 mb-md">Définissez le mode de fonctionnement du terminal biométrique. Ce réglage conditionne le comportement de la borne lors de la détection d'une empreinte.</p>
                <div id="mode-capteur-notice" class="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border mb-lg">
                    <span class="material-symbols-outlined text-[14px]">sensors</span>
                    <span id="mode-capteur-notice-text">Capteur En service requis pour changer de mode</span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-md" id="mode-selector-grid">
                    <!-- Mode Enrôlement -->
                    <button id="btn-mode-enrolement"
                        class="mode-btn group relative flex flex-col items-start gap-md p-lg rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer overflow-hidden"
                        data-mode="enrolement">
                        <div class="absolute inset-0 mode-btn-gradient opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                        <div class="relative flex items-center justify-between w-full">
                            <div class="w-11 h-11 rounded-xl mode-icon-bg flex items-center justify-center shadow-md transition-all">
                                <span class="material-symbols-outlined text-[24px]">fingerprint</span>
                            </div>
                            <div class="mode-check-ring w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all">
                                <span class="material-symbols-outlined text-[14px] mode-check-icon hidden">check</span>
                            </div>
                        </div>
                        <div class="relative">
                            <div class="font-bold text-[15px] mode-title">Enrôlement</div>
                            <div class="text-[12px] mt-0.5 mode-desc leading-relaxed">Le terminal capture et enregistre les empreintes digitales des nouveaux employés.</div>
                        </div>
                        <div class="relative flex items-center gap-1.5">
                            <span class="mode-badge inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                                <span class="material-symbols-outlined text-[11px]">add_circle</span>
                                Enrôlement actif
                            </span>
                        </div>
                    </button>

                    <!-- Mode Pointage -->
                    <button id="btn-mode-pointage"
                        class="mode-btn group relative flex flex-col items-start gap-md p-lg rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer overflow-hidden"
                        data-mode="pointage">
                        <div class="absolute inset-0 mode-btn-gradient opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                        <div class="relative flex items-center justify-between w-full">
                            <div class="w-11 h-11 rounded-xl mode-icon-bg flex items-center justify-center shadow-md transition-all">
                                <span class="material-symbols-outlined text-[24px]">how_to_reg</span>
                            </div>
                            <div class="mode-check-ring w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all">
                                <span class="material-symbols-outlined text-[14px] mode-check-icon hidden">check</span>
                            </div>
                        </div>
                        <div class="relative">
                            <div class="font-bold text-[15px] mode-title">Pointage</div>
                            <div class="text-[12px] mt-0.5 mode-desc leading-relaxed">Le terminal identifie l'employé et enregistre automatiquement son heure d'entrée ou de sortie.</div>
                        </div>
                        <div class="relative flex items-center gap-1.5">
                            <span class="mode-badge inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                                <span class="material-symbols-outlined text-[11px]">schedule</span>
                                Pointage actif
                            </span>
                        </div>
                    </button>
                </div>

                <!-- Mode actif info banner -->
                <div id="mode-info-banner" class="mt-md flex items-center gap-sm px-md py-sm rounded-xl border text-[12px] font-medium transition-all">
                    <span class="material-symbols-outlined text-[16px]" id="mode-banner-icon">info</span>
                    <span id="mode-banner-text">Aucun mode sélectionné.</span>
                </div>

                <!-- Panneau sélection employé (mode Enrôlement uniquement) -->
                <div id="panel-enroll-target" class="hidden mt-lg">
                    <div class="h-px bg-slate-100 dark:bg-slate-800 mb-lg"></div>
                    <div class="flex items-center gap-2 mb-sm">
                        <span class="material-symbols-outlined text-[#F46A21] text-[18px]">person_search</span>
                        <h4 class="font-bold text-[14px] text-slate-900 dark:text-white">Employé cible de l'enrôlement</h4>
                    </div>
                    <p class="text-[12px] text-slate-500 dark:text-slate-400 mb-md">Sélectionnez l'employé à qui sera assignée la prochaine empreinte capturée par le terminal biométrique.</p>

                    <!-- Recherche + liste -->
                    <div id="enroll-target-state-search" class="">
                        <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-2.5 border border-slate-200 dark:border-slate-700 focus-within:border-[#F46A21] focus-within:ring-2 focus-within:ring-[#F46A21]/20 transition-all mb-sm">
                            <span class="material-symbols-outlined text-slate-400 text-[18px]">search</span>
                            <input id="enroll-target-search" type="text" placeholder="Nom, prénom ou matricule..." autocomplete="off"
                                class="bg-transparent border-none w-full text-[13px] text-slate-700 dark:text-slate-200 outline-none placeholder-slate-400">
                            <button id="enroll-target-clear" class="hidden text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer transition-colors">
                                <span class="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        </div>

                        <!-- Résultats de recherche -->
                        <div id="enroll-target-results" class="hidden flex-col gap-xs max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                            <!-- Peuplé dynamiquement -->
                        </div>
                    </div>

                    <!-- Employé sélectionné (état confirmé) -->
                    <div id="enroll-target-selected" class="hidden">
                        <div class="flex items-center justify-between gap-md p-md rounded-2xl border-2 border-[#F46A21]/40 bg-gradient-to-r from-[#FFF7ED] to-[#FFFBF5] dark:from-orange-950/30 dark:to-slate-900 shadow-sm">
                            <div class="flex items-center gap-md">
                                <div id="enroll-sel-avatar" class="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[16px] shadow-md flex-shrink-0">—</div>
                                <div>
                                    <div class="font-bold text-[14px] text-slate-900 dark:text-white" id="enroll-sel-name">—</div>
                                    <div class="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5" id="enroll-sel-meta">—</div>
                                    <div id="enroll-sel-fp-badge" class="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"></div>
                                </div>
                            </div>
                            <div class="flex flex-col items-end gap-2">
                                <button id="btn-launch-enroll" class="flex items-center gap-1.5 bg-gradient-to-r from-[#F46A21] to-[#F9AE3F] text-white text-[12px] font-semibold px-md py-2 rounded-xl shadow-md shadow-orange-500/20 hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer">
                                    <span class="material-symbols-outlined text-[15px]">fingerprint</span>
                                    Lancer l'enrôlement
                                </button>
                                <button id="btn-change-enroll-target" class="text-[11px] text-slate-400 hover:text-[#F46A21] dark:hover:text-[#F9AE3F] transition-colors cursor-pointer flex items-center gap-1">
                                    <span class="material-symbols-outlined text-[12px]">swap_horiz</span>
                                    Changer d'employé
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Aucun employé ne correspond -->
                    <div id="enroll-target-empty" class="hidden flex-col items-center py-lg text-center">
                        <span class="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[40px] mb-sm">group_off</span>
                        <p class="text-[13px] text-slate-500 dark:text-slate-400">Aucun employé ne correspond à cette recherche.</p>
                    </div>
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
                <!-- Indicateur 2 captures -->
                <div id="enroll-steps" class="flex items-center gap-3 mb-4">
                    <div id="step-1" class="flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-semibold bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500">
                        <span class="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[12px]">1</span>
                        <span>Capture 1</span>
                        <span class="material-symbols-outlined text-[14px] step-icon hidden">check</span>
                    </div>
                    <span class="material-symbols-outlined text-slate-300 text-[16px]">arrow_forward</span>
                    <div id="step-2" class="flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-semibold bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500">
                        <span class="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[12px]">2</span>
                        <span>Capture 2</span>
                        <span class="material-symbols-outlined text-[14px] step-icon hidden">check</span>
                    </div>
                </div>
                <div class="w-24 h-24 rounded-full bg-[#FFF1E8] dark:bg-orange-950 text-[#F46A21] flex items-center justify-center mb-lg transition-colors duration-300 shadow-inner" id="enroll-icon">
                    <span class="material-symbols-outlined text-[48px]">fingerprint</span>
                </div>
                <h4 class="font-bold text-base text-slate-900 dark:text-white" id="enroll-person">—</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 min-h-[1.25rem]" id="enroll-step">Placez le doigt de l'employé sur le capteur.</p>
                <div id="enroll-progress" class="hidden w-full max-w-[260px] h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-3">
                    <div id="enroll-progress-bar" class="h-full bg-gradient-to-r from-[#F46A21] to-[#F9AE3F] transition-all duration-500" style="width:0%"></div>
                </div>
                <button class="mt-lg bg-gradient-to-r from-[#F46A21] to-[#F9AE3F] hover:from-[#EA580C] hover:to-[#F59E0B] text-white font-semibold text-xs py-2.5 px-xl rounded-xl shadow-md shadow-orange-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-98" id="btn-enroll">
                    <span class="material-symbols-outlined text-[18px]">touch_app</span>
                    Poser le doigt sur le lecteur
                </button>
                <p class="text-[11px] text-slate-400 mt-sm" id="enroll-hint">Placez votre doigt sur le lecteur biométrique.</p>
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
