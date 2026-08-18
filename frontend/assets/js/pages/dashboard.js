// ============================================================
// Page : Tableau de bord & Menus Interactifs
// ============================================================

function initials(user) {
    if (!user) return 'U';
    return (user.prenom[0] + user.nom[0]).toUpperCase();
}

function statusBadge(p) {
    if (p.sortie !== null) {
        return `
            <span class="inline-flex items-center gap-1 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold text-[11px] px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-800">
                <span class="material-symbols-outlined text-[13px]">logout</span> Sortie (${p.sortie.slice(0, 5)})
            </span>`;
    }
    if (isRetard(p.entree) && new Date(p.date + 'T' + p.entree) <= new Date()) {
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
                <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-[12px] shadow-sm mx-auto">
                    ${initials(p.user)}
                </div>
            </td>
            <td class="py-sm px-md">
                <div class="font-semibold text-slate-900 dark:text-white">${p.user.prenom} ${p.user.nom}</div>
                <div class="text-[11px] font-mono text-slate-400">${p.user.matricule}</div>
            </td>
            <td class="py-sm px-md font-mono text-[13px] text-slate-600 dark:text-slate-300">${time ? time.slice(0, 5) : '—'}</td>
            <td class="py-sm px-md text-slate-600 dark:text-slate-400">${p.user.departement || '—'}</td>
            <td class="py-sm px-md text-right">${statusBadge(p)}</td>
        </tr>`;
}

async function initPage() {
    const user = api.getCurrentUser();
    if (!user) return;

    // Date du jour formatted nicely
    const d = new Date();
    const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const todayEl = document.getElementById('today-date');
    if (todayEl) {
        todayEl.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1) + ' — État de présence en temps réel';
    }

    // Load Stats & KPIs
    const stats = await api.getDashboardStats();
    document.getElementById('kpi-total').textContent = stats.total;
    document.getElementById('kpi-presents').textContent = stats.entrees;
    document.getElementById('kpi-absents').textContent = stats.absents;
    document.getElementById('kpi-pointages').textContent = stats.evenements;
    document.getElementById('kpi-pct').textContent = stats.total > 0 ? Math.round((stats.entrees / stats.total) * 100) + '%' : '0%';

    // Sidebar counter badge
    const badgeEmp = document.getElementById('badge-count-emp');
    if (badgeEmp) badgeEmp.textContent = stats.total;

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
            const period = btn.dataset.period;
            flash(`Filtre activé : ${btn.textContent}`, 'info');
        });
    });

    // Render Activity Chart Bars
    const bars = await api.getActivity();
    const maxCount = Math.max(...bars.map(b => b.count), 1);
    const peak = bars.reduce((best, b) => b.count > best.count ? b : best, bars[0]);
    const activityBarsEl = document.getElementById('activity-bars');
    if (activityBarsEl) {
        activityBarsEl.innerHTML = bars.map(b => `
            <div class="w-full bg-blue-500/20 hover:bg-blue-600 transition-colors relative group rounded-t-md"
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
            // Refresh table
            const refreshedList = await api.getTodayPointages();
            render(refreshedList);
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