(function () {
// ============================================================
// Page : Tableau de Bord & Analytics Avancés (KPIs & Graphiques)
// ============================================================

let donutChartInstance = null;
let trendChartInstance = null;
let hoursChartInstance = null;

function loadChartJS() {
    // Chart.js est vendu en local (assets/js/vendor/chart.umd.min.js, chargé
    // par dashboard.php). Pas de fallback CDN : bloqué par script-src 'self'.
    return Promise.resolve();
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
// GRAPHICS RENDER ENGINE
// ----------------------------------------------------
function renderDonutChart(presents, retards, absents) {
    const canvas = document.getElementById('chart-presence-donut');
    if (!canvas || !window.Chart) return;

    if (donutChartInstance) {
        donutChartInstance.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');

    const legP = document.getElementById('legend-presents');
    const legR = document.getElementById('legend-retards');
    const legA = document.getElementById('legend-absents');
    if (legP) legP.textContent = Math.max(0, presents - retards);
    if (legR) legR.textContent = retards;
    if (legA) legA.textContent = absents;

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

function renderTrendChart(view = '7d') {
    const canvas = document.getElementById('chart-attendance-trend');
    if (!canvas || !window.Chart) return;

    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#9CA3AF' : '#4B5563';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)';

    let labels = [];
    let presentsData = [];
    let retardsData = [];
    let absentsData = [];

    if (view === '7d') {
        labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        presentsData = [5, 6, 5, 6, 5, 2];
        retardsData = [1, 0, 2, 1, 0, 0];
        absentsData = [1, 0, 1, 0, 1, 4];
    } else {
        labels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
        presentsData = [28, 30, 29, 31];
        retardsData = [4, 3, 5, 2];
        absentsData = [3, 2, 4, 1];
    }

    trendChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Présents (À l\'heure)',
                    data: presentsData,
                    backgroundColor: '#10B981',
                    borderRadius: 6
                },
                {
                    label: 'Retards',
                    data: retardsData,
                    backgroundColor: '#F59E0B',
                    borderRadius: 6
                },
                {
                    label: 'Absents',
                    data: absentsData,
                    backgroundColor: '#F43F5E',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: textColor, font: { size: 11, weight: '600' } }
                }
            },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { size: 11 } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { size: 11 } }
                }
            }
        }
    });
}

function renderHoursWorkedChart() {
    const canvas = document.getElementById('chart-hours-worked');
    if (!canvas || !window.Chart) return;

    if (hoursChartInstance) {
        hoursChartInstance.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#9CA3AF' : '#4B5563';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)';

    const depts = ['Web & mobile', 'Infogérance', 'ERP', 'IA & data', 'Sécurité', 'Réseaux'];
    const hours = [8.2, 7.9, 8.0, 7.5, 8.4, 7.8];

    hoursChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: depts,
            datasets: [{
                label: 'Heures moyennes / jour',
                data: hours,
                backgroundColor: 'rgba(99, 102, 241, 0.85)',
                hoverBackgroundColor: '#6366F1',
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(ctx) { return ` ${ctx.raw} heures en moyenne`; }
                    }
                }
            },
            scales: {
                x: {
                    min: 0,
                    max: 10,
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { size: 11 } }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 11, weight: '600' } }
                }
            }
        }
    });
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

    // PERF : rendu PROGRESSIF — chaque bloc s'affiche dès que ses données
    // arrivent (pas d'attente globale). Les graphiques statiques partent
    // dès Chart.js prêt (~200ms), KPIs/table/bars suivent au fil de l'API.
    const pCharts = loadChartJS().then(() => {
        renderTrendChart('7d');
        renderHoursWorkedChart();
    });

    const pStats = api.getDashboardStats().then((stats) => {
        const totalEl = document.getElementById('kpi-total');
        const presentsEl = document.getElementById('kpi-presents');
        const absentsEl = document.getElementById('kpi-absents');
        const retardsEl = document.getElementById('kpi-retards');
        const pctEl = document.getElementById('kpi-pct');
        const donutCenterPct = document.getElementById('donut-center-pct');

        const pct = stats && stats.total > 0 ? Math.round((stats.entrees / stats.total) * 100) : 0;

        if (totalEl) totalEl.textContent = stats ? stats.total : 0;
        if (presentsEl) presentsEl.textContent = stats ? stats.entrees : 0;
        if (absentsEl) absentsEl.textContent = stats ? stats.absents : 0;
        if (retardsEl) retardsEl.textContent = stats ? stats.retards : 0;
        if (pctEl) pctEl.textContent = pct + '%';
        if (donutCenterPct) donutCenterPct.textContent = pct + '%';

        // Sidebar counter badge
        const badgeEmp = document.getElementById('badge-count-emp');
        if (badgeEmp && stats) badgeEmp.textContent = stats.total;

        // Render Charts
        if (stats) renderDonutChart(stats.entrees, stats.retards, stats.absents);
    });

    // Trend Chart Filter buttons
    document.querySelectorAll('#chart-trend-selector .trend-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#chart-trend-selector .trend-btn').forEach(b => {
                b.classList.remove('active', 'bg-[#F46A21]', 'text-white');
                b.classList.add('text-slate-600', 'dark:text-stone-400');
            });
            btn.classList.add('active', 'bg-[#F46A21]', 'text-white');
            btn.classList.remove('text-slate-600', 'dark:text-stone-400');
            renderTrendChart(btn.dataset.view);
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

    // Period Menu Buttons Interaction
    document.querySelectorAll('#dashboard-period-menu .filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#dashboard-period-menu .filter-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            flash(`Vue analytique mise à jour : ${btn.textContent}`, 'info');
        });
    });

    // Render Activity Chart Bars (Hourly Peak)
    const pBars = api.getActivity().then((bars) => {
    try {
        if (Array.isArray(bars) && bars.length > 0) {
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
                activityBarsEl.querySelectorAll('[data-h]').forEach(el => { el.style.height = el.dataset.h + '%'; });
            }
            const peakEl = document.getElementById('activity-peak');
            if (peakEl && peak) peakEl.textContent = `Pic à ${peak.heure || ''} (${peak.count || 0} pointages)`;
        }
    } catch (errAct) {
        console.warn('Activity chart error:', errAct);
    }
    });

    await Promise.allSettled([pCharts, pStats, pList, pBars]);
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['dashboard'] = initPage;
window.initPage = initPage;
})();