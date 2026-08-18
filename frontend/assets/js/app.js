// ============================================================
// Shell partagé & Système de Menus Interactifs (MADA Digital)
// ============================================================

function icon(name, size = 18, filled = false) {
    return `<span class="material-symbols-outlined ${filled ? 'filled' : ''}" style="font-size:${size}px;">${name}</span>`;
}

function initialsOf(u) {
    if (!u || !u.prenom || !u.nom) return 'U';
    return (u.prenom[0] + u.nom[0]).toUpperCase();
}

const NAV_SECTIONS = [
    {
        title: 'VUE GÉNÉRALE',
        items: [
            { page: 'dashboard', link: 'dashboard.html', icon: 'dashboard', label: 'Tableau de bord' },
            { page: 'pointage', link: 'pointage.html', icon: 'fingerprint', label: 'Borne de Pointage', badge: 'En service' },
        ]
    },
    {
        title: 'GESTION DE L\'EFFECTIF',
        items: [
            { page: 'employes', link: 'employes.html', icon: 'badge', label: 'Employés & Empreintes', adminOnly: true, badgeId: 'badge-count-emp' },
            { page: 'historique', link: 'historique.html', icon: 'history', label: 'Historique des Pointages' },
        ]
    }
];

// Sample System Notifications
let notificationsList = [
    { id: 1, title: 'Pointage à l\'heure', time: 'Il y a 5 min', text: 'EMP001 (Marc Dubois) a pointé à 08:02', read: false, icon: 'check_circle', color: 'text-emerald-500' },
    { id: 2, title: 'Nouvel enrôlement', time: 'Il y a 25 min', text: 'Empreinte enregistrée pour ADM001', read: false, icon: 'fingerprint', color: 'text-blue-500' },
    { id: 3, title: 'Retard détecté', time: 'Hier à 08:45', text: 'EMP002 (Sophie Martin) a pointé en retard', read: true, icon: 'warning', color: 'text-amber-500' }
];

function buildShell() {
    const user = api.getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const current = document.body.dataset.page;

    // ----------------------------------------------------
    // 1. SIDEBAR MENU BUILD
    // ----------------------------------------------------
    const appShell = document.getElementById('app-shell');
    if (appShell) {
        appShell.innerHTML = `
            <nav class="sidenav glass-sidebar hidden md:flex flex-col text-on-primary font-body-md fixed left-0 top-0 h-full w-[280px] border-r border-white/10 shadow-2xl py-lg z-20 transition-all">
                <!-- Brand Header -->
                <div class="px-lg mb-lg flex items-center justify-between">
                    <div class="flex items-center gap-md">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center shadow-lg shadow-orange-950/40 relative">
                            ${icon('fingerprint', 24)}
                            <span class="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#1C1917] animate-pulse"></span>
                        </div>
                        <div>
                            <h1 class="font-headline-sm text-[18px] font-bold text-white tracking-tight flex items-center gap-xs">
                                MADA Digital
                            </h1>
                            <p class="font-label-md text-[11px] text-orange-200/70 font-medium uppercase tracking-wider">Pointage Biométrique</p>
                        </div>
                    </div>
                </div>

                <div class="w-full h-px bg-white/10 mb-md"></div>

                <!-- Navigation Sections -->
                <div class="flex flex-col gap-md flex-grow overflow-y-auto px-xs">
                    ${NAV_SECTIONS.map(sec => {
                        const validItems = sec.items.filter(i => !i.adminOnly || user.role === 'admin' || user.role === 'super_admin');
                        if (validItems.length === 0) return '';
                        return `
                            <div>
                                <div class="px-md mb-xs font-label-md text-[10px] font-bold tracking-widest text-orange-200/50 uppercase">
                                    ${sec.title}
                                </div>
                                <ul class="flex flex-col gap-xs">
                                    ${validItems.map(i => {
                                        const isActive = i.page === current;
                                        return `
                                        <li>
                                            <a class="nav-item-link flex items-center justify-between px-md py-sm text-[14px] text-slate-300 ${isActive ? 'active-menu' : ''}" href="${i.link}">
                                                <div class="flex items-center gap-md">
                                                    ${icon(i.icon, 20, isActive)}
                                                    <span>${i.label}</span>
                                                </div>
                                                ${i.badge ? `<span class="bg-[#FFF1E8]/15 text-[#F9AE3F] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#F9AE3F]/30">${i.badge}</span>` : ''}
                                                ${i.badgeId ? `<span id="${i.badgeId}" class="bg-stone-800 text-stone-200 text-[10px] font-mono px-2 py-0.5 rounded-full"></span>` : ''}
                                            </a>
                                        </li>`;
                                    }).join('')}
                                </ul>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- Sidebar Footer : User Mini Profile Menu Card -->
                <div class="mt-auto px-md pt-md border-t border-white/10">
                    <div class="bg-stone-900/80 backdrop-blur-md rounded-xl p-sm border border-white/10 flex items-center justify-between gap-sm">
                        <div class="flex items-center gap-sm min-w-0">
                            <div class="relative">
                                <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[13px] shadow-sm">
                                    ${initialsOf(user)}
                                </div>
                                <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-stone-900 rounded-full"></span>
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="font-semibold text-white text-[13px] truncate">${user.prenom} ${user.nom}</div>
                                <div class="text-[11px] text-stone-400 truncate flex items-center gap-1">
                                    <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#F9AE3F]"></span>
                                    ${user.role === 'super_admin' ? 'Super Admin' : 'Admin RH'} · <span class="font-mono text-[10px] text-stone-300">${user.matricule}</span>
                                </div>
                            </div>
                        </div>
                        <button id="btn-logout" title="Déconnexion" class="text-stone-400 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors cursor-pointer">
                            ${icon('logout', 20)}
                        </button>
                    </div>
                </div>
            </nav>
        `;
    }

    // Attach logout click
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        api.logout();
        window.location.href = 'login.html';
    });

    // ----------------------------------------------------
    // 2. TOPBAR HEADER & INTERACTIVE DROPDOWN MENUS
    // ----------------------------------------------------
    const topbarSlot = document.getElementById('topbar-slot');
    if (topbarSlot) {
        const pageTitle = NAV_SECTIONS.flatMap(s => s.items).find(i => i.page === current)?.label || 'Dashboard';

        topbarSlot.innerHTML = `
            <header class="glass-topbar text-on-background font-label-md text-label-md fixed top-0 right-0 w-full md:w-[calc(100%-280px)] h-16 border-b border-slate-200/80 dark:border-stone-800 shadow-sm flex justify-between items-center px-gutter z-10 transition-colors">
                <!-- Mobile toggle & Left title / search -->
                <div class="flex items-center gap-md flex-1 min-w-0 relative">
                    <button class="md:hidden text-stone-600 dark:text-stone-300 hover:text-[#F46A21] p-sm rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors" id="btn-menu">
                        ${icon('menu', 24)}
                    </button>
                    
                    ${document.body.dataset.search === '1' ? `
                    <div class="relative w-full max-w-sm">
                        <div class="flex items-center bg-slate-100 dark:bg-stone-800/80 rounded-full px-md py-1.5 border border-slate-200 dark:border-stone-700/60 focus-within:border-[#F46A21] focus-within:ring-2 focus-within:ring-[#F46A21]/20 transition-all">
                            ${icon('search', 18, false)}
                            <input class="bg-transparent border-none focus:ring-0 text-body-md font-body-md w-full ml-sm text-[#303030] dark:text-slate-100 placeholder-slate-400 outline-none text-[13px]" id="top-search" placeholder="Rechercher un employé par nom, matricule..." type="text" autocomplete="off">
                        </div>
                        <!-- Live Search Results Dropdown Menu -->
                        <div id="dropdown-search-results" class="hidden absolute top-full left-0 mt-2 w-full bg-white dark:bg-stone-900 rounded-xl shadow-2xl border border-slate-200 dark:border-stone-800 menu-dropdown-panel z-50 p-2 max-h-80 overflow-y-auto">
                        </div>
                    </div>` : `
                    <div class="flex items-center gap-sm text-[#303030] dark:text-slate-200 font-semibold text-[15px]">
                        <span class="w-2 h-2 rounded-full bg-[#F46A21]"></span>
                        <span id="topbar-title">${pageTitle}</span>
                    </div>`}
                </div>

                <!-- Right Action Menus -->
                <div class="flex items-center gap-sm">
                    <!-- Live Clock -->
                    <div class="hidden lg:flex items-center gap-xs px-md py-1 bg-slate-100 dark:bg-stone-800 rounded-lg text-slate-600 dark:text-stone-300 font-mono text-[12px] border border-slate-200 dark:border-stone-700/50">
                        ${icon('schedule', 16)}
                        <span id="topbar-clock">--:--:--</span>
                    </div>

                    <!-- 0. DARK MODE TOGGLE -->
                    <button id="btn-toggle-darkmode" title="Changer le thème" class="text-slate-600 dark:text-slate-300 hover:text-[#F46A21] hover:bg-slate-100 dark:hover:bg-stone-800 transition-colors cursor-pointer p-2 rounded-xl">
                        <span class="material-symbols-outlined dark:hidden" style="font-size:22px;">light_mode</span>
                        <span class="material-symbols-outlined hidden dark:inline" style="font-size:22px;">dark_mode</span>
                    </button>

                    <!-- 1. NOTIFICATIONS DROPDOWN MENU -->
                    <div class="relative" id="menu-notifications-container">
                        <button class="text-slate-600 dark:text-slate-300 hover:text-[#F46A21] hover:bg-slate-100 dark:hover:bg-stone-800 transition-colors cursor-pointer relative p-2 rounded-xl" id="btn-toggle-notifs" title="Notifications">
                            ${icon('notifications', 22)}
                            <span id="notif-badge-dot" class="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#F46A21] border-2 border-white dark:border-stone-900 rounded-full"></span>
                        </button>

                        <!-- Notification Dropdown Panel -->
                        <div id="dropdown-notifs" class="hidden absolute right-0 top-full mt-2 w-80 md:w-96 bg-white dark:bg-stone-900 text-[#303030] dark:text-slate-100 rounded-2xl menu-dropdown-panel z-50 overflow-hidden">
                            <div class="p-md border-b border-slate-100 dark:border-stone-800 flex items-center justify-between bg-[#FFF1E8]/50 dark:bg-stone-800/40">
                                <div class="flex items-center gap-xs font-semibold text-[14px]">
                                    ${icon('notifications', 18)}
                                    <span>Notifications</span>
                                    <span id="notif-count-pill" class="bg-[#FFF1E8] text-[#F46A21] dark:bg-orange-950/60 dark:text-[#F9AE3F] text-[11px] font-bold px-2 py-0.5 rounded-full ml-1">3</span>
                                </div>
                                <button id="btn-clear-notifs" class="text-[11px] text-[#F46A21] hover:underline cursor-pointer">Tout marquer lu</button>
                            </div>
                            <div id="notif-list-body" class="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-stone-800/60">
                                <!-- Populated dynamically -->
                            </div>
                            <div class="p-2 border-t border-slate-100 dark:border-stone-800 text-center bg-slate-50/30 dark:bg-stone-800/20">
                                <a href="pointage.html" class="text-[12px] font-semibold text-[#F46A21] hover:underline">Voir l'historique complet</a>
                            </div>
                        </div>
                    </div>

                    <!-- 2. QUICK SETTINGS MENU -->
                    <div class="relative" id="menu-settings-container">
                        <button class="text-slate-600 dark:text-slate-300 hover:text-[#F46A21] hover:bg-slate-100 dark:hover:bg-stone-800 transition-colors cursor-pointer p-2 rounded-xl" id="btn-toggle-settings" title="Paramètres">
                            ${icon('settings', 22)}
                        </button>
                        
                        <div id="dropdown-settings" class="hidden absolute right-0 top-full mt-2 w-72 bg-white dark:bg-stone-900 text-[#303030] dark:text-slate-100 rounded-2xl menu-dropdown-panel z-50 p-md">
                            <h4 class="font-semibold text-[13px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-sm">Réglages Rapides</h4>
                            <div class="flex flex-col gap-sm text-[13px]">
                                <label class="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-stone-800/60 transition-colors">
                                    <span class="flex items-center gap-sm">
                                        ${icon('volume_up', 18)}
                                        <span>Bip d'empreinte audio</span>
                                    </span>
                                    <input type="checkbox" id="setting-sound" checked class="rounded border-slate-300 text-[#F46A21] focus:ring-[#F46A21]">
                                </label>
                                <label class="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-stone-800/60 transition-colors">
                                    <span class="flex items-center gap-sm">
                                        ${icon('speed', 18)}
                                        <span>Scan Ultra-Rapide</span>
                                    </span>
                                    <input type="checkbox" id="setting-speed" checked class="rounded border-slate-300 text-[#F46A21] focus:ring-[#F46A21]">
                                </label>
                                <div class="pt-sm border-t border-slate-100 dark:border-stone-800 flex items-center justify-between">
                                    <span class="text-slate-500 text-[12px]">Mode Lecteur</span>
                                    <span class="text-xs bg-[#FFF1E8] dark:bg-orange-950/40 text-[#F46A21] dark:text-[#F9AE3F] font-semibold px-2 py-0.5 rounded">Simulateur SDK</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 3. USER PROFILE DROPDOWN MENU -->
                    <div class="relative ml-xs border-l border-slate-200 dark:border-stone-800 pl-md" id="menu-user-container">
                        <button class="flex items-center gap-2 group cursor-pointer focus:outline-none" id="btn-toggle-user-menu">
                            <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[13px] border-2 border-white dark:border-stone-800 shadow-md group-hover:scale-105 transition-transform" id="top-avatar">
                                ${initialsOf(user)}
                            </div>
                            ${icon('arrow_drop_down', 20)}
                        </button>

                        <!-- User Menu Dropdown Panel -->
                        <div id="dropdown-user-menu" class="hidden absolute right-0 top-full mt-2 w-64 bg-white dark:bg-stone-900 text-[#303030] dark:text-slate-100 rounded-2xl menu-dropdown-panel z-50 p-sm divide-y divide-slate-100 dark:divide-stone-800">
                            <div class="p-md">
                                <div class="font-bold text-[14px] text-[#303030] dark:text-white">${user.prenom} ${user.nom}</div>
                                <div class="text-[12px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">${user.email || user.matricule}</div>
                                <div class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF1E8] text-[#F46A21] dark:bg-orange-950/40 dark:text-[#F9AE3F]">
                                    <span class="w-1.5 h-1.5 rounded-full bg-[#F46A21]"></span>
                                    ${user.role === 'super_admin' ? 'Super Administrateur' : 'Administrateur RH'}
                                </div>
                            </div>
                            <div class="py-1 text-[13px]">
                                <a href="pointage.html" class="flex items-center gap-md px-md py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-stone-800 rounded-xl transition-colors">
                                    ${icon('fingerprint', 18)} Mon Pointage
                                </a>
                                ${user.role === 'admin' ? `
                                <a href="employes.html" class="flex items-center gap-md px-md py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-stone-800 rounded-xl transition-colors">
                                    ${icon('badge', 18)} Liste des Employés
                                </a>` : ''}
                            </div>
                            <div class="pt-1">
                                <button id="btn-menu-logout" class="w-full flex items-center gap-md px-md py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors text-[13px] font-medium cursor-pointer">
                                    ${icon('logout', 18)} Se déconnecter
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
        `;

        // Update live clock
        const clockEl = document.getElementById('topbar-clock');
        if (clockEl) {
            clockEl.textContent = new Date().toLocaleTimeString('fr-FR');
            setInterval(() => {
                clockEl.textContent = new Date().toLocaleTimeString('fr-FR');
            }, 1000);
        }

        // Mobile drawer menu toggle
        document.getElementById('btn-menu')?.addEventListener('click', () => {
            document.body.classList.toggle('nav-open');
        });

        // Dark Mode Toggle
        document.getElementById('btn-toggle-darkmode')?.addEventListener('click', () => {
            toggleDarkMode();
        });

        // Setup Dropdown Toggle Handlers (Notification, Settings, User Profile)
        setupDropdownMenus();

        // Setup Live Quick Search if search input is present
        setupLiveSearch();
    }
}

// ----------------------------------------------------
// DROPDOWN MENUS INTERACTION HANDLER
// ----------------------------------------------------
function setupDropdownMenus() {
    const notifBtn = document.getElementById('btn-toggle-notifs');
    const notifDropdown = document.getElementById('dropdown-notifs');

    const settingsBtn = document.getElementById('btn-toggle-settings');
    const settingsDropdown = document.getElementById('dropdown-settings');

    const userMenuBtn = document.getElementById('btn-toggle-user-menu');
    const userMenuDropdown = document.getElementById('dropdown-user-menu');

    const allDropdowns = [notifDropdown, settingsDropdown, userMenuDropdown];

    function hideAllDropdownsExcept(except) {
        allDropdowns.forEach(d => {
            if (d && d !== except) d.classList.add('hidden');
        });
    }

    if (notifBtn && notifDropdown) {
        renderNotificationItems();
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = notifDropdown.classList.contains('hidden');
            hideAllDropdownsExcept(notifDropdown);
            notifDropdown.classList.toggle('hidden', !isHidden);
        });

        document.getElementById('btn-clear-notifs')?.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationsList.forEach(n => n.read = true);
            renderNotificationItems();
            flash('Toutes les notifications ont été marquées comme lues.', 'info');
        });
    }

    if (settingsBtn && settingsDropdown) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = settingsDropdown.classList.contains('hidden');
            hideAllDropdownsExcept(settingsDropdown);
            settingsDropdown.classList.toggle('hidden', !isHidden);
        });
    }

    if (userMenuBtn && userMenuDropdown) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = userMenuDropdown.classList.contains('hidden');
            hideAllDropdownsExcept(userMenuDropdown);
            userMenuDropdown.classList.toggle('hidden', !isHidden);
        });

        document.getElementById('btn-menu-logout')?.addEventListener('click', () => {
            api.logout();
            window.location.href = 'login.html';
        });
    }

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-dropdown-panel')) {
            hideAllDropdownsExcept(null);
        }
    });
}

function renderNotificationItems() {
    const body = document.getElementById('notif-list-body');
    const badgeDot = document.getElementById('notif-badge-dot');
    const countPill = document.getElementById('notif-count-pill');
    if (!body) return;

    const unreadCount = notificationsList.filter(n => !n.read).length;
    if (badgeDot) badgeDot.style.display = unreadCount > 0 ? 'block' : 'none';
    if (countPill) countPill.textContent = unreadCount;

    body.innerHTML = notificationsList.map(n => `
        <div class="p-md hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-start gap-md ${n.read ? 'opacity-60' : 'bg-blue-50/20 dark:bg-blue-950/20'}">
            <div class="${n.color} mt-0.5 flex-shrink-0">
                ${icon(n.icon, 20)}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                    <span class="font-semibold text-[13px] text-slate-800 dark:text-slate-100">${n.title}</span>
                    <span class="text-[10px] text-slate-400 font-mono">${n.time}</span>
                </div>
                <p class="text-[12px] text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">${n.text}</p>
            </div>
        </div>
    `).join('');
}

// Live Quick Search Dropdown
async function setupLiveSearch() {
    const input = document.getElementById('top-search');
    const dropdown = document.getElementById('dropdown-search-results');
    if (!input || !dropdown) return;

    let users = await api.getUsers();

    input.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (query.length < 1) {
            dropdown.classList.add('hidden');
            return;
        }

        const matches = users.filter(u =>
            u.nom.toLowerCase().includes(query) ||
            u.prenom.toLowerCase().includes(query) ||
            u.matricule.toLowerCase().includes(query) ||
            (u.departement || '').toLowerCase().includes(query)
        );

        if (matches.length === 0) {
            dropdown.innerHTML = `
                <div class="p-md text-center text-slate-400 text-[13px]">
                    Aucun résultat pour "<span class="font-semibold">${query}</span>"
                </div>`;
        } else {
            dropdown.innerHTML = matches.map(u => `
                <a href="employes.html" class="flex items-center justify-between p-sm hover:bg-slate-100 dark:hover:bg-stone-800 rounded-xl transition-colors">
                    <div class="flex items-center gap-sm">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[12px]">
                            ${initialsOf(u)}
                        </div>
                        <div>
                            <div class="font-semibold text-[13px] text-[#303030] dark:text-slate-100">${u.prenom} ${u.nom}</div>
                            <div class="text-[11px] text-slate-400 font-mono">${u.matricule} · ${u.departement || 'Général'}</div>
                        </div>
                    </div>
                    <span class="text-[11px] px-2 py-0.5 rounded font-semibold ${u.empreinte ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}">
                        ${u.empreinte ? 'Empreinte OK' : 'Non enrôlé'}
                    </span>
                </a>
            `).join('');
        }

        dropdown.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#top-search') && !e.target.closest('#dropdown-search-results')) {
            dropdown.classList.add('hidden');
        }
    });
}

function getToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-20 right-5 z-50 flex flex-col gap-sm max-w-sm w-full pointer-events-none';
        document.body.appendChild(container);
    }
    return container;
}

function flash(message, type = 'success', title = null) {
    const container = getToastContainer();

    const styles = {
        success: {
            bg: 'bg-stone-900/95 dark:bg-stone-900/95 border-emerald-500/40 text-white',
            accent: 'bg-emerald-500',
            icBg: 'bg-emerald-500/20 text-emerald-400',
            ic: 'check_circle',
            defaultTitle: 'Succès'
        },
        danger: {
            bg: 'bg-stone-900/95 dark:bg-stone-900/95 border-rose-500/40 text-white',
            accent: 'bg-rose-500',
            icBg: 'bg-rose-500/20 text-rose-400',
            ic: 'error',
            defaultTitle: 'Erreur'
        },
        warning: {
            bg: 'bg-stone-900/95 dark:bg-stone-900/95 border-amber-500/40 text-white',
            accent: 'bg-amber-500',
            icBg: 'bg-amber-500/20 text-amber-400',
            ic: 'warning',
            defaultTitle: 'Avertissement'
        },
        info: {
            bg: 'bg-stone-900/95 dark:bg-stone-900/95 border-[#F46A21]/40 text-white',
            accent: 'bg-[#F46A21]',
            icBg: 'bg-[#F46A21]/20 text-[#F9AE3F]',
            ic: 'info',
            defaultTitle: 'Information'
        },
    };
    const s = styles[type] || styles.info;
    const toastTitle = title || s.defaultTitle;

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto rounded-2xl border shadow-2xl backdrop-blur-xl p-md flex items-start gap-md relative overflow-hidden menu-dropdown-panel transition-all transform duration-300 translate-x-10 opacity-0 ${s.bg}`;

    toast.innerHTML = `
        <div class="absolute left-0 top-0 bottom-0 w-1 ${s.accent}"></div>
        <div class="w-9 h-9 rounded-xl ${s.icBg} flex items-center justify-center flex-shrink-0 mt-0.5">
            ${icon(s.ic, 20)}
        </div>
        <div class="flex-1 min-w-0 pr-4">
            <div class="font-bold text-[13px] tracking-tight">${toastTitle}</div>
            <div class="text-[12px] opacity-90 leading-snug mt-0.5">${message}</div>
        </div>
        <button class="text-slate-400 hover:text-white transition-colors cursor-pointer p-1 rounded-lg" onclick="this.closest('.menu-dropdown-panel').remove()">
            ${icon('close', 16)}
        </button>
    `;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-10', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
    });

    // Auto remove after 4.5s
    setTimeout(() => {
        toast.classList.remove('translate-x-0', 'opacity-100');
        toast.classList.add('translate-x-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4500);

    // Also update embedded flash container if present
    const embeddedFlash = document.getElementById('flash');
    if (embeddedFlash) {
        embeddedFlash.innerHTML = `
            <div class="border rounded-2xl px-md py-sm text-[13px] flex items-center justify-between gap-sm mb-md shadow-md ${s.bg} border-l-4">
                <div class="flex items-center gap-sm">
                    ${icon(s.ic, 20)}
                    <span>${message}</span>
                </div>
                <button onclick="this.parentElement.remove()" class="opacity-60 hover:opacity-100 cursor-pointer">
                    ${icon('close', 16)}
                </button>
            </div>`;
    }
}

// Custom Glassmorphic Confirmation Dialog Box Modal
function showConfirmModal({ title, message, type = 'warning', confirmText = 'Confirmer', cancelText = 'Annuler', onConfirm }) {
    let existing = document.getElementById('custom-confirm-modal');
    if (existing) existing.remove();

    const typeConfig = {
        danger: {
            btnBg: 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/25',
            icBg: 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400',
            ic: 'delete_forever'
        },
        warning: {
            btnBg: 'bg-[#F46A21] hover:bg-[#E05910] shadow-orange-500/25',
            icBg: 'bg-[#FFF1E8] text-[#F46A21] dark:bg-orange-950 dark:text-[#F9AE3F]',
            ic: 'warning'
        },
        info: {
            btnBg: 'bg-[#F46A21] hover:bg-[#E05910] shadow-orange-500/25',
            icBg: 'bg-[#FFF1E8] text-[#F46A21] dark:bg-orange-950 dark:text-[#F9AE3F]',
            ic: 'help_outline'
        }
    }[type] || {
        btnBg: 'bg-[#F46A21] hover:bg-[#E05910] shadow-orange-500/25',
        icBg: 'bg-[#FFF1E8] text-[#F46A21] dark:bg-orange-950 dark:text-[#F9AE3F]',
        ic: 'help_outline'
    };

    const modal = document.createElement('div');
    modal.id = 'custom-confirm-modal';
    modal.className = 'fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-sm animate-fade-in';

    modal.innerHTML = `
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-lg text-center menu-dropdown-panel relative">
            <div class="w-14 h-14 rounded-2xl ${typeConfig.icBg} flex items-center justify-center mx-auto mb-md shadow-inner">
                ${icon(typeConfig.ic, 32)}
            </div>
            <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-xs">${title}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-lg">${message}</p>
            
            <div class="flex items-center justify-center gap-sm pt-md border-t border-slate-100 dark:border-slate-800">
                <button id="btn-cancel-confirm" class="w-1/2 px-md py-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                    ${cancelText}
                </button>
                <button id="btn-submit-confirm" class="w-1/2 px-md py-2.5 rounded-xl text-xs font-semibold text-white ${typeConfig.btnBg} shadow-lg cursor-pointer transition-all active:scale-98">
                    ${confirmText}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btn-cancel-confirm').onclick = () => modal.remove();
    document.getElementById('btn-submit-confirm').onclick = async () => {
        modal.remove();
        if (typeof onConfirm === 'function') await onConfirm();
    };
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        el.classList.add('flex');
    }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('hidden');
        el.classList.remove('flex');
    }
}

// ----------------------------------------------------
// DARK MODE ENGINE
// ----------------------------------------------------
function initDarkMode() {
    const saved = localStorage.getItem('mada-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('mada-theme', isDark ? 'dark' : 'light');

    // Animate icon swap with a tiny flash
    const btn = document.getElementById('btn-toggle-darkmode');
    if (btn) {
        btn.style.transform = 'scale(0.85)';
        setTimeout(() => { btn.style.transform = ''; }, 150);
    }
}

// Init dark mode immediately (before DOM) to prevent flash
(function() { initDarkMode(); })();

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page && !document.body.dataset.noShell) buildShell();
    if (typeof initPage === 'function') initPage();
});