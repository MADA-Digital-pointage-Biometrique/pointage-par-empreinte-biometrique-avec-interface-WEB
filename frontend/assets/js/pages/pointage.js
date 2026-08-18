// ============================================================
// Page : Borne de Pointage Biométrique Interactive
// ============================================================

let scanning = false;

function statusBadge(p) {
    if (p.sortie !== null) {
        return `
            <span class="inline-flex items-center gap-1 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                <span class="material-symbols-outlined text-[13px]">logout</span> Sortie
            </span>`;
    }
    if (isRetard(p.entree)) {
        return `
            <span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                <span class="material-symbols-outlined text-[13px]">schedule</span> Retard
            </span>`;
    }
    return `
        <span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            <span class="material-symbols-outlined text-[13px]">check_circle</span> Présent
        </span>`;
}

function initials(u) {
    if (!u || !u.prenom || !u.nom) return 'U';
    return (u.prenom[0] + u.nom[0]).toUpperCase();
}

async function loadUserDropdown() {
    const users = await api.getUsers();
    const currentUser = api.getCurrentUser();
    const select = document.getElementById('user-select');
    if (!select) return;

    select.innerHTML = users.map(u => `
        <option value="${u.id}" ${currentUser && currentUser.id === u.id ? 'selected' : ''}>
            ${u.prenom} ${u.nom} (${u.matricule}) ${u.empreinte ? '✓ Empreinte OK' : '✗ Empreinte manquante'}
        </option>`).join('');
}

async function renderHistoryTable() {
    const todayList = await api.getTodayPointages();
    const tbody = document.getElementById('history-body');
    if (!tbody) return;

    if (todayList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-lg px-md text-center text-slate-400">Aucun pointage effectué aujourd\'hui.</td></tr>';
        return;
    }

    tbody.innerHTML = todayList.map(p => {
        const u = p.user || { prenom: 'Employé', nom: '', matricule: 'EMP' };
        return `
        <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors h-14">
            <td class="py-sm px-md">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-[11px] shadow-sm">
                        ${initials(u)}
                    </div>
                    <div>
                        <div class="font-semibold text-slate-900 dark:text-white">${u.prenom} ${u.nom}</div>
                        <div class="text-[11px] font-mono text-slate-400">${u.matricule}</div>
                    </div>
                </div>
            </td>
            <td class="py-sm px-md font-mono text-[13px] text-emerald-600 dark:text-emerald-400 font-semibold">${p.entree ? p.entree.slice(0, 5) : '—'}</td>
            <td class="py-sm px-md font-mono text-[13px] text-rose-600 dark:text-rose-400 font-semibold">${p.sortie ? p.sortie.slice(0, 5) : '—'}</td>
            <td class="py-sm px-md text-right">${statusBadge(p)}</td>
        </tr>`;
    }).join('');
}

async function triggerScan() {
    if (scanning) return;
    const select = document.getElementById('user-select');
    if (!select) return;

    const selectedId = parseInt(select.value, 10);
    const users = await api.getUsers();
    const targetUser = users.find(u => u.id === selectedId);

    if (!targetUser) return;

    const bioIcon = document.getElementById('bio-icon');
    const scannerIcon = document.getElementById('scanner-icon');
    const hint = document.getElementById('scan-hint');
    const userCard = document.getElementById('user-card');

    if (!targetUser.empreinte) {
        if (bioIcon) bioIcon.className = 'w-36 h-36 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xl shadow-rose-500/25 biometric-scan relative overflow-hidden';
        if (scannerIcon) scannerIcon.textContent = 'error';
        if (hint) {
            hint.textContent = `Aucune empreinte pour ${targetUser.prenom} ${targetUser.nom}. Enrôlez-la d'abord.`;
            hint.className = 'text-xs font-semibold text-rose-600 dark:text-rose-400 mb-lg';
        }
        flash(`Empreinte manquante pour ${targetUser.prenom} ${targetUser.nom}. Rendez-vous dans la rubrique "Employés" pour l'enrôler.`, 'danger');
        return;
    }

    scanning = true;
    if (bioIcon) bioIcon.className = 'w-36 h-36 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/25 pulse-ring relative overflow-hidden';
    if (scannerIcon) scannerIcon.textContent = 'fingerprint';
    if (hint) {
        hint.textContent = 'Vérification des minuties biométriques en cours...';
        hint.className = 'text-xs font-semibold text-blue-600 dark:text-blue-400 mb-lg';
    }

    setTimeout(async () => {
        const timeStr = timeNow();
        const todayStr = todayISO();
        const db = loadDB();

        let todayP = db.pointages.find(p => p.user_id === targetUser.id && p.date === todayStr);

        if (!todayP) {
            todayP = {
                id: Date.now(),
                user_id: targetUser.id,
                date: todayStr,
                entree: timeStr,
                sortie: null
            };
            db.pointages.unshift(todayP);
            saveDB(db);
            flash(`Entrée enregistrée avec succès à ${timeStr.slice(0,5)} pour ${targetUser.prenom} ${targetUser.nom}!`, 'success');
        } else if (todayP.sortie === null) {
            todayP.sortie = timeStr;
            saveDB(db);
            flash(`Sortie enregistrée avec succès à ${timeStr.slice(0,5)} pour ${targetUser.prenom} ${targetUser.nom}!`, 'success');
        } else {
            flash(`Pointage (Entrée & Sortie) déjà complété aujourd'hui pour ${targetUser.prenom} ${targetUser.nom}.`, 'warning');
        }

        scanning = false;
        if (bioIcon) bioIcon.className = 'w-36 h-36 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-500/25 relative overflow-hidden';
        if (scannerIcon) scannerIcon.textContent = 'check_circle';
        if (hint) {
            hint.textContent = `Pointage validé (${timeStr.slice(0,5)}) !`;
            hint.className = 'text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-lg';
        }

        // Display user card result
        if (userCard) {
            userCard.classList.remove('hidden');
            document.getElementById('card-avatar').textContent = initials(targetUser);
            document.getElementById('card-name').textContent = `${targetUser.prenom} ${targetUser.nom}`;
            document.getElementById('card-mat').textContent = `${targetUser.matricule} • ${targetUser.departement || 'Général'}`;
        }

        renderHistoryTable();

        setTimeout(() => {
            if (bioIcon) bioIcon.className = 'w-36 h-36 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-800 text-white flex items-center justify-center shadow-xl shadow-blue-500/25 group-hover:scale-105 transition-transform duration-300 biometric-scan relative overflow-hidden';
            if (scannerIcon) scannerIcon.textContent = 'fingerprint';
            if (hint) {
                hint.textContent = 'Cliquez sur l\'empreinte pour valider le scan';
                hint.className = 'text-xs font-semibold text-blue-600 dark:text-blue-400 mb-lg';
            }
        }, 3000);
    }, 1000);
}

function initPage() {
    loadUserDropdown();
    renderHistoryTable();

    document.getElementById('btn-scan')?.addEventListener('click', triggerScan);
    document.getElementById('btn-refresh-history')?.addEventListener('click', renderHistoryTable);
}