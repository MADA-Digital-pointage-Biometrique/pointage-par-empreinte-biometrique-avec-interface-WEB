(function () {
// ============================================================
// Page : Tableau de Bord & Analytics Avancés (KPIs & Graphiques)
// ============================================================

let donutChartInstance = null;
let trendChartInstance = null;
let hoursChartInstance = null;
let lastDashStats = null;
let currentTrendView = '7d';
let currentPeriod = 'today';
let statsLoadSeq = 0; // anti-course : le dernier clic sur une pill gagne toujours
let trendLoadSeq = 0; // anti-course : le dernier clic sur une vue tendance gagne toujours
// PERF : dernier bundle graphiques connu — permet de re-rendre SANS refetch
// (bascule sombre/clair, retour d'onglet) et d'afficher un squelette immédiat.
let lastTrendData = null;
let lastHoursData = null;
let _onThemeChangedHandler = null; // closure sur la période courante (évite les doublons)

function _onThemeChanged(period) {
    // Re-rend les canvas avec la palette du thème courant (anneau donut, axes),
    // en conservant la PÉRIODE active (sinon le donut revenait sur 'today').
    // PERF : re-rendu 100 % LOCAL depuis les données déjà chargées — aucun
    // refetch réseau (l'ancien code refaisait 2 aller-retours Supabase à
    // chaque bascule sombre/clair, les graphiques "disparaissaient" 1-2s).
    if (lastDashStats) renderDonutChart(lastDashStats.entrees, lastDashStats.retards, lastDashStats.absents);
    renderTrendChart(currentTrendView);
    renderHoursWorkedChart();
}

function _chartPalette() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
        isDark,
        textColor: isDark ? '#9CA3AF' : '#4B5563',
        gridColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)'
    };
}

// Squelette de chargement : le canvas montre immédiatement une forme (au lieu
// d'un bloc vide), puis le vrai graphique le remplace dès les données prêtes.
function showChartSkeleton(canvas, { horizontal = false } = {}) {
    if (!canvas || !window.Chart) return;
    const { isDark } = _chartPalette();
    const color = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.06)';
    const highlight = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15, 23, 42, 0.10)';
    const N = 7;
    const labels = Array.from({ length: N }, (_, i) => 'S' + (i + 1));
    const data = labels.map(() => 2 + Math.random() * 8);
    return new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: '', data,
                backgroundColor: data.map((v, i) => (i % 3 === 1 ? highlight : color)),
                borderRadius: 6,
                barPercentage: horizontal ? 0.6 : 0.7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: horizontal ? 'y' : 'x',
            animation: { duration: 0 },
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: { display: !horizontal, grid: { display: false }, ticks: { display: false } },
                y: { display: horizontal, grid: { display: false }, ticks: { display: false }, beginAtZero: true }
            }
        }
    });
}

function initials(user) {
    if (!user) return 'U';
    return ((user.prenom ? user.prenom[0] : '') + (user.nom ? user.nom[0] : '')).toUpperCase() || 'U';
}

function statusBadge(p) {
    if (p.sortie !== null) {
        return `
            <span class="inline-flex items-center gap-1 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold text-[11px] px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-800">
                <span class="material-symbols-outlined text-[13px]">logout</span> Sortie (${p.sortie.slice(0, 5)})
            </span>`;
    }
    if (typeof isRetard === 'function' && isRetard(p.entree)) {
        return `
            <span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-semibold text-[11px] px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                <span class="material-symbols-outlined text-[13px]">schedule</span> Retard (${p.entree.slice(0, 5)})
            </span>`;
    }
    return `
        <span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold text-[11px] px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
            <span class="material-symbols-outlined text-[13px]">login</span> Entrée (${p.entree.slice(0, 5)})
        </span>`;
}

function rowHTML(p) {
    const time = p.sortie !== null ? p.sortie : p.entree;
    return `
        <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors h-14">
            <td class="py-sm px-md text-center">
                <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[12px] shadow-sm mx-auto">
                    ${initials(p.user)}
                </div>
            </td>
            <td class="py-sm px-md">
                <div class="font-semibold text-slate-900 dark:text-white">${p.user ? p.user.prenom + ' ' + p.user.nom : 'Employé'}</div>
                <div class="text-[11px] font-mono text-slate-400">${p.user ? p.user.matricule : ''}</div>
            </td>
            <td class="py-sm px-md font-mono text-[13px] text-slate-600 dark:text-slate-300">${time ? time.slice(0, 5) : '—'}</td>
            <td class="py-sm px-md text-slate-600 dark:text-slate-400">${p.user && p.user.departement ? p.user.departement : '—'}</td>
            <td class="py-sm px-md text-right">${statusBadge(p)}</td>
        </tr>`;
}

// ----------------------------------------------------
// ANIMATIONS DE PROGRESSION (purement présentationnel)
// ----------------------------------------------------
// Les valeurs affichées restent EXACTEMENT celles calculées ci-dessous
// (aucun calcul modifié) : MadaAnim part visuellement de 0 et anime
// jusqu'à la valeur réelle, puis s'arrête exactement dessus.
function animateKpis(stats) {
    if (!window.MadaAnim || !stats) {
        // Fallback sans animation : les KPI s'affichent quand même.
        if (!stats) return;
        const pct0 = stats.total > 0 ? Math.round((stats.entrees / stats.total) * 100) : 0;
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('kpi-total', stats.total); set('kpi-presents', stats.entrees);
        set('kpi-absents', stats.absents); set('kpi-retards', stats.retards);
        set('kpi-pct', pct0 + '%');
        return;
    }
    const pct = stats.total > 0 ? Math.round((stats.entrees / stats.total) * 100) : 0;
    MadaAnim.animateNumber(document.getElementById('kpi-total'), stats.total);
    MadaAnim.animateNumber(document.getElementById('kpi-presents'), stats.entrees);
    MadaAnim.animateNumber(document.getElementById('kpi-absents'), stats.absents);
    MadaAnim.animateNumber(document.getElementById('kpi-retards'), stats.retards);
    MadaAnim.animateNumber(document.getElementById('kpi-pct'), pct, { suffix: '%' });
}

// ----------------------------------------------------
// GRAPHICS RENDER ENGINE
// ----------------------------------------------------
function renderDonutChart(presents, retards, absents) {
    const canvas = document.getElementById('chart-presence-donut');
    if (!canvas || !window.Chart) return;

    if (donutChartInstance) {
        donutChartInstance.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');

    // Garde-fou : si animate.js n'est pas chargé (SPA sans rechargement du
    // bundle), on affiche les valeurs directement au lieu de PLANTER avant
    // le dessin — c'est ce crash qui figeait les graphiques en SPA.
    const A = window.MadaAnim;
    const legP = document.getElementById('legend-presents');
    const legR = document.getElementById('legend-retards');
    const legA = document.getElementById('legend-absents');
    if (A && A.animateNumber) {
        if (legP) A.animateNumber(legP, Math.max(0, presents - retards));
        if (legR) A.animateNumber(legR, retards);
        if (legA) A.animateNumber(legA, absents);
    } else {
        if (legP) legP.textContent = Math.max(0, presents - retards);
        if (legR) legR.textContent = retards;
        if (legA) legA.textContent = absents;
    }

    // Données vides (0,0,0) : Chart.js ne dessine RIEN → anneau gris de
    // substitution pour que le donut reste visible (avec son animation).
    const values = [Math.max(0, presents - retards), retards, absents];
    const isEmpty = values.every(v => !v || v <= 0);
    donutChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: isEmpty ? ['Aucune donnée'] : ["À l'heure", 'En retard', 'Absents'],
            datasets: [{
                data: isEmpty ? [1] : values,
                backgroundColor: isEmpty
                    ? [isDark ? '#374151' : '#E5E7EB']
                    : ['#10B981', '#F59E0B', '#F43F5E'],
                borderWidth: 3,
                borderColor: isDark ? '#1F2937' : '#FFFFFF',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '76%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return ` ${ctx.label}: ${ctx.raw} employé(s)`;
                        }
                    }
                }
            }
        }
    });
}

function _renderTrendWithData(canvas, labels, presentsData, retardsData, absentsData, textColor, gridColor) {
    return new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Présents (À l\'heure)', data: presentsData, backgroundColor: '#10B981', borderRadius: 6 },
                { label: 'Retards', data: retardsData, backgroundColor: '#F59E0B', borderRadius: 6 },
                { label: 'Absents', data: absentsData, backgroundColor: '#F43F5E', borderRadius: 6 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 400 },
            plugins: { legend: { position: 'top', labels: { color: textColor, font: { size: 11, weight: '600' } } } },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
                y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } }
            }
        }
    });
}

async function renderTrendChart(view = '7d') {
    const canvas = document.getElementById('chart-attendance-trend');
    if (!canvas || !window.Chart) return;
    const { textColor, gridColor } = _chartPalette();

    // PERF : lecture SYNCHRONE du cache client (peekTrends) → re-rendu
    // immédiat (bascule de vue/thème) sans aucun aller-retour. Sinon
    // squelette pendant le fetch du bundle.
    const cached = api.peekTrends ? api.peekTrends(view) : null;
    if (cached) {
        if (trendChartInstance) { try { trendChartInstance.destroy(); } catch {} }
        trendChartInstance = _renderTrendWithData(canvas, cached.labels, cached.presents, cached.retards, cached.absents, textColor, gridColor);
        return;
    }

    const seq = ++trendLoadSeq;
    if (!lastTrendData) {
        if (trendChartInstance) { try { trendChartInstance.destroy(); } catch {} }
        trendChartInstance = showChartSkeleton(canvas);
    }
    let data = null;
    try {
        data = api.getTrends ? await api.getTrends(view) : null;
    } catch (e) { data = null; }
    if (seq !== trendLoadSeq) return; // une requête plus récente a gagné

    if (!data) {
        // fallback : affichage vide (jamais de 500)
        data = view === '30d'
            ? { labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'], presents: [0, 0, 0, 0], retards: [0, 0, 0, 0], absents: [0, 0, 0, 0] }
            : { labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'], presents: [0, 0, 0, 0, 0, 0, 0], retards: [0, 0, 0, 0, 0, 0, 0], absents: [0, 0, 0, 0, 0, 0, 0] };
    }
    lastTrendData = data;
    if (trendChartInstance) { try { trendChartInstance.destroy(); } catch {} }
    trendChartInstance = _renderTrendWithData(canvas, data.labels, data.presents, data.retards, data.absents, textColor, gridColor);
}

function _renderHoursWithData(canvas, depts, hours, textColor, gridColor) {
    return new Chart(canvas, {
        type: 'bar',
        data: {
            labels: depts,
            datasets: [{ label: 'Heures moyennes / jour', data: hours, backgroundColor: 'rgba(99, 102, 241, 0.85)', hoverBackgroundColor: '#6366F1', borderRadius: 8 }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            animation: { duration: 400 },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(ctx) { return ` ${ctx.raw} heures en moyenne`; } } } },
            scales: {
                x: { min: 0, max: 10, grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
                y: { grid: { display: false }, ticks: { color: textColor, font: { size: 11, weight: '600' } } }
            }
        }
    });
}

async function renderHoursWorkedChart() {
    const canvas = document.getElementById('chart-hours-worked');
    if (!canvas || !window.Chart) return;
    const { textColor, gridColor } = _chartPalette();

    // PERF : lecture SYNCHRONE du cache (peekHoursWorked) → rendu immédiat ;
    // sinon squelette horizontal pendant le fetch du bundle.
    const cached = api.peekHoursWorked ? api.peekHoursWorked() : null;
    if (cached) {
        if (hoursChartInstance) { try { hoursChartInstance.destroy(); } catch {} }
        hoursChartInstance = _renderHoursWithData(canvas, cached.departements, cached.heures, textColor, gridColor);
        _renderHoursBadge(cached.moyenne_globale);
        return;
    }

    if (!lastHoursData) {
        if (hoursChartInstance) { try { hoursChartInstance.destroy(); } catch {} }
        hoursChartInstance = showChartSkeleton(canvas, { horizontal: true });
    }
    let data = null;
    try {
        data = api.getHoursWorked ? await api.getHoursWorked() : null;
    } catch (e) { data = null; }
    if (!data) data = { departements: ['Aucune donnée'], heures: [0], moyenne_globale: 0 };
    lastHoursData = data;
    if (hoursChartInstance) { try { hoursChartInstance.destroy(); } catch {} }
    hoursChartInstance = _renderHoursWithData(canvas, data.departements, data.heures, textColor, gridColor);
    _renderHoursBadge(data.moyenne_globale);
}

function _renderHoursBadge(moyenne) {
    const badgeEl = document.getElementById('avg-hours-badge');
    if (!badgeEl || moyenne === undefined) return;
    if (window.MadaAnim && MadaAnim.animateNumber) {
        MadaAnim.animateNumber(badgeEl, Number(moyenne) || 0, {
            prefix: 'Moyenne: ', suffix: 'h / jour', decimals: 1
        });
    } else {
        badgeEl.textContent = 'Moyenne: ' + moyenne + 'h / jour';
    }
}



// ----------------------------------------------------
// PAGE INITIALIZATION
// ----------------------------------------------------
async function initPage() {
    window._lastInitializedModule = 'dashboard';
    const user = api.getCurrentUser();
    if (!user) return;

    // Date du jour
    const d = new Date();
    const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const todayEl = document.getElementById('today-date');
    if (todayEl) {
        todayEl.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1) + ' — Analytics de présence en direct';
    }

    // PERF PRÉCHAUFFAGE : les 2 graphiques partent MAINTENANT, en parallèle
    // du shell. Un seul vol réseau (dashboard_charts.php, partagé par
    // getTrends()/getHoursWorked()) → dès l'arrivée du bundle, les deux
    // se dessinent ensemble au lieu d'être sérialisés l'un derrière l'autre.
    const pCharts = (async () => {
        try {
            // Amorce le vol partagé du bundle (getHoursWorked réutilisera
            // la même promesse — zéro 2e aller-retour HTTP).
            const trends = api.getTrends ? await api.getTrends('7d') : null;
            if (trends) lastTrendData = trends;
        } catch {}
        renderTrendChart(currentTrendView);
        renderHoursWorkedChart();
    })();

    // ── FILTRES DE PÉRIODE : rechargent VRAIMENT les données ──
    // Chaque clic recharge KPI + donut + flux horaire sur la fenêtre choisie
    // (Aujourd'hui / Cette semaine / Ce mois) avec les animations.
    document.querySelectorAll('#dashboard-period-menu .filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            const period = btn.dataset.period || 'today';
            if (period === currentPeriod) return;
            document.querySelectorAll('#dashboard-period-menu .filter-pill').forEach(b => {
                b.classList.remove('active');
                b.classList.add('text-slate-600', 'dark:text-stone-400');
            });
            btn.classList.add('active');
            btn.classList.remove('text-slate-600', 'dark:text-stone-400');
            currentPeriod = period;
            reloadPeriodData(period);
        });
    });

    // Charge les stats d'une période avec 1 retry : un échec réseau ne doit
    // jamais se déguiser en "0 employé" (anneau gris trompeur).
    const loadStats = async (period) => {
        let stats = await api.getDashboardStats(period);
        if ((!stats || stats.total <= 0) && !lastDashStats) {
            await new Promise(r => setTimeout(r, 2000));
            stats = await api.getDashboardStats(period);
        }
        return stats;
    };

    // Rechargement complet de la période courante (pills + initial).
    // Anti-course : un double clic rapide ne mélange jamais deux fenêtres.
    async function reloadPeriodData(period) {
        const seq = ++statsLoadSeq;
        const stats = await loadStats(period);
        if (seq !== statsLoadSeq) return;
        renderPeriodData(stats);
        const activity = await api.getActivity(period);
        if (seq !== statsLoadSeq) return;
        renderActivityBars(activity);
    }

    function renderPeriodData(stats) {
        const donutCenterPct = document.getElementById('donut-center-pct');
        if (!stats || stats.total <= 0) {
            // Vrai échec (jamais 0 employé en pratique) : anneau gris + "…"
            // au lieu de "0 %", et on garde l'ancien graphique s'il existe.
            if (!lastDashStats) {
                renderDonutChart(0, 0, 0);
                if (donutCenterPct) donutCenterPct.textContent = '…';
                ['legend-presents', 'legend-retards', 'legend-absents'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = '…';
                });
            }
            return;
        }
        lastDashStats = stats;

        const pct = stats.total > 0 ? Math.round((stats.entrees / stats.total) * 100) : 0;

        // KPI animés 0 → valeur réelle (valeur finale identique)
        animateKpis(stats);
        if (donutCenterPct && window.MadaAnim) MadaAnim.animateNumber(donutCenterPct, pct, { suffix: '%' });

        // Sidebar counter badge
        const badgeEmp = document.getElementById('badge-count-emp');
        if (badgeEmp && window.MadaAnim) MadaAnim.animateNumber(badgeEmp, stats.total);

        // Donut (répartition de la période)
        renderDonutChart(stats.entrees, stats.retards, stats.absents);
    }

    function renderActivityBars(bars) {
        try {
            if (!Array.isArray(bars) || bars.length === 0) return;
            const maxCount = Math.max(...bars.map(b => (b && b.count) ? b.count : 0), 1);
            const peak = bars.reduce((best, b) => ((b && b.count) || 0) > ((best && best.count) || 0) ? b : best, bars[0]);
            const activityBarsEl = document.getElementById('activity-bars');
            if (activityBarsEl) {
                activityBarsEl.innerHTML = bars.map(b => `
                    <div class="w-full bg-[#F46A21]/20 hover:bg-[#F46A21] transition-colors relative group rounded-t-md cursor-pointer"
                         data-h="${Math.max(12, Math.round((((b && b.count) || 0) / maxCount) * 100))}">
                        <div class="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white font-mono text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg border border-slate-700">
                            ${b.heure || ''} : ${b.count || 0} scan(s)
                        </div>
                    </div>`).join('');
                // Hauteurs via CSSOM (autorisé par CSP style-src sans unsafe-inline)
                // + montée animée 0 % → hauteur cible (MadaAnim, présentationnel)
                if (window.MadaAnim && MadaAnim.animateBars) {
                    MadaAnim.animateBars(activityBarsEl);
                } else {
                    activityBarsEl.querySelectorAll('[data-h]').forEach(el => { el.style.height = el.dataset.h + '%'; });
                }
            }
            const peakEl = document.getElementById('activity-peak');
            if (peakEl && peak) peakEl.textContent = `Pic à ${peak.heure || ''} (${peak.count || 0} pointages)`;
        } catch (errAct) {
            console.warn('Activity chart error:', errAct);
        }
    }

    // Charge initial (période par défaut : Aujourd'hui) via le MÊME chemin
    // que les pills — même rendu, mêmes animations.
    const pStats = reloadPeriodData(currentPeriod);

    document.removeEventListener('mada:themeChanged', _onThemeChangedHandler);
    _onThemeChangedHandler = () => _onThemeChanged(currentPeriod);
    document.addEventListener('mada:themeChanged', _onThemeChangedHandler);

    // Stats/flux chargés par reloadPeriodData(currentPeriod) (pStats, plus haut)

    // Trend Chart Filter buttons
    document.querySelectorAll('#chart-trend-selector .trend-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#chart-trend-selector .trend-btn').forEach(b => {
                b.classList.remove('active', 'bg-[#F46A21]', 'text-white');
                b.classList.add('text-slate-600', 'dark:text-stone-400');
            });
            btn.classList.add('active', 'bg-[#F46A21]', 'text-white');
            btn.classList.remove('text-slate-600', 'dark:text-stone-400');
            currentTrendView = btn.dataset.view;
            renderTrendChart(currentTrendView);
        });
    });

    // Render Recent Pointages Table
    const pList = api.getTodayPointages().then((todayList) => {
        const tbody = document.getElementById('today-table-body');
        if (tbody) {
            tbody.innerHTML = (todayList || []).map(rowHTML).join('')
                || '<tr><td colspan="5" class="py-lg px-md text-center text-slate-400">Aucun pointage pour le moment aujourd\'hui.</td></tr>';
        }
    });

    // (Filtres de période branchés plus haut : rechargement réel des données)

    // Flux horaire + stats chargés par reloadPeriodData(currentPeriod) (pStats)
    await Promise.allSettled([pCharts, pStats, pList]);
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['dashboard'] = initPage;
window.initPage = initPage;
})();