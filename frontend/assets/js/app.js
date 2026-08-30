// ============================================================
// Shell partagé & Système de Menus Interactifs (P.Biometrique)
// ============================================================

function icon(name, size = 18, filled = false) {
    return `<span class="material-symbols-outlined ${filled ? 'filled' : ''}" style="font-size:${size}px;">${name}</span>`;
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function initialsOf(u) {
    if (!u || !u.prenom || !u.nom) return 'U';
    return (u.prenom[0] + u.nom[0]).toUpperCase();
}

const NAV_SECTIONS = [
    {
        title: 'VUE GÉNÉRALE',
        items: [
            { page: 'dashboard', link: 'dashboard.php', icon: 'dashboard', label: 'Tableau de bord' },
            { page: 'pointage', link: 'pointage.php', icon: 'fingerprint', label: 'Pointage', badge: 'En service' },
        ]
    },
    {
        title: 'GESTION DE L\'EFFECTIF',
        items: [
            { page: 'employes', link: 'employes.php', icon: 'badge', label: 'Employés', adminOnly: true, badgeId: 'badge-count-emp' },
            { page: 'empreintes', link: 'empreintes.php', icon: 'fingerprint', label: 'Empreintes', adminOnly: true },
            { page: 'administrateurs', link: 'administrateurs.php', icon: 'admin_panel_settings', label: 'Administrateurs', superAdminOnly: true },
            { page: 'historique', link: 'historique.php', icon: 'history', label: 'Historique des Pointages' },
        ]
    }
];

// Sample System Notifications
let notificationsList = [
    { id: 1, title: 'Pointage à l\'heure', time: 'Il y a 5 min', text: 'EMP001 (Marc Dubois) a pointé à 08:02', read: false, icon: 'check_circle', color: 'text-[#F46A21]' },
    { id: 2, title: 'Nouvel enrôlement', time: 'Il y a 25 min', text: 'Empreinte enregistrée pour ADM001', read: false, icon: 'fingerprint', color: 'text-[#F46A21]' },
    { id: 3, title: 'Retard détecté', time: 'Hier à 08:45', text: 'EMP002 (Sophie Martin) a pointé en retard', read: true, icon: 'warning', color: 'text-amber-500' }
];

// ----------------------------------------------------
// SIDEBAR RÉDUCTIBLE (bureau uniquement, md+)
// ----------------------------------------------------
function setSidebarCollapsed(collapsed) {
    document.body.classList.toggle('sidebar-collapsed', !!collapsed);
    storage.set('mada-sidebar', collapsed ? '1' : '0');
    const btn = document.getElementById('btn-toggle-sidebar');
    if (btn) btn.dataset.label = collapsed ? 'Développer le menu' : 'Réduire le menu';
}

function toggleSidebar() {
    setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'));
}

function initSidebar() {
    const collapsed = storage.get('mada-sidebar') === '1';
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    const btn = document.getElementById('btn-toggle-sidebar');
    if (btn) btn.dataset.label = collapsed ? 'Développer le menu' : 'Réduire le menu';
}

// Tooltip (indice d'onglet) au survol des liens de navigation
function setupNavTooltips() {
    const tip = document.createElement('div');
    tip.className = 'nav-tooltip hidden';
    document.body.appendChild(tip);

    // Tooltips réservés au bureau (souris) : inutiles/parasites sur mobile
    if (window.matchMedia && window.matchMedia('(max-width: 767px)').matches) return;

    document.querySelectorAll('.nav-item-link').forEach(a => {
        a.addEventListener('mouseenter', () => {
            const label = a.dataset.label || '';
            if (!label) return;
            tip.textContent = label;
            const r = a.getBoundingClientRect();
            tip.style.top = (r.top + r.height / 2) + 'px';
            tip.style.left = (r.right + 10) + 'px';
            tip.classList.remove('hidden');
        });
        a.addEventListener('mouseleave', () => tip.classList.add('hidden'));
        a.addEventListener('click', () => tip.classList.add('hidden'));
    });
}

function buildShell() {
    const user = api.getCurrentUser();
    if (!user) {
        window.location.href = 'login.php';
        return;
    }

    const current = document.body.dataset.page;

    // ----------------------------------------------------
    // 1. SIDEBAR MENU BUILD
    // ----------------------------------------------------
    const appShell = document.getElementById('app-shell');
    if (appShell) {
        appShell.innerHTML = `
            <nav class="sidenav glass-sidebar flex flex-col font-body-md fixed left-0 top-0 h-full w-[280px] py-lg z-20 transition-all">
                <!-- Brand Header -->
                <div class="px-lg mb-lg flex items-center justify-between">
                    <div class="flex items-center gap-md">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center shadow-lg shadow-orange-950/40 relative">
                            ${icon('fingerprint', 24)}
                            <span class="absolute -top-1 -right-1 w-3 h-3 bg-[#F46A21] rounded-full border-2 border-[#1C1917] animate-pulse"></span>
                        </div>
                        <div>
                            <h1 class="font-headline-sm text-[18px] font-bold tracking-tight flex items-center gap-xs nav-brand-title">
                                P.Biometrique
                            </h1>
                            <p class="font-label-md text-[11px] font-medium uppercase tracking-wider nav-brand-sub">Pointage Biométrique</p>
                        </div>
                    </div>
                    <button id="btn-close-nav" class="md:hidden text-stone-500 dark:text-stone-400 hover:text-[#F46A21] hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg transition-colors cursor-pointer" aria-label="Fermer le menu">
                        ${icon('close', 20)}
                    </button>
                </div>

                <div class="w-full h-px nav-divider mb-md"></div>

                <!-- Navigation Sections -->
                <div class="flex flex-col gap-md flex-grow overflow-y-auto overflow-x-hidden px-xs">
                    ${NAV_SECTIONS.map((sec, idx) => {
                        const validItems = sec.items.filter(i => {
                            if (i.superAdminOnly) return user.role === 'super_admin';
                            if (i.adminOnly) return user.role === 'admin' || user.role === 'super_admin';
                            return true;
                        });
                        if (validItems.length === 0) return '';
                        return `
                            <div>
                                ${idx > 0 ? `<div class="h-px nav-divider mx-sm mb-sm"></div>` : ''}
                                <ul class="flex flex-col gap-xs">
                                    ${validItems.map(i => {
                                        const isActive = i.page === current;
                                        return `
                                        <li>
                                            <a class="nav-item-link flex items-center justify-between px-md py-sm text-[14px] ${isActive ? 'active-menu' : ''}" href="${i.link}" data-label="${i.label}">
                                                <div class="flex items-center gap-md">
                                                    ${icon(i.icon, 20, isActive)}
                                                    <span>${i.label}</span>
                                                </div>
                                                ${i.badge ? `<span class="nav-badge-service text-[10px] font-semibold px-2 py-0.5 rounded-full">${i.badge}</span>` : ''}
                                                ${i.badgeId ? `<span id="${i.badgeId}" class="nav-badge-count text-[10px] font-mono px-2 py-0.5 rounded-full"></span>` : ''}
                                            </a>
                                        </li>
                                        `;
                                    }).join('')}
                                </ul>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- Sidebar Footer : Réduire le menu / Mode sombre / Paramètres / Déconnexion -->
                <div class="mt-auto px-xs pt-md nav-footer-border">
                    <ul class="flex flex-col gap-xs">
                        <li>
                            <button id="btn-toggle-sidebar" data-label="Réduire le menu" class="nav-item-link hidden md:flex items-center justify-between px-md py-sm text-[14px] cursor-pointer">
                                <div class="flex items-center gap-md">
                                    <span class="material-symbols-outlined transition-transform duration-300" style="font-size:20px;">menu_open</span>
                                    <span>Réduire le menu</span>
                                </div>
                            </button>
                        </li>
                        <li>
                            <button id="btn-toggle-darkmode" data-label="Mode sombre" class="nav-item-link flex items-center justify-between px-md py-sm text-[14px] cursor-pointer">
                                <div class="flex items-center gap-md">
                                    <span class="material-symbols-outlined dark:hidden" style="font-size:20px;">light_mode</span>
                                    <span class="material-symbols-outlined hidden dark:inline" style="font-size:20px;">dark_mode</span>
                                    <span>Mode sombre</span>
                                </div>
                            </button>
                        </li>
                        <li>
                            <a class="nav-item-link flex items-center justify-between px-md py-sm text-[14px] ${current === 'parametres' ? 'active-menu' : ''}" href="parametres.php" data-label="Paramètres">
                                <div class="flex items-center gap-md">
                                    ${icon('settings', 20, current === 'parametres')}
                                    <span>Paramètres</span>
                                </div>
                            </a>
                        </li>
                        <li>
                            <button id="btn-logout" data-label="Déconnexion" class="nav-item-link logout-item flex items-center justify-between px-md py-sm text-[14px] cursor-pointer">
                                <div class="flex items-center gap-md">
                                    ${icon('logout', 20)}
                                    <span>Déconnexion</span>
                                </div>
                            </button>
                        </li>
                    </ul>
                </div>
            </nav>
        `;
    }

    // Attach logout click
    document.getElementById('btn-logout')?.addEventListener('click', performLogout);

    // Attach sidebar collapse toggle + restore l'état mémorisé
    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', toggleSidebar);
    initSidebar();

    // Attach dark mode toggle (sidebar bottom)
    document.getElementById('btn-toggle-darkmode')?.addEventListener('click', () => {
        toggleDarkMode();
    });

    // Tooltips de survol sur les onglets
    setupNavTooltips();

    // Mobile drawer : fermeture au clic sur un lien, hors sidebar (fond), touche Échap ou bouton X
    const closeMobileNav = () => document.body.classList.remove('nav-open');
    document.querySelectorAll('.nav-item-link').forEach(a => a.addEventListener('click', closeMobileNav));
    document.getElementById('btn-close-nav')?.addEventListener('click', closeMobileNav);
    document.querySelectorAll('.nav-item-link').forEach(a => a.addEventListener('click', closeMobileNav));
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.sidenav') && !e.target.closest('#btn-menu')) closeMobileNav();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMobileNav();
    });

    // ----------------------------------------------------
    // 2. TOPBAR HEADER & INTERACTIVE DROPDOWN MENUS
    // ----------------------------------------------------
    renderTopbarSlot(current);
}

function renderTopbarSlot(pageName) {
    const topbarSlot = document.getElementById('topbar-slot');
    if (!topbarSlot) return;

    const user = api.getCurrentUser();
    if (!user) return;

    const item = NAV_SECTIONS.flatMap(s => s.items).find(i => i.page === pageName);
    const pageTitle = item ? item.label : (pageName === 'parametres' ? 'Paramètres' : 'Dashboard');
    const showSearch = pageName === 'employes' || pageName === 'historique';

    if (showSearch) {
        document.body.dataset.search = '1';
    } else {
        delete document.body.dataset.search;
    }

    document.title = `${pageTitle} - P.Biometrique`;

    topbarSlot.innerHTML = `
        <header class="glass-topbar text-on-background font-label-md text-label-md fixed top-0 right-0 w-full md:w-[calc(100%-280px)] h-16 border-b border-slate-200/80 dark:border-stone-800 shadow-sm flex justify-between items-center px-gutter z-10 transition-colors">
            <!-- Mobile toggle & Left title / search -->
            <div class="flex items-center gap-md flex-1 min-w-0 relative">
                <button class="md:hidden text-stone-600 dark:text-stone-300 hover:text-[#F46A21] p-sm rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors" id="btn-menu">
                    ${icon('menu', 24)}
                </button>
                
                ${showSearch ? `
                <div class="relative w-full max-w-sm">
                    <div class="flex items-center bg-slate-100 dark:bg-stone-800/80 rounded-full px-md py-1.5 border border-slate-200 dark:border-stone-700/60 focus-within:border-[#F46A21] focus-within:ring-2 focus-within:ring-[#F46A21]/20 transition-all">
                        ${icon('search', 18, false)}
                        <input class="bg-transparent border-none focus:ring-0 text-body-md font-body-md w-full ml-sm text-[#303030] dark:text-slate-100 placeholder-slate-400 outline-none text-[13px]" id="top-search" placeholder="Rechercher un employé par nom, matricule..." type="text" autocomplete="off">
                    </div>
                    <!-- Live Search Results Dropdown Menu -->
                    <div id="dropdown-search-results" class="hidden absolute top-full left-0 mt-2 w-full bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-stone-800 menu-dropdown-panel z-50 p-1.5 max-h-80 overflow-y-auto">
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

                <!-- 1. NOTIFICATIONS DROPDOWN MENU -->
                <div class="relative" id="menu-notifications-container">
                    <button class="text-slate-600 dark:text-slate-300 hover:text-[#F46A21] hover:bg-slate-100 dark:hover:bg-stone-800 transition-colors cursor-pointer relative p-2 rounded-xl" id="btn-toggle-notifs" title="Notifications">
                        ${icon('notifications', 22)}
                        <span id="notif-badge-dot" class="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#F46A21] border-2 border-white dark:border-stone-900 rounded-full"></span>
                    </button>

                    <!-- Notification Dropdown Panel -->
                    <div id="dropdown-notifs" class="hidden absolute right-0 top-full mt-2 w-80 md:w-96 bg-white dark:bg-stone-900 text-[#303030] dark:text-slate-100 rounded-2xl menu-dropdown-panel z-50 overflow-hidden">
                        <div class="relative px-md py-sm border-b border-slate-100 dark:border-stone-800 flex items-center justify-between bg-gradient-to-r from-[#FFF1E8] via-white to-white dark:from-stone-800 dark:via-stone-900 dark:to-stone-900">
                            <div class="flex items-center gap-xs font-semibold text-[14px]">
                                <div class="w-8 h-8 rounded-xl bg-white dark:bg-stone-900 text-[#F46A21] dark:text-[#F9AE3F] flex items-center justify-center shadow-sm">
                                    ${icon('notifications', 18)}
                                </div>
                                <span>Notifications</span>
                                <span id="notif-count-pill" class="bg-[#F46A21] text-white dark:bg-orange-950/60 dark:text-[#F9AE3F] text-[11px] font-bold px-2 py-0.5 rounded-full ml-1">3</span>
                            </div>
                            <button id="btn-clear-notifs" class="text-[11px] text-[#F46A21] hover:text-[#EA580C] font-semibold hover:underline cursor-pointer transition-colors">Tout marquer lu</button>
                        </div>
                        <div id="notif-list-body" class="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-stone-800/60">
                            <!-- Populated dynamically -->
                        </div>
                        <div class="p-2 border-t border-slate-100 dark:border-stone-800 bg-slate-50/50 dark:bg-stone-800/30">
                            <a href="pointage.php" class="block w-full text-center py-2 rounded-xl text-[12px] font-semibold text-[#F46A21] hover:bg-[#FFF1E8] dark:hover:bg-orange-950/40 transition-colors">Voir l'historique complet</a>
                        </div>
                    </div>
                </div>

                <!-- 2. USER PROFILE DROPDOWN MENU -->
                <div class="relative ml-xs border-l border-slate-200 dark:border-stone-800 pl-md" id="menu-user-container">
                    <button class="flex items-center gap-2 group cursor-pointer focus:outline-none" id="btn-toggle-user-menu">
                        <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[13px] border-2 border-white dark:border-stone-800 shadow-md group-hover:scale-105 transition-transform" id="top-avatar">
                            ${initialsOf(user)}
                        </div>
                        ${icon('arrow_drop_down', 20)}
                    </button>

                    <!-- User Menu Dropdown Panel -->
                    <div id="dropdown-user-menu" class="hidden absolute right-0 top-full mt-2 w-64 bg-white dark:bg-stone-900 text-[#303030] dark:text-slate-100 rounded-2xl menu-dropdown-panel z-50 p-sm">
                        <div class="p-md mb-1 rounded-xl bg-gradient-to-r from-[#FFF1E8] to-white dark:from-stone-800 dark:to-stone-900 border border-slate-100 dark:border-stone-800">
                            <div class="flex items-center gap-sm">
                                <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[14px] border-2 border-white dark:border-stone-800 shadow-md">
                                    ${initialsOf(user)}
                                </div>
                                <div class="min-w-0">
                                    <div class="font-bold text-[14px] text-[#303030] dark:text-white truncate">${user.prenom} ${user.nom}</div>
                                    <div class="text-[12px] text-slate-500 dark:text-slate-400 font-mono truncate">${user.email || user.matricule}</div>
                                </div>
                            </div>
                            <div class="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F46A21]/10 text-[#F46A21] dark:bg-orange-950/40 dark:text-[#F9AE3F]">
                                <span class="w-1.5 h-1.5 rounded-full bg-[#F46A21]"></span>
                                ${user.role === 'super_admin' ? 'Super Administrateur' : 'Administrateur RH'}
                            </div>
                        </div>
                        <div class="py-1 text-[13px]">
                            ${user.role === 'admin' || user.role === 'super_admin' ? `
                            <a href="employes.php" class="flex items-center gap-md px-md py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-stone-800 rounded-xl transition-colors">
                                ${icon('badge', 18)} Liste des Employés
                            </a>` : ''}
                        </div>
                        <div class="pt-1 mt-1 border-t border-slate-100 dark:border-stone-800">
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
    }
    startLiveClock();

    // Mobile drawer menu toggle : ouvre/ferme la sidebar (repliable)
    document.getElementById('btn-menu')?.addEventListener('click', () => {
        document.body.classList.toggle('nav-open');
    });

    // Setup Dropdown Toggle Handlers (Notification, Settings, User Profile)
    setupDropdownMenus();

    // Setup Live Quick Search if search input is present
    setupLiveSearch();
}

// ----------------------------------------------------
// DROPDOWN MENUS INTERACTION HANDLER
// ----------------------------------------------------
let liveClockInterval = null;

// Horloge temps réel de la topbar (survit aux re-rendus de la topbar)
function startLiveClock() {
    if (liveClockInterval) return;
    liveClockInterval = setInterval(() => {
        const el = document.getElementById('topbar-clock');
        if (el) el.textContent = new Date().toLocaleTimeString('fr-FR');
    }, 1000);
}
function setupDropdownMenus() {
    const notifBtn = document.getElementById('btn-toggle-notifs');
    const notifDropdown = document.getElementById('dropdown-notifs');

    const userMenuBtn = document.getElementById('btn-toggle-user-menu');
    const userMenuDropdown = document.getElementById('dropdown-user-menu');

    const allDropdowns = [notifDropdown, userMenuDropdown];

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

    if (userMenuBtn && userMenuDropdown) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = userMenuDropdown.classList.contains('hidden');
            hideAllDropdownsExcept(userMenuDropdown);
            userMenuDropdown.classList.toggle('hidden', !isHidden);
        });

document.getElementById('btn-menu-logout')?.addEventListener('click', performLogout);
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
        <div class="relative flex items-start gap-sm p-md transition-colors hover:bg-slate-50 dark:hover:bg-stone-800/50 ${n.read ? 'opacity-55' : 'bg-[#FFF1E8]/60 dark:bg-orange-950/20'}">
            ${!n.read ? '<span class="absolute left-0 top-3 bottom-3 w-1 rounded-r bg-[#F46A21]"></span>' : ''}
            <div class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-stone-800 flex items-center justify-center flex-shrink-0 ${n.color}">
                ${icon(n.icon, 20)}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-sm">
                    <span class="font-semibold text-[13px] text-slate-800 dark:text-slate-100 truncate">${n.title}</span>
                    <span class="text-[10px] text-slate-400 font-mono whitespace-nowrap">${n.time}</span>
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
                <div class="p-lg text-center">
                    <div class="w-11 h-11 mx-auto rounded-full bg-slate-100 dark:bg-stone-800 flex items-center justify-center text-slate-400">
                        ${icon('search_off', 22)}
                    </div>
                    <p class="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
                        Aucun résultat pour "<span class="font-semibold">${query}</span>"
                    </p>
                </div>`;
        } else {
            dropdown.innerHTML = matches.map(u => `
                <a href="employes.php" class="group flex items-center gap-sm p-sm hover:bg-slate-100 dark:hover:bg-stone-800 rounded-xl transition-all hover:translate-x-0.5">
                    <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[12px] shadow-sm flex-shrink-0">
                        ${initialsOf(u)}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-semibold text-[13px] text-[#303030] dark:text-slate-100 truncate">${u.prenom} ${u.nom}</div>
                        <div class="text-[11px] text-slate-400 font-mono truncate">${u.matricule} · ${u.departement || 'Général'}</div>
                    </div>
                    <span class="text-[11px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${u.empreinte ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}">
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
            bg: 'bg-stone-900/95 dark:bg-stone-900/95 border-[#F46A21]/40 text-white',
            accent: 'bg-[#F46A21]',
            icBg: 'bg-[#F46A21]/20 text-[#F9AE3F]',
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

// Fermeture globale des modales : boutons [data-close], clic sur le fond, touche Échap
// + Ouverture globale via [data-open] (nécessaire pour SPA où les modales sont injectées dynamiquement)
document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-open]');
    if (openBtn) {
        openModal(openBtn.dataset.open);
        return;
    }
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) closeModal(closeBtn.dataset.close);
    const backdrop = e.target.closest('[id^="modal-"]');
    if (backdrop && e.target === backdrop) closeModal(backdrop.id);
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('[id^="modal-"]:not(.hidden)').forEach(m => closeModal(m.id));
});

// ----------------------------------------------------
// DARK MODE ENGINE
// ----------------------------------------------------
function initDarkMode() {
    const saved = storage.get('mada-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    storage.set('mada-theme', isDark ? 'dark' : 'light');

    // Animate icon swap with a tiny flash
    const btn = document.getElementById('btn-toggle-darkmode');
    if (btn) {
        btn.style.transform = 'scale(0.85)';
        setTimeout(() => { btn.style.transform = ''; }, 150);
    }
}

// Init dark mode immediately (before DOM) to prevent flash
(function() { initDarkMode(); })();

// ----------------------------------------------------
// DYNAMIC SPA ROUTING (PANNEAU DE DROITE UNIQUEMENT)
// ----------------------------------------------------
function getPageHTML(url) {
    return new Promise((resolve, reject) => {
        if (window.location.protocol === 'file:') {
            reject(new Error('Protocole file:// détecté, basculement automatique sur les templates intégrés'));
            return;
        }
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.text();
            })
            .then(html => resolve(html))
            .catch(err => reject(err));
    });
}

function setupSPARouting() {
    async function loadPageSPA(href) {
        const cleanHref = href.replace('./', '');
        const pageName = cleanHref.replace(/\.(html|php)$/, '');
        const pages = ['dashboard', 'employes', 'empreintes', 'administrateurs', 'historique', 'pointage', 'parametres'];
        if (!pages.includes(pageName)) return;

        const currentMain = document.querySelector('main');
        if (!currentMain) return;

        let htmlText = '';
        let isTemplateFallback = false;
        try {
            htmlText = await getPageHTML(cleanHref);
        } catch (err) {
            // Fallback ultime : utilisation du dictionnaire local de templates (compatible file://)
            if (typeof PAGE_TEMPLATES !== 'undefined' && PAGE_TEMPLATES[pageName]) {
                htmlText = PAGE_TEMPLATES[pageName];
                isTemplateFallback = true;
            } else {
                // Aucun template intégré disponible : bascule sur une navigation classique
                window.location.href = href;
                return;
            }
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        let newMain = doc.querySelector('main');

        // Cas fallback PAGE_TEMPLATES : htmlText est un fragment sans <main>
        let incomingModals = [];
        if (isTemplateFallback && !newMain) {
            const tmp = document.createElement('div');
            tmp.innerHTML = htmlText;
            incomingModals = Array.from(tmp.querySelectorAll('[id^="modal-"]'));
            // Retirer les modales du fragment pour ne pas les dupliquer dans <main>
            incomingModals.forEach(m => m.remove());
            // Remplacer le contenu du <main> actuel par le fragment nettoyé
            currentMain.innerHTML = tmp.innerHTML;
        } else {
            if (!newMain) return;
            // 1. Remplacement exclusif du panneau de droite (<main>)
            const freshMain = newMain.cloneNode(true);
            currentMain.replaceWith(freshMain);
            // Modales présentes dans le document complet fetché
            incomingModals = Array.from(doc.querySelectorAll('[id^="modal-"]'));
        }

        // 1b. Synchroniser les modales : supprimer anciennes modales de page puis injecter les nouvelles
        document.querySelectorAll('[id^="modal-"]').forEach(m => {
            // Ne pas supprimer une modale système en cours d'animation (custom-confirm)
            if (m.id === 'custom-confirm-modal') return;
            m.remove();
        });
        incomingModals.forEach(modal => {
            document.body.appendChild(modal.cloneNode(true));
        });

        // 2. Mise à jour de l'état de la page et du topbar (titre, recherche, titre document)
        document.body.dataset.page = pageName;
        renderTopbarSlot(pageName);

        // 3. Mise à jour de la barre d'adresse sans recharger
        if (window.location.pathname.split('/').pop() !== cleanHref) {
            history.pushState({ page: pageName, href: cleanHref }, '', cleanHref);
        }

        // 4. Mise à jour de la classe active du menu latéral gauche
        document.querySelectorAll('.nav-item-link').forEach(a => {
            const aHref = (a.getAttribute('href') || '').replace('./', '');
            if (aHref === cleanHref || aHref.replace(/\.(html|php)$/, '') === pageName) {
                a.classList.add('active-menu');
            } else {
                a.classList.remove('active-menu');
            }
        });

        // 6. Exécution dynamique du contrôleur JS de la page cible
        const oldScript = document.getElementById('active-page-script');
        if (oldScript) oldScript.remove();

        const script = document.createElement('script');
        script.id = 'active-page-script';
        const isFileProtocol = window.location.protocol === 'file:';
        window._lastInitializedModule = null;
        script.src = `assets/js/pages/${pageName}.js` + (isFileProtocol ? '' : `?v=${Date.now()}`);
        script.onload = () => {
            if (window._lastInitializedModule !== pageName && window.PAGE_MODULES && typeof window.PAGE_MODULES[pageName] === 'function') {
                window._lastInitializedModule = pageName;
                window.PAGE_MODULES[pageName]();
            }
        };
        document.body.appendChild(script);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Intercepter les clics sur les liens de navigation
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;

        const href = (link.getAttribute('href') || '').trim();
        if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:')) return;

        const cleanHref = href.replace('./', '');
        const pages = [
            'dashboard.html', 'employes.html', 'empreintes.html', 'administrateurs.html', 'historique.html', 'pointage.html', 'parametres.html',
            'dashboard.php', 'employes.php', 'empreintes.php', 'administrateurs.php', 'historique.php', 'pointage.php', 'parametres.php'
        ];
        if (!pages.includes(cleanHref)) return;

        e.preventDefault();

        const currentHref = window.location.pathname.split('/').pop() || 'dashboard.php';
        if (currentHref === cleanHref) return;

        loadPageSPA(cleanHref);
    });

    // Gestion de la navigation Précédent / Suivant du navigateur
    window.addEventListener('popstate', () => {
        const currentHref = window.location.pathname.split('/').pop() || 'dashboard.php';
        if (currentHref && (currentHref.endsWith('.html') || currentHref.endsWith('.php'))) {
            loadPageSPA(currentHref);
        }
    });
}

// ============================================================
// MODE MONO-FICHIER (index.html / double-clic, protocole file://)
// Toutes les vues sont intégrées dans templates.js : la navigation
// reste dans la page, sans fetch ni rechargement.
// ============================================================
const SINGLE_FILE_MODE = (window.location.pathname.split('/').pop() || 'index.html') === 'index.html';
const SPA_PAGES = ['login', 'dashboard', 'employes', 'empreintes', 'administrateurs', 'historique', 'pointage', 'parametres'];

function performLogout() {
    api.logout();
    if (SINGLE_FILE_MODE) {
        switchPage('login');
    } else {
        window.location.href = 'login.php';
    }
}

function switchPage(pageName) {
    if (typeof PAGE_TEMPLATES === 'undefined' || !PAGE_TEMPLATES[pageName]) return;

    const main = document.getElementById('spa-main');
    if (main) {
        // Extraire les modales du template pour les injecter au niveau body (évite de les imbriquer dans <main>)
        const tmp = document.createElement('div');
        tmp.innerHTML = PAGE_TEMPLATES[pageName];
        const incomingModals = Array.from(tmp.querySelectorAll('[id^="modal-"]'));
        incomingModals.forEach(m => m.remove());
        main.innerHTML = tmp.innerHTML;
        // Synchroniser les modales au niveau body
        document.querySelectorAll('[id^="modal-"]').forEach(m => {
            if (m.id === 'custom-confirm-modal') return;
            m.remove();
        });
        incomingModals.forEach(modal => {
            document.body.appendChild(modal.cloneNode(true));
        });
    }

    document.body.dataset.page = pageName;
    document.body.classList.toggle('auth-view', pageName === 'login');

    if (pageName === 'login') {
        document.title = 'P.Biometrique – Connexion';
        document.getElementById('topbar-slot')?.replaceChildren();
        delete document.body.dataset.search;
    } else {
        renderTopbarSlot(pageName);
    }

    // Classe active sur le menu latéral
    document.querySelectorAll('.nav-item-link').forEach(a => {
        const target = (a.getAttribute('href') || '').replace('./', '').replace(/\.(html|php)$/, '');
        a.classList.toggle('active-menu', target === pageName);
    });

    // Initialisation du contrôleur de page
    const mod = window.PAGE_MODULES && window.PAGE_MODULES[pageName];
    if (mod) mod();

    // Barre d'adresse
    const ext = window.location.pathname.endsWith('.php') ? '.php' : '.html';
    const cleanHref = pageName + ext;
    if (window.location.pathname.split('/').pop() !== cleanHref) {
        try {
            history.pushState({ page: pageName, href: cleanHref }, '', cleanHref);
        } catch (e) { /* file:// : pushState bloqué, on ignore */ }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initSingleFileApp() {
    // Absence de session ? (getCurrentUser créerait une session auto si appelé)
    const hasSession = storage.get(SESSION_KEY) !== null;
    const user = hasSession ? api.getCurrentUser() : null;
    if (user) {
        buildShell();
        switchPage('dashboard');
    } else {
        switchPage('login');
    }
}

// Interception des liens internes (mono-fichier uniquement)
(function setupSingleFileRouting() {
    if (!SINGLE_FILE_MODE) return;
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;
        const href = (link.getAttribute('href') || '').trim();
        if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:')) return;
        const pageName = href.replace('./', '').replace(/\.(html|php)$/, '');
        if (!SPA_PAGES.includes(pageName)) return;
        e.preventDefault();
        switchPage(pageName);
    });
    window.addEventListener('popstate', () => {
        const current = (window.location.pathname.split('/').pop() || 'index.html').replace(/\.(html|php)$/, '');
        if (SPA_PAGES.includes(current)) switchPage(current);
    });
})();

document.addEventListener('DOMContentLoaded', () => {
    if (SINGLE_FILE_MODE) {
        initSingleFileApp();
        return;
    }
    if (document.body.dataset.page && !document.body.dataset.noShell) buildShell();
    setupSPARouting();
    const currentPage = document.body.dataset.page;
    if (currentPage && typeof initPage === 'function' && window._lastInitializedModule !== currentPage) {
        window._lastInitializedModule = currentPage;
        initPage();
    }
});