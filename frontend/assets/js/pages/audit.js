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
    return `<span class="inline-flex items-center font-mono font-semibold text-[11px] px-2 py-0.5 rounded-full border ${cls}">${a || '–'}</span>`;
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
        if (e.id_utilisateur) bits.push('par admin #' + e.id_utilisateur);
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
        if (!j.ok) { body.innerHTML = '<tr><td colspan="4" class="py-lg px-md text-center text-rose-500">Accès refusé.</td></tr>'; return; }
        if (j.missing) {
            body.innerHTML = '<tr><td colspan="4" class="py-lg px-md text-center text-amber-600 dark:text-amber-400">Table journal_audit absente — applique database/migration_journal_audit.sql sur Supabase.</td></tr>';
            if (summary) summary.textContent = 'Table manquante';
            return;
        }
        const rows = j.entries || [];
        if (summary) summary.textContent = rows.length + ' entrée(s)';
        if (!rows.length) { body.innerHTML = '<tr><td colspan="4" class="py-lg px-md text-center text-slate-400">Aucune entrée.</td></tr>'; return; }
        body.innerHTML = rows.map(e => `
            <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td class="py-sm px-md font-mono text-[11px] text-slate-500 whitespace-nowrap">${e.date_heure || ''}</td>
                <td class="py-sm px-md">${badgeFor(e.action)}</td>
                <td class="py-sm px-md hidden md:table-cell font-mono text-[11px] text-slate-400">${e.table_concernee || '–'}</td>
                <td class="py-sm px-md text-slate-600 dark:text-slate-300">${auditDetail(e)}</td>
            </tr>`).join('');
    } catch {
        body.innerHTML = '<tr><td colspan="4" class="py-lg px-md text-center text-slate-400">Erreur de chargement.</td></tr>';
        if (summary) summary.textContent = 'Erreur';
    }
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
    document.getElementById('btn-refresh-audit')?.addEventListener('click', renderAudit);
    document.getElementById('filter-audit-action')?.addEventListener('change', renderAudit);
    document.getElementById('filter-audit-limit')?.addEventListener('change', renderAudit);
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['audit'] = initPage;
window.initPage = initPage;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else { initPage(); }
})();
