(function () {
// ============================================================
// Page : Paramètres (compte, apparence, préférences, données)
// ============================================================

function settingsRoleLabel(role) {
    return (role === 'super_admin' || role === 'admin_systeme') ? 'Super Administrateur' : 'Administrateur RH';
}

// ─── Thème ──────────────────────────────────────────────────

function refreshThemeUI() {
    const isDark = document.documentElement.classList.contains('dark');
    ['btn-theme-light', 'btn-theme-dark'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const active = (id === 'btn-theme-dark') === isDark;
        btn.classList.toggle('bg-gradient-to-r', active);
        btn.classList.toggle('from-[#F46A21]', active);
        btn.classList.toggle('to-[#F9AE3F]', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('shadow-md', active);
        btn.classList.toggle('shadow-orange-500/20', active);
        btn.classList.toggle('border-transparent', active);
        btn.classList.toggle('bg-slate-100', !active);
        btn.classList.toggle('dark:bg-stone-800', !active);
        btn.classList.toggle('text-slate-600', !active);
        btn.classList.toggle('dark:text-stone-300', !active);
        btn.classList.toggle('border', !active);
        btn.classList.toggle('border-slate-200', !active);
        btn.classList.toggle('dark:border-stone-700', !active);
    });
}

function applySettingsTheme(mode) {
    const isDark = mode === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    storage.set('mada-theme', mode);
    refreshThemeUI();
}

// ============================================================
// INIT PAGE
// ============================================================
function initPage() {
    window._lastInitializedModule = 'parametres';
    if (document.getElementById('settings-name')?.dataset.bound) return;

    // Infos utilisateur connecté
    const user = api.getCurrentUser();
    if (user) {
        const avatar = document.getElementById('settings-avatar');
        if (avatar) avatar.textContent = (user.prenom[0] + user.nom[0]).toUpperCase();
        const name = document.getElementById('settings-name');
        if (name) name.textContent = `${user.prenom} ${user.nom}`;
        const mat = document.getElementById('settings-matricule');
        if (mat) mat.textContent = user.matricule;
        const role = document.getElementById('settings-role');
        if (role) role.textContent = settingsRoleLabel(user.role);
        const email = document.getElementById('settings-email');
        if (email) email.textContent = user.email || user.matricule;
    }

    // Thème
    refreshThemeUI();
    document.getElementById('btn-theme-light')?.addEventListener('click', () => applySettingsTheme('light'));
    document.getElementById('btn-theme-dark')?.addEventListener('click',  () => applySettingsTheme('dark'));

    // Marqueur anti double-attache
    const nameEl = document.getElementById('settings-name');
    if (nameEl) nameEl.dataset.bound = '1';

    // Sécurité : mot de passe
    const pwForm = document.getElementById('form-change-password');
    pwForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const current = document.getElementById('pw-current')?.value || '';
        const next    = document.getElementById('pw-new')?.value    || '';
        const confirm = document.getElementById('pw-confirm')?.value || '';

        if (next !== confirm) { flash('Les deux nouveaux mots de passe ne correspondent pas.', 'warning'); return; }
        if (next.length < 6)  { flash('Le nouveau mot de passe doit contenir au moins 6 caractères.', 'warning'); return; }

        const btn   = document.getElementById('btn-change-password');
        const label = document.getElementById('pw-btn-label');
        if (btn) btn.disabled = true;
        if (label) label.textContent = 'Mise à jour en cours…';
        const res = await api.changePassword(current, next);
        if (btn) btn.disabled = false;
        if (label) label.textContent = 'Mettre à jour le mot de passe';

        if (res.ok) { flash(res.message, 'success'); pwForm.reset(); }
        else        { flash(res.message, 'danger'); }
    });
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['parametres'] = initPage;
window.initPage = initPage;
})();