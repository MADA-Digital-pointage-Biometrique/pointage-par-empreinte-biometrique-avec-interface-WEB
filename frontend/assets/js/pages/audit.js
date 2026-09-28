(function () {
// ============================================================
// Page : Journal d'audit (traçabilité biométrie / borne / capteur)
// ============================================================

function badgeFor(action) {
    const a = action || '';
    const danger = /delete|refus|echec|invalide/i.test(a);
    const warn = /borne|scan|archive/i.test(a);
    const cls = danger
        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800'
        : warn
            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    return `<span class="inline-flex items-center font-mono font-semibold text-[11px] px-2 py-0.5 rounded-full border ${cls}">${escapeHtml(a) || '–'}</span>`;
}

function auditDetail(e) {
    try {
        const d = typeof e.details === 'string' ? JSON.parse(e.details) : (e.details || {});
        const bits = [];
        if (d.slot !== undefined && d.slot !== null) bits.push('slot ' + d.slot);
        if (d.score !== undefined && d.score !== null) bits.push('score ' + d.score);
        if (d.device) bits.push(d.device);
        if (d.motif) bits.push(d.motif);
        if (e.id_enregistrement_concerne) bits.push('#' + e.id_enregistrement_concerne);
        const actor = e.admin_nom || (e.admin_matricule ? 'Matricule ' + e.admin_matricule : null) || (e.id_utilisateur ? 'Admin #' + e.id_utilisateur : 'Système');
        bits.push('par ' + actor);
        return bits.join(' · ') || '–';
    } catch { return '–'; }
}

async function renderAudit() {
    const body = document.getElementById('audit-body');
    if (!body) return;
    const filter = document.getElementById('filter-audit-action')?.value || '';
    const limit = document.getElementById('filter-audit-limit')?.value || '50';
    const summary = document.getElementById('audit-count-summary');
    if (summary) summary.textContent = 'Chargement…';
    try {
        const r = await fetch(
            getApiEndpoint('audit.php') + '?limit=' + encodeURIComponent(limit) + (filter ? '&action=' + encodeURIComponent(filter) : ''),
            { credentials: 'include', cache: 'no-store' }
        );
        if (r.status === 401) { window.location.replace('login.php'); return; }
        const j = await r.json();
        if (!j.ok) {
            // 403 = session serveur sans droits super-admin (ex. connecté avec un
            // compte admin simple, ou 2 onglets avec 2 comptes différents).
            const msg = (j.message && String(j.message)) || 'Accès refusé.';
            body.innerHTML = '<tr><td colspan="5" class="py-lg px-md text-center text-rose-500">' + msg + '<br><span class="text-[11px] text-slate-400">Connectez-vous avec le compte Super Admin (ADM001).</span></td></tr>';
            if (summary) summary.textContent = 'Accès refusé';
            return;
        }
        if (j.missing) {
            body.innerHTML = '<tr><td colspan="5" class="py-lg px-md text-center text-amber-600 dark:text-amber-400">Table journal_audit absente — applique database/migration_journal_audit.sql sur Supabase.</td></tr>';
            if (summary) summary.textContent = 'Table manquante';
            return;
        }
        const rows = j.entries || [];
        if (summary) summary.textContent = rows.length + ' entrée(s)';
        updateAuditSelection();
        if (!rows.length) { body.innerHTML = '<tr><td colspan="5" class="py-lg px-md text-center text-slate-400">Aucune entrée.</td></tr>'; return; }
        body.innerHTML = rows.map(e => `
            <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td class="py-sm px-md w-16"><input type="checkbox" class="audit-check" value="${e.id_audit}" title="Sélectionner cette entrée"></td>
                <td class="py-sm px-md font-mono text-[11px] text-slate-500 whitespace-nowrap">${e.date_heure || ''}</td>
                <td class="py-sm px-md">${badgeFor(e.action)}</td>
                <td class="py-sm px-md hidden md:table-cell font-mono text-[11px] text-slate-400">${escapeHtml(e.table_concernee) || '–'}</td>
                <td class="py-sm px-md text-slate-600 dark:text-slate-300">${escapeHtml(auditDetail(e))}</td>
            </tr>`).join('');
        bindAuditChecks();
    } catch {
        body.innerHTML = '<tr><td colspan="5" class="py-lg px-md text-center text-slate-400">Erreur de chargement.</td></tr>';
        if (summary) summary.textContent = 'Erreur';
    }
}

// Sélection : le bouton Supprimer reste désactivé tant qu'aucune case n'est cochée.
function updateAuditSelection() {
    const rows = Array.from(document.querySelectorAll('#audit-body .audit-check'));
    const checked = rows.filter(b => b.checked);
    const btn = document.getElementById('btn-delete-audit');
    const count = document.getElementById('audit-selected-count');
    const all = document.getElementById('audit-select-all');
    if (count) count.textContent = checked.length;
    if (btn) btn.disabled = checked.length === 0;
    rows.forEach(b => b.closest('tr')?.classList.toggle('audit-row-checked', b.checked));
    if (all) {
        all.checked = rows.length > 0 && checked.length === rows.length;
        all.indeterminate = checked.length > 0 && checked.length < rows.length;
    }
}

function bindAuditChecks() {
    // NOTE : uniquement les cases des LIGNES (#audit-body). La case d'en-tête
    // (#audit-select-all) a son propre handler ci-dessous : l'inclure ici
    // annulerait chaque clic « tout cocher » (updateAuditSelection la
    // décocherait avant que le handler ne lise son état).
    document.querySelectorAll('#audit-body .audit-check').forEach(b =>
        b.addEventListener('change', updateAuditSelection));
    const all = document.getElementById('audit-select-all');
    if (all && !all.dataset.bound) {
        all.dataset.bound = '1';
        all.addEventListener('change', () => {
            document.querySelectorAll('#audit-body .audit-check').forEach(b => { b.checked = all.checked; });
            updateAuditSelection();
        });
    }
    updateAuditSelection();
}

async function deleteSelectedAudits() {
    const ids = Array.from(document.querySelectorAll('#audit-body .audit-check'))
        .filter(b => b.checked).map(b => parseInt(b.value, 10)).filter(v => v > 0);
    if (!ids.length) return;
    showConfirmModal({
        title: 'Supprimer ces entrées ?',
        message: `Voulez-vous vraiment supprimer ${ids.length} entrée(s) du journal d'audit ? Cette action est irréversible.`,
        type: 'danger',
        confirmText: 'Oui, Supprimer',
        cancelText: 'Annuler',
        onConfirm: async () => {
            let csrf = null;
            try { csrf = await api.getCsrfToken(); } catch {}
            try {
                const r = await fetch(getApiEndpoint('audit.php'), {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
                    body: JSON.stringify({ ids })
                });
                const j = await r.json();
                if (j.ok) {
                    const del = j.deleted ?? ids.length;
                    const rem = (j.remaining ?? null);
                    flash(
                        `${del} entrée(s) supprimée(s)` +
                        (rem !== null ? `, ${rem} restante(s)` : '') +
                        (rem > 0 ? ` — recommencez (par pages de 200) pour tout effacer (+1 trace de purge).` : '.'),
                        'success'
                    );
                    await renderAudit();
                } else {
                    flash(j.message || 'Échec de la suppression.', 'danger');
                }
            } catch {
                flash('Erreur réseau pendant la suppression.', 'danger');
            }
        }
    });
}

async function initPage() {
    window._lastInitializedModule = 'audit';
    const user = api.getCurrentUser();
    if (!user) return;
    if (user.role !== 'super_admin') {
        flash('Accès réservé au Super Admin.', 'danger');
        setTimeout(() => { window.location.href = 'dashboard.php'; }, 1500);
        return;
    }
    renderAudit();
    document.getElementById('btn-refresh-audit')?.addEventListener('click', async (e) => {
        setRefreshLoading(e.currentTarget, true);
        try { await renderAudit(); } finally { setRefreshLoading(e.currentTarget, false); }
    });
    document.getElementById('filter-audit-action')?.addEventListener('change', renderAudit);
    document.getElementById('filter-audit-limit')?.addEventListener('change', renderAudit);
    document.getElementById('btn-delete-audit')?.addEventListener('click', deleteSelectedAudits);
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['audit'] = initPage;
window.initPage = initPage;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else { initPage(); }
})();
