// ============================================================
// TEMPLATES HTML INTÉGRÉS (FALLBACK SANS RECHARGEMENT POUR FILE:// ET HTTP)
// ============================================================

const PAGE_TEMPLATES = {
    dashboard: `
    <main class="flex-1 mt-16 p-md md:p-xl max-w-container-max mx-auto w-full">
        <div id="flash"></div>
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-lg rounded-2xl shadow-sm">
            <div>
                <div class="flex items-center gap-sm">
                    <h2 class="font-bold text-2xl tracking-tight text-slate-900 dark:text-white">Aperçu de Présence</h2>
                    <span class="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Direct
                    </span>
                </div>
                <p class="text-slate-500 dark:text-slate-400 text-[13px] mt-0.5" id="today-date">Chargement de la date...</p>
            </div>
            <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 text-[12px] font-medium" id="dashboard-period-menu">
                <button class="filter-pill active px-3 py-1.5 rounded-lg" data-period="today">Aujourd'hui</button>
                <button class="filter-pill text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg hover:text-slate-900 dark:hover:text-white" data-period="7d">7 derniers jours</button>
                <button class="filter-pill text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg hover:text-slate-900 dark:hover:text-white" data-period="30d">Ce mois</button>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg mb-lg">
            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-lg shadow-sm card-hover flex flex-col justify-between relative overflow-hidden">
                <div class="flex items-center justify-between mb-sm">
                    <span class="text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">Total Effectif</span>
                    <div class="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
                        <span class="material-symbols-outlined">groups</span>
                    </div>
                </div>
                <div>
                    <div class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white" id="kpi-total">—</div>
                    <div class="text-[11px] text-slate-400 dark:text-slate-400 mt-1 flex items-center gap-1">
                        <span class="text-emerald-500 font-semibold flex items-center"><span class="material-symbols-outlined text-[14px]">check</span> Actif</span> dans la base
                    </div>
                </div>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-lg shadow-sm card-hover flex flex-col justify-between relative overflow-hidden">
                <div class="flex items-center justify-between mb-sm">
                    <span class="text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">Présents</span>
                    <div class="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <span class="material-symbols-outlined">how_to_reg</span>
                    </div>
                </div>
                <div>
                    <div class="flex items-baseline justify-between">
                        <div class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white" id="kpi-presents">—</div>
                        <span class="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5">
                            <span class="material-symbols-outlined text-[14px]">arrow_upward</span>
                            <span id="kpi-pct">—</span>
                        </span>
                    </div>
                    <div class="text-[11px] text-slate-400 dark:text-slate-400 mt-1">Taux de présence du jour</div>
                </div>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-lg shadow-sm card-hover flex flex-col justify-between relative overflow-hidden">
                <div class="flex items-center justify-between mb-sm">
                    <span class="text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">Absents</span>
                    <div class="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                        <span class="material-symbols-outlined">person_off</span>
                    </div>
                </div>
                <div>
                    <div class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white" id="kpi-absents">—</div>
                    <div class="text-[11px] text-rose-500 font-medium mt-1">Non pointés à cette heure</div>
                </div>
            </div>

            <div class="bg-gradient-to-br from-orange-600 via-orange-500 to-orange-700 text-white rounded-2xl p-lg shadow-lg card-hover flex flex-col justify-between relative overflow-hidden">
                <div class="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
                <div class="flex items-center justify-between mb-sm">
                    <span class="text-[12px] font-bold uppercase tracking-wider text-orange-100">Total Scans</span>
                    <div class="w-9 h-9 rounded-xl bg-white/15 text-white flex items-center justify-center backdrop-blur-sm">
                        <span class="material-symbols-outlined">fingerprint</span>
                    </div>
                </div>
                <div>
                    <div class="text-3xl font-extrabold tracking-tight" id="kpi-pointages">—</div>
                    <div class="mt-2 biometric-scan h-8 flex items-center justify-center border border-white/20 rounded-lg bg-white/5 relative">
                        <span class="material-symbols-outlined text-orange-100 text-xl opacity-70">fingerprint</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-lg">
            <div class="col-span-1 lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div class="p-md border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-orange-600">history</span>
                        <h3 class="font-bold text-[15px] text-slate-900 dark:text-white">Derniers pointages enregistrés</h3>
                    </div>
                    <a class="text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1" href="pointage.html">
                        Voir tout <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </a>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-[13px]">
                        <thead>
                            <tr class="border-b border-slate-200/60 dark:border-slate-800 font-semibold text-slate-400 uppercase text-[11px] tracking-wider bg-slate-50/30 dark:bg-slate-900">
                                <th class="py-md px-md w-12 text-center">Avatar</th>
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

            <div class="col-span-1 lg:col-span-4 flex flex-col gap-lg">
                <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-md shadow-sm">
                    <div class="flex items-center justify-between mb-md">
                        <h3 class="font-bold text-[15px] text-slate-900 dark:text-white flex items-center gap-2">
                            <span class="material-symbols-outlined text-blue-600">equalizer</span>
                            Flux de pointe en journée
                        </h3>
                    </div>
                    <div class="relative h-44 w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl p-md flex items-end justify-between gap-1 border border-slate-100 dark:border-slate-800" id="activity-bars"></div>
                    <div class="flex justify-between mt-sm text-[11px] text-slate-400 font-mono">
                        <span>Horaires: 07h — 18h</span>
                        <span class="text-blue-600 font-semibold" id="activity-peak">Pic à 08h</span>
                    </div>
                </div>

                <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-md shadow-sm flex-1 flex flex-col">
                    <h3 class="font-bold text-[15px] text-slate-900 dark:text-white mb-md flex items-center gap-2">
                        <span class="material-symbols-outlined text-blue-600">bolt</span>
                        Menu d'Actions Rapides
                    </h3>
                    <div class="flex flex-col gap-sm flex-1 justify-center">
                        <button class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-[13px] py-2.5 px-md rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98" id="btn-force">
                            <span class="material-symbols-outlined text-[18px]">add_circle</span>
                            Forcer un pointage manuel
                        </button>
                        <button class="w-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-semibold text-[13px] py-2.5 px-md rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98" id="btn-report">
                            <span class="material-symbols-outlined text-[18px]">summarize</span>
                            Générer Rapport (PDF/CSV)
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal : Forcer Pointage -->
        <div class="hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 items-center justify-center p-sm" id="modal-force-pointage">
            <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-lg menu-dropdown-panel">
                <div class="flex justify-between items-center mb-md border-b border-slate-100 dark:border-slate-800 pb-sm">
                    <h3 class="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-blue-600">add_circle</span> Forcer un pointage
                    </h3>
                    <button class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer" onclick="closeModal('modal-force-pointage')">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <form id="form-force-pointage">
                    <div class="mb-md">
                        <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Sélectionner l'employé</label>
                        <select id="force-select-user" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-md py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                        </select>
                    </div>
                    <div class="mb-lg">
                        <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Type de pointage</label>
                        <div class="grid grid-cols-2 gap-sm">
                            <label class="flex items-center gap-2 p-2 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                                <input type="radio" name="force-type" value="entree" checked class="text-blue-600 focus:ring-blue-500">
                                <span class="text-xs font-semibold">Entrée</span>
                            </label>
                            <label class="flex items-center gap-2 p-2 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                                <input type="radio" name="force-type" value="sortie" class="text-blue-600 focus:ring-blue-500">
                                <span class="text-xs font-semibold">Sortie</span>
                            </label>
                        </div>
                    </div>
                    <div class="flex justify-end gap-sm">
                        <button type="button" class="px-md py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" onclick="closeModal('modal-force-pointage')">Annuler</button>
                        <button type="submit" class="px-md py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20">Enregistrer</button>
                    </div>
                </form>
            </div>
        </div>
    </main>`,

    employes: `
    <main class="flex-1 mt-16 p-md md:p-xl max-w-container-max mx-auto w-full">
        <div id="flash"></div>
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-lg">
            <div>
                <h2 class="font-bold text-2xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    <span class="material-symbols-outlined text-blue-600">badge</span>
                    Gestion des Employés
                </h2>
                <p class="text-slate-500 dark:text-slate-400 text-[13px] mt-0.5">Comptes utilisateurs et enrôlement des empreintes digitales</p>
            </div>
            <button class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-[13px] py-2.5 px-lg rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-98" id="btn-add-user">
                <span class="material-symbols-outlined text-[18px]">person_add</span>
                Ajouter un employé
            </button>
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-md rounded-2xl shadow-sm mb-lg flex flex-wrap items-center justify-between gap-md">
            <div class="flex flex-wrap items-center gap-sm flex-1">
                <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-1.5 border border-slate-200 dark:border-slate-700">
                    <span class="material-symbols-outlined text-slate-400 text-[18px]">domain</span>
                    <select id="filter-dept" class="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:ring-0">
                        <option value="">Tous les Départements</option>
                        <option value="Web & mobile">Web &amp; mobile</option>
                        <option value="Infogérance">Infogérance</option>
                        <option value="ERP sur mesure">ERP sur mesure</option>
                        <option value="IA & data">IA &amp; data</option>
                        <option value="Fintech Gplus">Fintech Gplus</option>
                        <option value="Sécurité">Sécurité</option>
                        <option value="Réseaux">Réseaux</option>
                        <option value="Communication digitale">Communication digitale</option>
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

            <div class="text-xs font-mono text-slate-400" id="emp-count-summary">Calcul en cours...</div>
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-[13px]">
                    <thead>
                        <tr class="border-b border-slate-200/60 dark:border-slate-800 font-semibold text-slate-400 uppercase text-[11px] tracking-wider bg-slate-50/50 dark:bg-slate-900">
                            <th class="py-md px-md">Employé</th>
                            <th class="py-md px-md">Matricule</th>
                            <th class="py-md px-md hidden md:table-cell">Email</th>
                            <th class="py-md px-md">Département</th>
                            <th class="py-md px-md">Rôle</th>
                            <th class="py-md px-md">Empreinte</th>
                            <th class="py-md px-md text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60" id="users-body"></tbody>
                </table>
            </div>
        </div>

        <!-- Modal : Ajouter un employé -->
        <div class="hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 items-center justify-center p-sm" id="modal-add">
            <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[560px] max-h-[90vh] overflow-y-auto p-lg menu-dropdown-panel">
                <div class="flex justify-between items-center mb-lg border-b border-slate-100 dark:border-slate-800 pb-md">
                    <div class="flex items-center gap-2">
                        <div class="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                            <span class="material-symbols-outlined">person_add</span>
                        </div>
                        <h3 class="font-bold text-lg text-slate-900 dark:text-white">Ajouter un employé</h3>
                    </div>
                    <button class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer" data-close="modal-add">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <form id="form-add">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-md text-xs">
                        <div>
                            <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-matricule">Matricule *</label>
                            <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono" id="f-matricule" placeholder="ex: EMP003" required>
                        </div>
                        <div>
                            <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-nom">Nom *</label>
                            <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500" id="f-nom" placeholder="ex: Ravelo" required>
                        </div>
                        <div>
                            <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-prenom">Prénom</label>
                            <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500" id="f-prenom" placeholder="ex: Jean">
                        </div>
                        <div>
                            <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-email">Email</label>
                            <input class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500" id="f-email" type="email" placeholder="ex: jean@mada.mg">
                        </div>
                        <div>
                            <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-departement">Département</label>
                            <select class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" id="f-departement">
                                <option value="">— Sélectionner un département —</option>
                                <option value="Web & mobile">Web &amp; mobile</option>
                                <option value="Infogérance">Infogérance</option>
                                <option value="ERP sur mesure">ERP sur mesure</option>
                                <option value="IA & data">IA &amp; data</option>
                                <option value="Fintech Gplus">Fintech Gplus</option>
                                <option value="Sécurité">Sécurité</option>
                                <option value="Réseaux">Réseaux</option>
                                <option value="Communication digitale">Communication digitale</option>
                            </select>
                        </div>
                        <div>
                            <label class="font-semibold text-slate-600 dark:text-slate-300 mb-1 block" for="f-role">Rôle</label>
                            <select class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" id="f-role">
                                <option value="employe">Employé</option>
                                <option value="admin">Administrateur RH</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex justify-end gap-sm mt-lg pt-md border-t border-slate-100 dark:border-slate-800">
                        <button type="button" class="px-md py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" data-close="modal-add">Annuler</button>
                        <button type="submit" class="px-md py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer">Ajouter l'employé</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Modal : Enrôlement empreinte -->
        <div class="hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 items-center justify-center p-sm" id="modal-enroll">
            <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[420px] p-lg text-center relative overflow-hidden menu-dropdown-panel">
                <div class="flex justify-between items-center mb-md relative border-b border-slate-100 dark:border-slate-800 pb-sm">
                    <h3 class="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-blue-600">fingerprint</span> Enrôlement Biométrique
                    </h3>
                    <button class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer" data-close="modal-enroll">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="relative flex flex-col items-center py-md">
                    <div class="w-24 h-24 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center mb-lg transition-colors duration-300 shadow-inner" id="enroll-icon">
                        <span class="material-symbols-outlined text-[48px]">fingerprint</span>
                    </div>
                    <h4 class="font-bold text-base text-slate-900 dark:text-white" id="enroll-person">—</h4>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 min-h-[1.25rem]" id="enroll-step">Placez le doigt de l'employé sur le capteur.</p>
                    
                    <button class="mt-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs py-2.5 px-xl rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-98" id="btn-enroll">
                        <span class="material-symbols-outlined text-[18px]">touch_app</span>
                        Simuler la pose du doigt
                    </button>
                    <p class="text-[11px] text-slate-400 mt-sm">Lecteur SDK Biomatique simulé activement.</p>
                </div>
            </div>
        </div>
    </main>`,

    historique: `
    <main class="flex-1 mt-16 p-md md:p-xl max-w-container-max mx-auto w-full">
        <div id="flash"></div>
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-lg">
            <div>
                <h2 class="font-bold text-2xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    <span class="material-symbols-outlined text-blue-600">history</span>
                    Historique Général des Pointages
                </h2>
                <p class="text-slate-500 dark:text-slate-400 text-[13px] mt-0.5">Registre complet des entrées, sorties et heures de présence biométriques</p>
            </div>
            <div class="flex items-center gap-sm">
                <button class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-md py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-2 cursor-pointer" id="btn-export-history">
                    <span class="material-symbols-outlined text-[18px]">download</span> Exporter CSV
                </button>
                <button class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold px-md py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer" onclick="window.print()">
                    <span class="material-symbols-outlined text-[18px]">print</span> Imprimer Rapport
                </button>
            </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md mb-lg">
            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-md shadow-sm">
                <div class="flex items-center justify-between text-slate-400 mb-2">
                    <span class="text-xs font-semibold uppercase tracking-wider">Total Registres</span>
                    <span class="material-symbols-outlined text-blue-600">receipt_long</span>
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
                    <span class="material-symbols-outlined text-indigo-600">task_alt</span>
                </div>
                <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400" id="stat-completes">0</div>
                <div class="text-[11px] text-slate-400 mt-1">Pointages entrée et sortie enregistrés</div>
            </div>
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm p-md mb-lg flex flex-wrap items-center justify-between gap-md">
            <div class="flex flex-wrap items-center gap-md">
                <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs font-semibold" id="period-pills">
                    <button class="period-pill active px-3 py-1.5 rounded-lg cursor-pointer transition-all" data-period="all">Tous</button>
                    <button class="period-pill text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg hover:text-slate-900 dark:hover:text-white cursor-pointer transition-all" data-period="today">Aujourd'hui</button>
                    <button class="period-pill text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg hover:text-slate-900 dark:hover:text-white cursor-pointer transition-all" data-period="7d">7 Derniers jours</button>
                    <button class="period-pill text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg hover:text-slate-900 dark:hover:text-white cursor-pointer transition-all" data-period="30d">30 Derniers jours</button>
                </div>

                <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700">
                    <span class="material-symbols-outlined text-slate-400 text-[18px]">filter_list</span>
                    <select id="filter-status" class="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:ring-0">
                        <option value="">Tous les Statuts</option>
                        <option value="present">Présents (À l'heure)</option>
                        <option value="retard">En Retard</option>
                        <option value="encours">Journée en cours (Sans sortie)</option>
                    </select>
                </div>

                <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-md py-2 border border-slate-200 dark:border-slate-700">
                    <span class="material-symbols-outlined text-slate-400 text-[18px]">corporate_fare</span>
                    <select id="filter-dept" class="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:ring-0">
                        <option value="">Tous les Départements</option>
                        <option value="Web & mobile">Web &amp; mobile</option>
                        <option value="Infogérance">Infogérance</option>
                        <option value="ERP sur mesure">ERP sur mesure</option>
                        <option value="IA & data">IA &amp; data</option>
                        <option value="Fintech Gplus">Fintech Gplus</option>
                        <option value="Sécurité">Sécurité</option>
                        <option value="Réseaux">Réseaux</option>
                        <option value="Communication digitale">Communication digitale</option>
                    </select>
                </div>
            </div>

            <div class="text-xs font-mono text-slate-400" id="records-count-summary">Affichage du registre...</div>
        </div>

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
                            <th class="py-md px-md">Durée</th>
                            <th class="py-md px-md text-right">Statut</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60" id="history-table-body"></tbody>
                </table>
            </div>
        </div>
    </main>`,

    pointage: `
    <main class="flex-1 mt-16 p-md md:p-xl max-w-container-max mx-auto w-full">
        <div id="flash"></div>
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-lg">
            <div>
                <h2 class="font-bold text-2xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    <span class="material-symbols-outlined text-blue-600">fingerprint</span>
                    Borne de Pointage Biométrique
                </h2>
                <p class="text-slate-500 dark:text-slate-400 text-[13px] mt-0.5">Interface de numérisation et de validation en temps réel</p>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-lg">
            <div class="col-span-1 lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-lg shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                <div class="w-full flex items-center justify-between mb-md border-b border-slate-100 dark:border-slate-800 pb-sm">
                    <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Capteur Optique SDK</span>
                    <span class="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Actif
                    </span>
                </div>

                <p class="text-xs text-slate-500 dark:text-slate-400 mb-md">Sélectionnez l'employé à pointer :</p>
                
                <div class="w-full mb-md">
                    <select id="user-select" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-md py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500">
                    </select>
                </div>

                <div class="relative group my-md cursor-pointer" id="btn-scan">
                    <div class="w-36 h-36 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-800 text-white flex items-center justify-center shadow-xl shadow-blue-500/25 group-hover:scale-105 transition-transform duration-300 biometric-scan relative overflow-hidden" id="bio-icon">
                        <span class="material-symbols-outlined text-[72px]" id="scanner-icon">fingerprint</span>
                    </div>
                </div>

                <p class="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-lg" id="scan-hint">Cliquez sur l'empreinte pour valider le scan</p>

                <div class="w-full bg-slate-50 dark:bg-slate-800/60 rounded-xl p-md border border-slate-100 dark:border-slate-800 text-left hidden" id="user-card">
                    <div class="flex items-center gap-md">
                        <div class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm" id="card-avatar">U</div>
                        <div>
                            <div class="font-bold text-slate-900 dark:text-white text-sm" id="card-name">Nom Utilisateur</div>
                            <div class="text-xs text-slate-400 font-mono" id="card-mat">EMP000</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-span-1 lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div class="p-md border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900">
                    <h3 class="font-bold text-[15px] text-slate-900 dark:text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-blue-600">schedule</span>
                        Pointages d'Aujourd'hui
                    </h3>
                    <button class="text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer" id="btn-refresh-history">
                        <span class="material-symbols-outlined text-[14px]">refresh</span> Actualiser
                    </button>
                </div>

                <div class="overflow-x-auto flex-1">
                    <table class="w-full text-left border-collapse text-[13px]">
                        <thead>
                            <tr class="border-b border-slate-200/60 dark:border-slate-800 font-semibold text-slate-400 uppercase text-[11px] tracking-wider bg-slate-50/30 dark:bg-slate-900">
                                <th class="py-md px-md">Employé</th>
                                <th class="py-md px-md">Entrée</th>
                                <th class="py-md px-md">Sortie</th>
                                <th class="py-md px-md text-right">Statut</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60" id="history-body"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </main>`
};
