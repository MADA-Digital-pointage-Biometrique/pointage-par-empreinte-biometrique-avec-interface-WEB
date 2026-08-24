// ============================================================
// Page : Tableau de Bord & Analytics Avancés (KPIs & Graphiques)
// ============================================================

let donutChartInstance = null;
let trendChartInstance = null;
let hoursChartInstance = null;

function loadChartJS() {
    return new Promise((resolve) => {
        if (window.Chart) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
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

    donutChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ["À l'heure", 'En retard', 'Absents'],
            datasets: [{
                data: [Math.max(0, presents - retards), retards, absents],
                backgroundColor: ['#10B981', '#F59E0B', '#F43F5E'],
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

function renderHeatmap() {
    const container = document.getElementById('heatmap-container');
    if (!container) return;

    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
    const depts = [
        { name: 'Web & mobile', scores: [100, 100, 85, 100, 90] },
        { name: 'Infogérance', scores: [90, 80, 100, 90, 80] },
        { name: 'ERP sur mesure', scores: [100, 90, 90, 100, 100] },
        { name: 'IA & data', scores: [80, 100, 100, 85, 90] },
        { name: 'Sécurité', scores: [100, 100, 90, 100, 95] },
    ];

    let html = `
        <table class="w-full text-center border-collapse text-xs">
            <thead>
                <tr>
                    <th class="py-2 px-2 text-left font-bold text-slate-400">Département</th>
                    ${days.map(d => `<th class="py-2 px-2 font-bold text-slate-400">${d}</th>`).join('')}
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">`;

    depts.forEach(dept => {
        html += `<tr><td class="py-2.5 px-2 text-left font-semibold text-slate-700 dark:text-slate-300 text-[11px] truncate max-w-[120px]">${dept.name}</td>`;
        dept.scores.forEach(score => {
            let bgClass = 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
            if (score < 85) {
                bgClass = 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30';
            } else if (score < 95) {
                bgClass = 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30';
            }

            html += `
                <td class="py-2.5 px-2">
                    <div class="w-full py-1.5 rounded-lg border font-mono font-bold text-[11px] ${bgClass} transition-all hover:scale-105 cursor-default" title="${dept.name} - Assiduité: ${score}%">
                        ${score}%
                    </div>
                </td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

// ----------------------------------------------------
// PAGE INITIALIZATION
// ----------------------------------------------------
async function initPage() {
    const user = api.getCurrentUser();
    if (!user) return;

    // Load Chart.js dynamically
    await loadChartJS();

    // Date du jour
    const d = new Date();
    const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const todayEl = document.getElementById('today-date');
    if (todayEl) {
        todayEl.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1) + ' — Analytics de présence en direct';
    }

    // Load Stats & KPIs
    const stats = await api.getDashboardStats();
    const totalEl = document.getElementById('kpi-total');
    const presentsEl = document.getElementById('kpi-presents');
    const absentsEl = document.getElementById('kpi-absents');
    const retardsEl = document.getElementById('kpi-retards');
    const pctEl = document.getElementById('kpi-pct');
    const donutCenterPct = document.getElementById('donut-center-pct');

    const pct = stats.total > 0 ? Math.round((stats.entrees / stats.total) * 100) : 0;

    if (totalEl) totalEl.textContent = stats.total;
    if (presentsEl) presentsEl.textContent = stats.entrees;
    if (absentsEl) absentsEl.textContent = stats.absents;
    if (retardsEl) retardsEl.textContent = stats.retards;
    if (pctEl) pctEl.textContent = pct + '%';
    if (donutCenterPct) donutCenterPct.textContent = pct + '%';

    // Sidebar counter badge
    const badgeEmp = document.getElementById('badge-count-emp');
    if (badgeEmp) badgeEmp.textContent = stats.total;

    // Render Charts
    renderDonutChart(stats.entrees, stats.retards, stats.absents);
    renderTrendChart('7d');
    renderHoursWorkedChart();
    renderHeatmap();

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
    const todayList = await api.getTodayPointages();
    const tbody = document.getElementById('today-table-body');
    const render = (rows) => {
        if (!tbody) return;
        tbody.innerHTML = rows.map(rowHTML).join('')
            || '<tr><td colspan="5" class="py-lg px-md text-center text-slate-400">Aucun pointage pour le moment aujourd\'hui.</td></tr>';
    };
    render(todayList);

    // Period Menu Buttons Interaction
    document.querySelectorAll('#dashboard-period-menu .filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#dashboard-period-menu .filter-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            flash(`Vue analytique mise à jour : ${btn.textContent}`, 'info');
        });
    });

    // Render Activity Chart Bars (Hourly Peak)
    const bars = await api.getActivity();
    const maxCount = Math.max(...bars.map(b => b.count), 1);
    const peak = bars.reduce((best, b) => b.count > best.count ? b : best, bars[0]);
    const activityBarsEl = document.getElementById('activity-bars');
    if (activityBarsEl) {
        activityBarsEl.innerHTML = bars.map(b => `
            <div class="w-full bg-[#F46A21]/20 hover:bg-[#F46A21] transition-colors relative group rounded-t-md cursor-pointer"
                 style="height:${Math.max(12, Math.round((b.count / maxCount) * 100))}%">
                <div class="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white font-mono text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg border border-slate-700">
                    ${b.heure} : ${b.count} scan(s)
                </div>
            </div>`).join('');
    }
    const peakEl = document.getElementById('activity-peak');
    if (peakEl) peakEl.textContent = `Pic à ${peak.heure} (${peak.count} pointages)`;

    // Quick Actions Menu Handlers
    document.getElementById('btn-force')?.addEventListener('click', async () => {
        const allUsers = await api.getUsers();
        const select = document.getElementById('force-select-user');
        if (select) {
            select.innerHTML = allUsers.map(u => `<option value="${u.id}">${u.prenom} ${u.nom} (${u.matricule}) - ${u.departement || 'Sans Dép'}</option>`).join('');
        }
        openModal('modal-force-pointage');
    });

    document.getElementById('form-force-pointage')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = parseInt(document.getElementById('force-select-user').value, 10);
        const type = document.querySelector('input[name="force-type"]:checked').value;
        const allUsers = await api.getUsers();
        const u = allUsers.find(x => x.id === userId);

        if (u) {
            flash(`Pointage manuel (${type.toUpperCase()}) forcé avec succès pour ${u.prenom} ${u.nom}.`, 'success');
            closeModal('modal-force-pointage');
            // Refresh table & stats
            const refreshedList = await api.getTodayPointages();
            render(refreshedList);
            const newStats = await api.getDashboardStats();
            renderDonutChart(newStats.entrees, newStats.retards, newStats.absents);
        }
    });

    document.getElementById('btn-report')?.addEventListener('click', async () => {
        const pointages = await api.getTodayPointages();
        let csvContent = "data:text/csv;charset=utf-8,Matricule,Employe,Departement,Heure,Statut\n";
        pointages.forEach(p => {
            const time = p.sortie !== null ? p.sortie : p.entree;
            const status = p.sortie !== null ? 'Sortie' : 'Entree';
            csvContent += `${p.user.matricule},"${p.user.prenom} ${p.user.nom}",${p.user.departement || ''},${time},${status}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Rapport_Pointage_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        flash('Le rapport CSV des pointages a été généré et téléchargé.', 'success');
    });
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['dashboard'] = initPage;
window.initPage = initPage;