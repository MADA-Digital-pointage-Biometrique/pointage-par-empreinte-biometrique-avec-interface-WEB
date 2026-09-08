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
    <title>Gestion des Administrateurs - P.Biometrique</title>
    <script src="assets/js/theme-init.js"></script>
    <link rel="stylesheet" href="assets/css/tailwind.css?v=<?= asset_ver('assets/css/tailwind.css') ?>">
    <link rel="stylesheet" href="assets/css/app.css?v=<?= asset_ver('assets/css/app.css') ?>">
</head>
<body class="bg-[#F7F8FA] dark:bg-stone-950 text-[#303030] dark:text-slate-100 antialiased flex" data-page="administrateurs" data-search="1">
    <div id="app-shell"></div>
    <div id="topbar-slot"></div>

    <div class="flex-1 md:ml-[280px] flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <main class="flex-1 mt-16 p-md md:p-xl max-w-container-max mx-auto w-full max-w-full overflow-x-hidden min-w-0">
            <div id="flash"></div>

            <!-- Page Header -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-lg">
                <div>
                    <h2 class="font-bold text-2xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-[#F46A21]">admin_panel_settings</span>
                        Gestion des Administrateurs
                    </h2>
                    <p class="text-slate-500 dark:text-slate-400 text-[13px] mt-0.5">Comptes d'accès, mots de passe et privilèges de gestion de la plateforme</p>
                </div>
                <button class="bg-gradient-to-r from-[#F46A21] to-[#F9AE3F] hover:from-[#EA580C] hover:to-[#F59E0B] text-white text-xs font-semibold px-md py-2.5 rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 cursor-pointer" data-open="modal-add-admin">
                    <span class="material-symbols-outlined text-[18px]">person_add</span> Nouveau Administrateur
                </button>
            </div>

            <!-- Toolbar de filtres -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm p-md mb-lg flex flex-wrap items-center justify-between gap-md w-full max-w-full overflow-hidden">
                <div class="flex flex-wrap items-center gap-md">
                    <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 min-w-[240px]">
                        <span class="material-symbols-outlined text-slate-400 text-[18px]">search</span>
                        <input id="top-search" placeholder="Rechercher un administrateur..." class="bg-transparent border-none text-xs font-medium text-slate-700 dark:text-slate-200 outline-none w-full placeholder-slate-400">
                    </div>

                    <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700">
                        <span class="material-symbols-outlined text-slate-400 text-[18px]">shield</span>
                        <select id="filter-privilege" class="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:ring-0">
                            <option value="">Tous les Privilèges</option>
                            <option value="admin">Administrateur RH</option>
                            <option value="super_admin">Super Administrateur</option>
                        </select>
                    </div>
                </div>

                <div class="text-xs font-mono text-slate-400" id="admin-count-summary">
                    Affichage des administrateurs...
                </div>
            </div>

            <!-- Administrators Table Card -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden w-full max-w-full">
                <div class="overflow-x-auto w-full max-w-full overscroll-x-contain">
                    <table class="w-full min-w-[360px] sm:min-w-[520px] md:min-w-[720px] text-left border-collapse text-[13px]">
                        <thead>
                            <tr class="border-b border-slate-200/60 dark:border-slate-800 font-semibold text-slate-400 uppercase text-[11px] tracking-wider bg-slate-50/50 dark:bg-slate-900">
                                <th class="py-md px-md">Administrateur</th>
                                <th class="py-md px-md hidden md:table-cell">Matricule</th>
                                <th class="py-md px-md hidden md:table-cell">Email Accès</th>
                                <th class="py-md px-md hidden md:table-cell">Département</th>
                                <th class="py-md px-md">Privilège</th>
                                <th class="py-md px-md hidden md:table-cell">Empreinte</th>
                                <th class="py-md px-md text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60" id="admins-body"></tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>

    <!-- Modal : Ajouter un administrateur -->
    <div class="hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 items-center justify-center p-sm" id="modal-add-admin">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[580px] max-h-[90vh] overflow-y-auto p-lg menu-dropdown-panel">
            <div class="flex justify-between items-center mb-lg border-b border-slate-100 dark:border-slate-800 pb-md">
                <div class="flex items-center gap-2">
                    <div class="w-9 h-9 rounded-xl bg-[#FFF1E8] dark:bg-orange-950 text-[#F46A21] flex items-center justify-center">
                        <span class="material-symbols-outlined">person_add_alt</span>
                    </div>
                    <div>
                        <h3 class="font-bold text-lg text-slate-900 dark:text-white">Créer un compte Administrateur</h3>
                        <p class="text-[11px] text-slate-400">Compte habilité avec mot de passe de connexion</p>
                    </div>
                </div>
                <button class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer" data-close="modal-add-admin">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <form id="form-add-admin" autocomplete="off">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-md text-xs">
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block text-xs">
                            Matricule <span class="text-slate-400 font-normal">(auto-généré)</span>
                        </label>
                        <div class="w-full bg-slate-100 dark:bg-slate-700/50 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-500 dark:text-slate-300 select-all" id="f-admin-matricule-preview">
                            Chargement...
                        </div>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-admin-nom">Nom *</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-admin-nom" placeholder="ex: Rakoto" required>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-admin-prenom">Prénom *</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-admin-prenom" placeholder="ex: Paul" required>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-admin-email">Email de connexion *</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-admin-email" type="email" placeholder="ex: admin@mada-digital.mg" required>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-admin-telephone">Téléphone</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-admin-telephone" type="tel" placeholder="ex: +261 34 00 000 00">
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-admin-date-embauche">Date de prise de poste</label>
                        <input class="w-full bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21] font-mono" id="f-admin-date-embauche" type="date" required>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block">Département</label>
                        <input type="hidden" id="f-admin-departement" value="Direction Générale">
                        <div class="w-full bg-slate-100 dark:bg-slate-700/50 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300">Direction Générale</div>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-admin-role">Niveau de Privilège</label>
                        <select class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21] cursor-pointer" id="f-admin-role">
                            <option value="admin">Administrateur RH</option>
                            <option value="super_admin">Super Administrateur Système</option>
                        </select>
                    </div>

                    <!-- Champs de Mot de Passe -->
                    <div class="col-span-1 md:col-span-2 pt-xs border-t border-slate-100 dark:border-slate-800">
                        <label class="font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-1.5 text-[13px]">
                            <span class="material-symbols-outlined text-[#F46A21] text-[18px]">key</span>
                            Identifiants de connexion
                        </label>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
                            <div>
                                <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-admin-password">Mot de passe *</label>
                                <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-admin-password" type="password" placeholder="Mot de passe système" required>
                            </div>
                            <div>
                                <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-admin-password-confirm">Confirmer le mot de passe *</label>
                                <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-admin-password-confirm" type="password" placeholder="Répéter le mot de passe" required>
                            </div>
                        </div>
                    </div>

                </div>
                <div class="flex justify-end gap-sm mt-lg pt-md border-t border-slate-100 dark:border-slate-800">
                    <button type="button" class="px-md py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" data-close="modal-add-admin">Annuler</button>
                    <button type="submit" class="px-md py-2 rounded-xl text-xs font-semibold bg-[#F46A21] text-white hover:bg-[#EA580C] shadow-md shadow-orange-500/20 cursor-pointer">Créer l'Administrateur</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Modal : Modifier un administrateur -->
    <div class="hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 items-center justify-center p-sm" id="modal-edit-admin">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[580px] max-h-[90vh] overflow-y-auto p-lg menu-dropdown-panel">
            <div class="flex justify-between items-center mb-lg border-b border-slate-100 dark:border-slate-800 pb-md">
                <div class="flex items-center gap-2">
                    <div class="w-9 h-9 rounded-xl bg-[#FFF1E8] dark:bg-orange-950 text-[#F46A21] flex items-center justify-center">
                        <span class="material-symbols-outlined">manage_accounts</span>
                    </div>
                    <div>
                        <h3 class="font-bold text-lg text-slate-900 dark:text-white">Modifier le compte Administrateur</h3>
                        <p class="text-[11px] text-slate-400 font-mono" id="f-admin-edit-subtitle">—</p>
                    </div>
                </div>
                <button class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer" data-close="modal-edit-admin">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <form id="form-edit-admin" autocomplete="off">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-md text-xs">
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-admin-edit-matricule">Matricule *</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21] font-mono" id="f-admin-edit-matricule" required>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-admin-edit-nom">Nom *</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-admin-edit-nom" required>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-admin-edit-prenom">Prénom *</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-admin-edit-prenom" required>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-admin-edit-email">Email de connexion *</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-admin-edit-email" type="email" required>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-admin-edit-telephone">Téléphone</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-admin-edit-telephone" type="tel">
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-admin-edit-date-embauche">Date d'embauche</label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21] font-mono" id="f-admin-edit-date-embauche" type="date">
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block">Département</label>
                        <input type="hidden" id="f-admin-edit-departement" value="Direction Générale">
                        <div class="w-full bg-slate-100 dark:bg-slate-700/50 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300">Direction Générale</div>
                    </div>
                    <div>
                        <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-admin-edit-role">Privilège</label>
                        <select class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21] cursor-pointer" id="f-admin-edit-role">
                            <option value="admin">Administrateur RH</option>
                            <option value="super_admin">Super Administrateur Système</option>
                        </select>
                    </div>

                    <!-- Réinitialisation du mot de passe -->
                    <div class="col-span-1 md:col-span-2 pt-xs border-t border-slate-100 dark:border-slate-800">
                        <label class="font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-1.5 text-[13px]">
                            <span class="material-symbols-outlined text-[#F46A21] text-[18px]">lock_reset</span>
                            Nouveau mot de passe <span class="text-slate-400 font-normal text-xs">(laisser vide pour ne pas modifier)</span>
                        </label>
                        <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[#F46A21]" id="f-admin-edit-password" type="password" placeholder="Nouveau mot de passe de l'administrateur">
                    </div>

                </div>
                <div class="flex justify-end gap-sm mt-lg pt-md border-t border-slate-100 dark:border-slate-800">
                    <button type="button" class="px-md py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" data-close="modal-edit-admin">Annuler</button>
                    <button type="submit" class="px-md py-2 rounded-xl text-xs font-semibold bg-[#F46A21] text-white hover:bg-[#EA580C] shadow-md shadow-orange-500/20 cursor-pointer">Enregistrer les modifications</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Modal : Fiche détaillée de l'Administrateur -->
    <div class="hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 items-center justify-center p-sm" id="modal-detail-admin">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[500px] overflow-hidden menu-dropdown-panel">
            <!-- Header du profil -->
            <div class="bg-gradient-to-r from-[#F46A21] to-[#F9AE3F] p-lg text-white relative">
                <button class="absolute top-4 right-4 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-1 transition-colors cursor-pointer" data-close="modal-detail-admin">
                    <span class="material-symbols-outlined text-[20px]">close</span>
                </button>
                <div class="flex items-center gap-md">
                    <div id="detail-admin-photo" class="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center font-bold text-2xl shadow-md overflow-hidden shrink-0">
                        <!-- Photo ou initiales -->
                    </div>
                    <div>
                        <h3 class="font-bold text-xl leading-tight" id="detail-admin-name">—</h3>
                        <p class="text-xs text-orange-100 font-mono mt-0.5" id="detail-admin-matricule">—</p>
                        <span class="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 backdrop-blur-sm text-white border border-white/30" id="detail-admin-role">
                            —
                        </span>
                    </div>
                </div>
            </div>

            <!-- Corps de la fiche -->
            <div class="p-lg space-y-md text-xs">
                <div class="grid grid-cols-2 gap-md">
                    <div class="bg-slate-50 dark:bg-slate-800/50 p-md rounded-xl border border-slate-100 dark:border-slate-800">
                        <span class="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider mb-1">Email Accès</span>
                        <span class="font-semibold text-slate-800 dark:text-slate-100 text-[13px] break-all" id="detail-admin-email">—</span>
                    </div>
                    <div class="bg-slate-50 dark:bg-slate-800/50 p-md rounded-xl border border-slate-100 dark:border-slate-800">
                        <span class="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider mb-1">Téléphone</span>
                        <span class="font-semibold text-slate-800 dark:text-slate-100 text-[13px]" id="detail-admin-telephone">—</span>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-md">
                    <div class="bg-slate-50 dark:bg-slate-800/50 p-md rounded-xl border border-slate-100 dark:border-slate-800">
                        <span class="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider mb-1">Département</span>
                        <span class="font-semibold text-slate-800 dark:text-slate-100 text-[13px]" id="detail-admin-dept">—</span>
                    </div>
                    <div class="bg-slate-50 dark:bg-slate-800/50 p-md rounded-xl border border-slate-100 dark:border-slate-800">
                        <span class="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider mb-1">Prise de poste</span>
                        <span class="font-semibold text-slate-800 dark:text-slate-100 text-[13px] font-mono" id="detail-admin-embauche">—</span>
                    </div>
                </div>

                <div class="bg-slate-50 dark:bg-slate-800/50 p-md rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <span class="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider mb-0.5">Statut Biométrique</span>
                        <span class="text-slate-600 dark:text-slate-300 text-xs">Empreinte digitale enregistrée</span>
                    </div>
                    <span id="detail-admin-empreinte-badge"></span>
                </div>
            </div>

            <!-- Footer d'action direct vers modification -->
            <div class="p-md bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-sm">
                <button type="button" class="px-md py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" data-close="modal-detail-admin">Fermer</button>
                <button type="button" id="btn-edit-from-detail-admin" class="px-md py-2 rounded-xl text-xs font-semibold bg-[#F46A21] text-white hover:bg-[#EA580C] shadow-md shadow-orange-500/20 cursor-pointer flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[16px]">edit</span>
                    Modifier l'administrateur
                </button>
            </div>
        </div>
    </div>

    <!-- Modal : Enrôlement d'empreinte (réutilisée) -->
    <div class="hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 items-center justify-center p-sm" id="modal-enroll">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[420px] p-lg text-center menu-dropdown-panel">
            <div class="w-16 h-16 rounded-full bg-[#FFF1E8] dark:bg-orange-950/60 text-[#F46A21] mx-auto flex items-center justify-center mb-md border border-[#F46A21]/20">
                <span class="material-symbols-outlined text-3xl animate-pulse">fingerprint</span>
            </div>
            <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-xs" id="enroll-user-name">Enrôlement Empreinte</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-lg">Posez le doigt sur le scanner biométrique USB pour associer l'empreinte.</p>

            <div class="bg-slate-50 dark:bg-slate-800/80 p-md rounded-xl border border-slate-200 dark:border-slate-700 mb-lg font-mono text-xs text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2" id="enroll-status">
                <span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                Attente de la capture biométrique...
            </div>

            <div class="flex flex-col gap-sm">
                <button type="button" id="btn-sim-finger" class="w-full bg-[#F46A21] hover:bg-[#EA580C] text-white font-semibold text-xs py-2.5 rounded-xl shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <span class="material-symbols-outlined text-[18px]">sensors</span>
                    Capturer l'empreinte
                </button>
                <button type="button" class="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs py-2 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer" data-close="modal-enroll">
                    Annuler
                </button>
            </div>
        </div>
    </div>

<script src="assets/js/data.js?v=<?= asset_ver('assets/js/data.js') ?>"></script>
    <script src="assets/js/api.js?v=<?= asset_ver('assets/js/api.js') ?>"></script>
    <script src="assets/js/templates.js?v=<?= asset_ver('assets/js/templates.js') ?>"></script>
    <script src="assets/js/app.js?v=<?= asset_ver('assets/js/app.js') ?>"></script>
    <script src="assets/js/pages/administrateurs.js?v=<?= asset_ver('assets/js/pages/administrateurs.js') ?>"></script>
</body>
</html>
