(function () {
// ============================================================
// Page : Empreintes Biométriques
// ============================================================

function initials(u) {
    if (!u || !u.prenom || !u.nom) return 'U';
    return (u.prenom[0] + u.nom[0]).toUpperCase();
}

function avatar(u, size = 'w-9 h-9') {
    if (u.photo_url) {
        return `<div class="${size} rounded-full overflow-hidden border-2 border-[#F46A21]/30 shadow-sm flex-shrink-0"><img src="${u.photo_url}" alt="${u.prenom} ${u.nom}" class="w-full h-full object-cover"></div>`;
    }
    return `<div class="${size} rounded-full bg-gradient-to-tr from-[#F46A21] to-[#F9AE3F] text-white flex items-center justify-center font-bold text-[12px] shadow-sm flex-shrink-0">${initials(u)}</div>`;
}

function empRow(u) {
    const empBadge = u.empreinte
        ? '<span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800"><span class="material-symbols-outlined text-[13px]">verified</span> Enregistrée</span>'
        : '<span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800"><span class="material-symbols-outlined text-[13px]">block</span> Aucune</span>';
    const isSuper = (() => { try { const cu = api.getCurrentUser(); return cu && (cu.role === 'super_admin' || cu.role === 'admin_systeme'); } catch(e){ return false; } })();
    const hasFp = u.empreinte === true || u.empreinte === 1;
    const action = !isSuper ? '' : (hasFp
        ? `<button class="text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 p-1.5 rounded-lg transition-colors cursor-pointer" title="Supprimer l'empreinte" data-delete-fp="${u.id}"><span class="material-symbols-outlined text-[16px]">fingerprint</span></button>`
        : `<button class="bg-[#FFF1E8] dark:bg-orange-950/40 text-[#F46A21] dark:text-[#F9AE3F] hover:bg-orange-100 font-semibold text-[11px] px-2.5 py-1 rounded-lg border border-[#F46A21]/25 dark:border-orange-900 transition-colors inline-flex items-center gap-1 cursor-pointer" data-enroll="${u.id}"><span class="material-symbols-outlined text-[14px]">fingerprint</span> Enrôler</button>`);

    return `
        <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors h-14">
            <td class="py-sm px-md">
                <div class="flex items-center gap-md">
                    ${avatar(u)}
                    <div>
                        <div class="font-semibold text-slate-900 dark:text-white">${u.prenom} ${u.nom}</div>
                        <div class="text-[11px] text-slate-400 md:hidden">${u.matricule}</div>
                    </div>
                </div>
            </td>
            <td class="py-sm px-md hidden md:table-cell font-mono text-[13px] text-slate-600 dark:text-slate-300">${u.matricule}</td>
            <td class="py-sm px-md font-medium text-slate-700 dark:text-slate-300">${u.departement || 'Non assigné'}</td>
            <td class="py-sm px-md">${empBadge}</td>
            <td class="py-sm px-md text-right"><div class="inline-flex items-center gap-1">${action}</div></td>
        </tr>`;
}

let allUsers = [];

async function renderEmpreintes(forceFetch = false) {
    if (forceFetch || !allUsers || allUsers.length === 0) {
        const raw = await api.getUsers();
        allUsers = raw.filter(u => u.role === 'employe');
    }
    const search = (document.getElementById('top-search')?.value || '').trim().toLowerCase();
    const filterDept = (document.getElementById('filter-dept')?.value || '').toLowerCase();
    const filterEmp = (document.getElementById('filter-emp')?.value || '');
    const filtered = allUsers.filter(u => {
        const matchesSearch = !search || u.nom.toLowerCase().includes(search) || u.prenom.toLowerCase().includes(search) || u.matricule.toLowerCase().includes(search) || (u.email||'').toLowerCase().includes(search) || (u.departement||'').toLowerCase().includes(search);
        const matchesDept = !filterDept || (u.departement||'').toLowerCase() === filterDept;
        const matchesEmp = !filterEmp || (filterEmp === 'yes' ? !!u.empreinte : !u.empreinte);
        return matchesSearch && matchesDept && matchesEmp;
    });
    const body = document.getElementById('users-body');
    if (body) body.innerHTML = filtered.map(empRow).join('') || '<tr><td colspan="5" class="py-lg px-md text-center text-slate-400">Aucun employé ne correspond aux critères.</td></tr>';
    const summary = document.getElementById('emp-count-summary');
    if (summary) summary.textContent = `${filtered.filter(u=>u.empreinte).length} empreinte(s) sur ${filtered.length} employé(s)`;
    const badge = document.getElementById('badge-count-emp');
    if (badge) badge.textContent = allUsers.length;
}

function openEnrollModal(target) {
    if (!target) return;
    const startEnrollment = () => {
        openModal('modal-enroll');
        const icon = document.getElementById('enroll-icon');
        const step = document.getElementById('enroll-step');
        const btn = document.getElementById('btn-enroll');
        document.getElementById('enroll-person').textContent = `${target.prenom} ${target.nom} (${target.matricule})`;
        if (icon) { icon.className = 'w-24 h-24 rounded-full bg-[#FFF1E8] text-[#F46A21] flex items-center justify-center mb-lg transition-colors duration-300 shadow-inner'; icon.innerHTML = '<span class="material-symbols-outlined text-[48px]">fingerprint</span>'; }
        if (step) step.textContent = "Placez le doigt de l'employé sur le lecteur.";
        if (btn) btn.disabled = false;
        if (btn) {
            btn.onclick = async () => {
                if (icon) { icon.className = 'w-24 h-24 rounded-full bg-[#F46A21] text-white pulse-ring flex items-center justify-center mb-lg transition-colors duration-300'; icon.innerHTML = '<span class="material-symbols-outlined text-[48px]">fingerprint</span>'; }
                if (step) step.textContent = 'Numérisation biométrique en cours...';
                btn.disabled = true;
                const res = await api.enrollFingerprint(target.id);
                if (res.ok) {
                    if (icon) { icon.className = 'w-24 h-24 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-lg transition-colors duration-300'; icon.innerHTML = '<span class="material-symbols-outlined text-[48px]">check_circle</span>'; }
                    if (step) step.textContent = res.message;
                    flash(res.message, 'success');
                    btn.disabled = false;
                    setTimeout(() => { closeModal('modal-enroll'); renderEmpreintes(); }, 1200);
                } else {
                    if (icon) { icon.className = 'w-24 h-24 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-lg transition-colors duration-300'; icon.innerHTML = '<span class="material-symbols-outlined text-[48px]">error</span>'; }
                    if (step) step.textContent = res.message;
                    btn.disabled = false;
                }
            };
        }
    };
    if (target.empreinte) {
        showConfirmModal({ title: 'Remplacer l\'empreinte ?', message: `Une empreinte est déjà enregistrée pour ${target.prenom} ${target.nom}. Souhaitez-vous effectuer une nouvelle numérisation ?`, type: 'warning', confirmText: 'Ré-enrôler', cancelText: 'Conserver', onConfirm: startEnrollment });
    } else { startEnrollment(); }
}

if (!window._empreintesGlobalClickAttached) {
    window._empreintesGlobalClickAttached = true;
    document.addEventListener('click', (e) => {
        if (document.body.getAttribute('data-page') !== 'empreintes') return;
        const enrollBtn = e.target.closest('[data-enroll]');
        if (enrollBtn) {
            const id = parseInt(enrollBtn.dataset.enroll, 10);
            const target = allUsers.find(u => u.id === id);
            if (target) openEnrollModal(target);
            return;
        }
        const deleteFpBtn = e.target.closest('[data-delete-fp]');
        if (deleteFpBtn) {
            const id = parseInt(deleteFpBtn.dataset.deleteFp, 10);
            const target = allUsers.find(u => u.id === id);
            if (target) {
                showConfirmModal({
                    title: 'Supprimer l\'empreinte ?',
                    message: `Voulez-vous vraiment supprimer l'empreinte biométrique de ${target.prenom} ${target.nom} (${target.matricule}) ? L'employé devra être ré-enrôlé.`,
                    type: 'warning',
                    confirmText: 'Oui, Supprimer',
                    cancelText: 'Annuler',
                    onConfirm: async () => {
                        const res = await api.deleteFingerprint(target.id);
                        if (res.ok) { flash(`Empreinte de ${target.prenom} ${target.nom} supprimée.`, 'success'); await renderEmpreintes(); }
                        else { flash(res.message || 'Échec de la suppression.', 'danger'); }
                    }
                });
            }
            return;
        }
    });
}

async function initPage() {
    window._lastInitializedModule = 'empreintes';
    const user = api.getCurrentUser();
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'super_admin') {
        flash('Accès réservé aux administrateurs.', 'danger');
        setTimeout(() => { window.location.href = 'dashboard.php'; }, 1500);
        return;
    }
    const [, depts] = await Promise.all([
        renderEmpreintes(true),
        api.getDepartements()
    ]);
    const searchInput = document.getElementById('top-search');
    if (searchInput) searchInput.oninput = () => renderEmpreintes(false);
    const filterDept = document.getElementById('filter-dept');
    if (filterDept) filterDept.onchange = () => renderEmpreintes(false);
    const filterEmp = document.getElementById('filter-emp');
    if (filterEmp) filterEmp.onchange = () => renderEmpreintes(false);
    // Remplir départements
    const sel = document.getElementById('filter-dept');
    if (sel && depts && depts.length > 0) {
        const cur = sel.value;
        sel.innerHTML = '<option value="">Tous les Départements</option>' + depts.map(d=>`<option value="${d.nom}" ${d.nom===cur?'selected':''}>${d.nom}</option>`).join('');
    }
    // Panneau mobile : config mode capture (pointage par défaut)
    const mobileMode = document.getElementById('mobile-mode');
    const mobileUser = document.getElementById('mobile-user');
    const mobileStatus = document.getElementById('mobile-status');
    const mobileIndicator = document.getElementById('mobile-indicator');
    const btnApply = document.getElementById('btn-mobile-apply');
    function updateIndicator(mode){
        if(!mobileIndicator) return;
        if(mode==='enrolement'){ mobileIndicator.textContent='● Enrôlement'; mobileIndicator.className='px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white'; }
        else { mobileIndicator.textContent='● Pointage'; mobileIndicator.className='px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white'; }
    }
    if (mobileUser) {
        const users = await api.getUsers();
        const emps = users.filter(u=>u.role==='employe');
        mobileUser.innerHTML = '<option value="">— Choisir employé pour enrôlement —</option>' + emps.map(u=>`<option value="${u.id}">${u.prenom} ${u.nom} (${u.matricule})</option>`).join('');
    }
    try { const r=await fetch(getApiEndpoint('mobile_config.php')); const j=await r.json(); if(j.ok && j.config){ if(mobileMode) mobileMode.value=j.config.mode; if(mobileUser && j.config.user_id) mobileUser.value=j.config.user_id; if(mobileStatus) mobileStatus.textContent='Mode actuel: '+j.config.mode + (j.config.user_id ? ' (#'+j.config.user_id+')' : ''); updateIndicator(j.config.mode); } } catch{}
    if (mobileMode) mobileMode.onchange = () => updateIndicator(mobileMode.value);
    if (btnApply) btnApply.onclick = async () => {
        const mode = mobileMode.value;
        const uid = parseInt(mobileUser.value||0);
        const res = await fetch(getApiEndpoint('mobile_config.php'), {method:'POST', headers:{'Content-Type':'application/json', 'X-CSRF-Token': await api.getCsrfToken()}, body: JSON.stringify({mode, user_id: uid}), credentials:'include'});
        const j = await res.json();
        if(mobileStatus) mobileStatus.textContent = j.ok ? '✓ Mode appliqué: '+mode+(uid?' (#'+uid+')':'') : 'Erreur: '+(j.message||'');
        updateIndicator(mode);
        if(j.ok){
            flash('Mode mobile mis à jour: '+mode,'success');
            // Temps réel : notifier via WebSocket tous les mobiles connectés
            try {
                if (window.WSClient && WSClient.ws && WSClient.ws.readyState===1) {
                    WSClient.send({type:'mobile_config_update', config:{mode, user_id: uid}});
                } else {
                    // Fallback : ouvrir une connexion WS temporaire juste pour diffuser
                    const ws = new WebSocket('ws://192.168.2.2:8080');
                    ws.onopen = () => { ws.send(JSON.stringify({type:'mobile_config_update', config:{mode, user_id: uid}})); setTimeout(()=>ws.close(), 500); };
                }
            } catch{}
        } else flash(j.message,'danger');
    };
    // Écoute temps réel des changements de mode (si un autre admin change)
    try {
        if (window.WSClient) {
            WSClient.setServerUrl('ws://192.168.2.2:8080');
            const u = api.getCurrentUser();
            if (u) WSClient.connect(u.id, 'admin').catch(()=>{});
            WSClient.on('mobile_config', (d) => {
                if(d.config){
                    if(mobileMode) mobileMode.value = d.config.mode;
                    if(mobileUser && d.config.user_id) mobileUser.value = d.config.user_id;
                    updateIndicator(d.config.mode);
                    if(mobileStatus) mobileStatus.textContent = '↻ Temps réel: ' + d.config.mode + (d.config.user_id ? ' (#'+d.config.user_id+')' : '');
                }
            });
        }
    } catch{}
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['empreintes'] = initPage;
window.initPage = initPage;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else { initPage(); }
})();
