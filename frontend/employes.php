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
    <title>Employés & Empreintes - P.Biometrique</title>
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
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" integrity="sha384-1DcZPGeODWbGGjS/i/n4ULX/pEc0DPcKK2WhyuWEmBXRfzOwoVTDQBN9C3C5jJHK" crossorigin="anonymous"></script>
    <script src="assets/js/theme.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" integrity="sha384-QgEpRMlHS1eb16ppCdNvZpgSnfgP7/JidxQdEi39i0icPBZP7cX7fe5Hy7RruCDN" crossorigin="anonymous">
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block" rel="stylesheet" integrity="sha384-2kBmDcgZhyUp2WK+Fjpm0T7UwKRHLJkDBBLJ/GUfgpHuBr5FLOwvUne/2WgYVbSu" crossorigin="anonymous">
    <link rel="stylesheet" href="assets/css/app.css?v=<?= time() ?>">
</head>
<body class="bg-[#F7F8FA] dark:bg-stone-950 text-[#303030] dark:text-slate-100 antialiased flex" data-page="employes" data-search="1">
    <div id="app-shell"></div>
    <div id="topbar-slot"></div>

    <div class="flex-1 md:ml-[280px] flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <main class="flex-1 mt-16 p-md md:p-xl max-w-container-max mx-auto w-full max-w-full overflow-x-hidden min-w-0">
            <div id="flash"></div>

            <!-- Page Title & Header Toolbar Menu -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-lg">
                <div>
                    <h2 class="font-bold text-2xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-[#F46A21]">badge</span>
                        Gestion des Employés
                    </h2>
                    <p class="text-slate-500 dark:text-slate-400 text-[13px] mt-0.5">Comptes utilisateurs et enrôlement des empreintes digitales</p>
                </div>
                <button class="bg-gradient-to-r from-[#F46A21] to-[#F9AE3F] hover:from-[#EA580C] hover:to-[#F59E0B] text-white font-semibold text-[13px] py-2.5 px-lg rounded-xl shadow-md shadow-orange-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-98" id="btn-add-user">
                    <span class="material-symbols-outlined text-[18px]">person_add</span>
                    Ajouter un employé
                </button>
            </div>

            <!-- Filter & Search Toolbar Menu -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-md rounded-2xl shadow-sm mb-lg flex flex-wrap items-center justify-between gap-md w-full max-w-full overflow-hidden">
                <div class="flex flex-wrap items-center gap-sm flex-1">
                    <!-- Department Filter Menu -->
                    <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-1.5 border border-slate-200 dark:border-slate-700">
                        <span class="material-symbols-outlined text-slate-400 text-[18px]">domain</span>
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

                <div class="text-xs font-mono text-slate-400" id="emp-count-summary">
                    Calcul en cours...
                </div>
            </div>

            <!-- Employee Table Card -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden w-full max-w-full">
                <div class="overflow-x-auto w-full max-w-full overscroll-x-contain">
                    <table class="w-full min-w-[520px] md:min-w-[640px] text-left border-collapse text-[13px]">
                                       <tr class="border-b border-slate-200/60 dark:border-slate-800 font-semibold text-slate-400 uppercase text-[11px] tracking-wider bg-slate-50/50 dark:bg-slate-900">
                                <th class="py-md px-md">Employé</th>
                                <th class="py-md px-md hidden md:table-cell">Matricule</th>
                                <th class="py-md px-md hidden md:table-cell">Email</th>
                                <th class="py-md px-md">Département</th>
                                <th class="py-md px-md text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60" id="users-body"></tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>

    <!-- Modal : Ajouter un employé -->
    <div class="hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 items-center justify-center p-sm" id="modal-add">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[560px] max-h-[90vh] overflow-y-auto p-lg menu-dropdown-panel">
            <div class="flex justify-between items-center mb-lg border-b border-slate-100 dark:border-slate-800 pb-md">
                <div class="flex items-center gap-2">
                    <div class="w-9 h-9 rounded-xl bg-[#FFF1E8] dark:bg-orange-950 text-[#F46A21] flex items-center justify-center">
                        <span class="material-symbols-outlined">person_add</span>
                    </div>
                    <h3 class="font-bold text-lg text-slate-900 dark:text-white">Ajouter un employé</h3>
                </div>
                <button class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer" data-close="modal-add">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <form id="form-add">
                <input type="hidden" id="f-role" value="employe">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-md text-xs">
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-matricule">Matricule *</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21] font-mono" id="f-matricule" placeholder="ex: EMP003" required>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-nom">Nom *</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-nom" placeholder="ex: Ravelo" required>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-prenom">Prénom *</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-prenom" placeholder="ex: Jean" required>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-email">Email</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-email" type="email" placeholder="ex: jean@mada.mg">
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-telephone">Téléphone</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-telephone" type="tel" placeholder="ex: +261 34 00 000 00">
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-date-embauche">Date d'embauche <span class="text-slate-400 font-normal">(auto)</span></label>
                        <input class="w-full bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21] font-mono text-slate-700 dark:text-slate-300" id="f-date-embauche" type="date" required>
                    </div>
                    <div class="md:col-span-2">
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-departement">Département</label>
                        <select class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21] cursor-pointer" id="f-departement">
                            <option value="">— Sélectionner un département —</option>
                            <option value="Direction Générale">Direction Générale</option>
                            <option value="Ressources Humaines">Ressources Humaines</option>
                            <option value="Informatique & Tech">Informatique &amp; Tech</option>
                            <option value="Finance & Comptabilité">Finance &amp; Comptabilité</option>
                            <option value="Marketing & Ventes">Marketing &amp; Ventes</option>
                        </select>
                    </div>
                </div>
                <div class="flex justify-end gap-sm mt-lg pt-md border-t border-slate-100 dark:border-slate-800">
                    <button type="button" class="px-md py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" data-close="modal-add">Annuler</button>
                    <button type="submit" class="px-md py-2 rounded-xl text-xs font-semibold bg-[#F46A21] text-white hover:bg-[#EA580C] shadow-md shadow-orange-500/20 cursor-pointer">Ajouter l'employé</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Modal : Modifier un employé -->
    <div class="hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 items-center justify-center p-sm" id="modal-edit">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[560px] max-h-[90vh] overflow-y-auto p-lg menu-dropdown-panel">
            <div class="flex justify-between items-center mb-lg border-b border-slate-100 dark:border-slate-800 pb-md">
                <div class="flex items-center gap-2">
                    <div class="w-9 h-9 rounded-xl bg-[#FFF1E8] dark:bg-orange-950 text-[#F46A21] flex items-center justify-center">
                        <span class="material-symbols-outlined">edit</span>
                    </div>
                    <h3 class="font-bold text-lg text-slate-900 dark:text-white">Modifier l'employé</h3>
                </div>
                <button class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer" data-close="modal-edit">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <form id="form-edit">
                <input type="hidden" id="f-edit-role" value="employe">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-md text-xs">
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-edit-matricule">Matricule *</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21] font-mono" id="f-edit-matricule" required>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-edit-nom">Nom *</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-edit-nom" required>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-edit-prenom">Prénom *</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-edit-prenom" required>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-edit-email">Email</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-edit-email" type="email">
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-edit-telephone">Téléphone</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-edit-telephone" type="tel" placeholder="ex: +261 34 00 000 00">
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-edit-date-embauche">Date d'embauche</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21] font-mono" id="f-edit-date-embauche" type="date">
                    </div>
                    <div class="md:col-span-2">
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-edit-departement">Département</label>
                        <select class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21] cursor-pointer" id="f-edit-departement">
                            <option value="">— Sélectionner un département —</option>
                            <option value="Direction Générale">Direction Générale</option>
                            <option value="Ressources Humaines">Ressources Humaines</option>
                            <option value="Informatique & Tech">Informatique &amp; Tech</option>
                            <option value="Finance & Comptabilité">Finance &amp; Comptabilité</option>
                            <option value="Marketing & Ventes">Marketing &amp; Ventes</option>
                        </select>
                    </div>
                    <div class="col-span-1 md:col-span-2 mt-xs">
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                            Photo de profil <span class="text-slate-400 font-normal">(modifier la photo)</span>
                        </label>
                        <div class="flex items-center gap-md">
                            <div id="photo-edit-thumb" class="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 overflow-hidden cursor-pointer transition-colors hover:border-[#F46A21]">
                                <span class="material-symbols-outlined text-[26px]">edit_square</span>
                            </div>
                            <div>
                                <input type="file" id="photo-edit-input" accept="image/jpeg,image/png,image/webp" class="hidden">
                                <button type="button" id="photo-edit-btn" class="text-xs font-semibold text-[#F46A21] hover:text-[#EA580C] border border-[#F46A21]/30 hover:bg-[#FFF1E8] dark:hover:bg-orange-950/30 px-md py-1.5 rounded-lg transition-colors cursor-pointer">
                                    Changer la photo
                                </button>
                                <p id="photo-edit-name" class="text-[11px] text-slate-400 mt-1">Conserver la photo actuelle</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex justify-end gap-sm mt-lg pt-md border-t border-slate-100 dark:border-slate-800">
                    <button type="button" class="px-md py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" data-close="modal-edit">Annuler</button>
                    <button type="submit" class="px-md py-2 rounded-xl text-xs font-semibold bg-[#F46A21] text-white hover:bg-[#EA580C] shadow-md shadow-orange-500/20 cursor-pointer">Enregistrer les modifications</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Modal : Consulter les détails de l'employé -->
    <div class="hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 items-center justify-center p-sm" id="modal-detail">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[560px] max-h-[90vh] overflow-y-auto p-lg menu-dropdown-panel">
            <div class="flex justify-between items-center mb-lg border-b border-slate-100 dark:border-slate-800 pb-md">
                <div class="flex items-center gap-2">
                    <div class="w-9 h-9 rounded-xl bg-[#FFF1E8] dark:bg-orange-950 text-[#F46A21] flex items-center justify-center">
                        <span class="material-symbols-outlined">badge</span>
                    </div>
                    <h3 class="font-bold text-lg text-slate-900 dark:text-white">Détails de l'employé</h3>
                </div>
                <button class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer" data-close="modal-detail">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>

            <div class="space-y-lg">
                <!-- Profile Banner Header -->
                <div class="flex items-center gap-lg bg-slate-50 dark:bg-slate-800/60 p-md rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                    <div id="detail-avatar-container">
                        <!-- Photo / Initial avatar -->
                    </div>
                    <div class="flex-1">
                        <h4 class="text-lg font-bold text-slate-900 dark:text-white" id="detail-name">—</h4>
                        <div class="flex items-center gap-2 mt-1 flex-wrap">
                            <span class="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200" id="detail-matricule">—</span>
                            <span id="detail-role-badge"></span>
                            <span id="detail-emp-badge"></span>
                        </div>
                    </div>
                </div>

                <!-- Details Grid -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-md text-xs">
                    <div class="p-md rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <span class="text-slate-400 dark:text-slate-500 font-medium block mb-1">Email</span>
                        <span class="text-slate-800 dark:text-slate-200 font-semibold text-sm flex items-center gap-1.5" id="detail-email">
                            <span class="material-symbols-outlined text-[16px] text-slate-400">mail</span> —
                        </span>
                    </div>

                    <div class="p-md rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <span class="text-slate-400 dark:text-slate-500 font-medium block mb-1">Téléphone</span>
                        <span class="text-slate-800 dark:text-slate-200 font-semibold text-sm flex items-center gap-1.5" id="detail-phone">
                            <span class="material-symbols-outlined text-[16px] text-slate-400">call</span> —
                        </span>
                    </div>

                    <div class="p-md rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <span class="text-slate-400 dark:text-slate-500 font-medium block mb-1">Département</span>
                        <span class="text-slate-800 dark:text-slate-200 font-semibold text-sm flex items-center gap-1.5" id="detail-dept">
                            <span class="material-symbols-outlined text-[16px] text-slate-400">domain</span> —
                        </span>
                    </div>

                    <div class="p-md rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <span class="text-slate-400 dark:text-slate-500 font-medium block mb-1">Date d'embauche</span>
                        <span class="text-slate-800 dark:text-slate-200 font-semibold text-sm flex items-center gap-1.5" id="detail-date-embauche">
                            <span class="material-symbols-outlined text-[16px] text-slate-400">calendar_today</span> —
                        </span>
                    </div>

                    <div class="p-md rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <span class="text-slate-400 dark:text-slate-500 font-medium block mb-1">Poste</span>
                        <span class="text-slate-800 dark:text-slate-200 font-semibold text-sm flex items-center gap-1.5" id="detail-poste">
                            <span class="material-symbols-outlined text-[16px] text-slate-400">work</span> —
                        </span>
                    </div>

                    <div class="p-md rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <span class="text-slate-400 dark:text-slate-500 font-medium block mb-1">Statut du compte</span>
                        <span class="text-emerald-600 dark:text-emerald-400 font-semibold text-sm flex items-center gap-1.5" id="detail-statut">
                            <span class="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span> Actif
                        </span>
                    </div>
                </div>

                <!-- Footer Action Buttons -->
                <div class="flex justify-between items-center pt-md border-t border-slate-100 dark:border-slate-800">
                    <button type="button" id="btn-detail-edit" class="px-md py-2 rounded-xl text-xs font-semibold bg-[#FFF1E8] dark:bg-orange-950/40 text-[#F46A21] dark:text-[#F9AE3F] border border-[#F46A21]/30 hover:bg-orange-100 transition-colors flex items-center gap-1.5 cursor-pointer">
                        <span class="material-symbols-outlined text-[16px]">edit</span> Modifier
                    </button>
                    <button type="button" class="px-md py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" data-close="modal-detail">Fermer</button>
                </div>
            </div>
        </div>
    </div>



<script src="assets/js/data.js?v=<?= time() ?>"></script>
    <script src="assets/js/api.js?v=<?= time() ?>"></script>
    <script src="assets/js/templates.js?v=<?= time() ?>"></script>
    <script src="assets/js/app.js?v=<?= time() ?>"></script>
    <script src="assets/js/pages/employes.js?v=<?= time() ?>"></script>
</body>
</html>
