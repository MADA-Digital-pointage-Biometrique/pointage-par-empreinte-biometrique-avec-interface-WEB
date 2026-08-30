(function () {
// ============================================================
// Page : Paramètres (compte, apparence, préférences, données)
// Réutilise exclusivement le système de thème existant
// (classe .dark + clé storage 'mada-theme' + storage wrapper).
// ============================================================

function settingsRoleLabel(role) {
    return role === 'super_admin' ? 'Super Administrateur' : 'Administrateur RH';
}

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

// Applique le thème via le système existant (même clé + classe que toggleDarkMode)
function applySettingsTheme(mode) {
    const isDark = mode === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    storage.set('mada-theme', mode);
    refreshThemeUI();
}

function initPage() {
    window._lastInitializedModule = 'parametres';
    if (document.getElementById('settings-name')?.dataset.bound) return;

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

    refreshThemeUI();

    const btnLight = document.getElementById('btn-theme-light');
    if (btnLight) btnLight.addEventListener('click', () => applySettingsTheme('light'));
    const btnDark = document.getElementById('btn-theme-dark');
    if (btnDark) btnDark.addEventListener('click', () => applySettingsTheme('dark'));

    // Marqueur anti double-attache (mode mono-fichier : re-rendus possibles)
    const nameEl = document.getElementById('settings-name');
    if (nameEl) nameEl.dataset.bound = '1';

    // --- Sécurité : modification du mot de passe ---
    const pwForm = document.getElementById('form-change-password');
    pwForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const current = document.getElementById('pw-current')?.value || '';
        const next = document.getElementById('pw-new')?.value || '';
        const confirm = document.getElementById('pw-confirm')?.value || '';

        if (next !== confirm) {
            flash('Les deux nouveaux mots de passe ne correspondent pas.', 'warning');
            return;
        }
        if (next.length < 6) {
            flash('Le nouveau mot de passe doit contenir au moins 6 caractères.', 'warning');
            return;
        }

        const btn = document.getElementById('btn-change-password');
        const label = document.getElementById('pw-btn-label');
        if (btn) btn.disabled = true;
        if (label) label.textContent = 'Mise à jour en cours…';
        const res = await api.changePassword(current, next);
        if (btn) btn.disabled = false;
        if (label) label.textContent = 'Mettre à jour le mot de passe';

        if (res.ok) {
            flash(res.message, 'success');
            pwForm.reset();
        } else {
            flash(res.message, 'danger');
        }
    });

    const btnReset = document.getElementById('btn-reset-data');
    btnReset?.addEventListener('click', () => {
        showConfirmModal({
            title: 'Réinitialiser la base de démonstration ?',
            message: 'Tous les employés, pointages et la session seront supprimés. Les données d\'origine seront restaurées au prochain démarrage.',
            type: 'danger',
            confirmText: 'Oui, Réinitialiser',
            cancelText: 'Annuler',
            onConfirm: () => {
                resetDB();
                flash('Base de démonstration réinitialisée.', 'success');
                setTimeout(() => window.location.reload(), 900);
            }
        });
    });
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['parametres'] = initPage;
window.initPage = initPage;
})();