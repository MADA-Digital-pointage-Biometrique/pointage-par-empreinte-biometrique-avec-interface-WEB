// ============================================================
// Contrôleur de la vue Connexion (mode mono-fichier index.html)
// ============================================================

function initPage() {
    const form = document.getElementById('login-form');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';

    document.getElementById('btn-login-theme')?.addEventListener('click', () => toggleDarkMode());

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const matricule = (document.getElementById('matricule')?.value || '').trim().toUpperCase();
        const password = document.getElementById('password')?.value || '';

        const btn = document.getElementById('btn-submit');
        let btnOriginal = null;
        const setLoading = (on) => {
            if (!btn) return;
            if (on) {
                if (btnOriginal === null) btnOriginal = btn.innerHTML;
                btn.disabled = true;
                btn.classList.add('opacity-70', 'pointer-events-none');
                btn.innerHTML = '<span class="btn-spinner"></span>Connexion en cours…';
            } else {
                btn.disabled = false;
                btn.classList.remove('opacity-70', 'pointer-events-none');
                if (btnOriginal !== null) btn.innerHTML = btnOriginal;
            }
        };
        setLoading(true);

        let res;
        try {
            res = await api.login(matricule, password);
        } catch (err) {
            console.error('Login error:', err);
            res = { ok: false, message: 'Erreur réseau : ' + err.message };
        }

        // Le spinner reste jusqu'à la redirection ; restauré uniquement en échec.
        if (res.ok) {
            flash(`Bienvenue ${res.user.prenom} ${res.user.nom}`, 'success');
            // Vérifie que la session est bien active côté serveur avant de rediriger
            let ok = false;
            for (let i = 0; i < 5; i++) {
                await new Promise(r => setTimeout(r, 300));
                try {
                    const v = await api.verifyAuth();
                    if (v) { ok = true; break; }
                } catch {}
            }
            if (!ok) {
                // Session pas encore prête -> on attend un peu plus et on réessaie
                console.warn('Session non prête après login, attente supplémentaire...');
                await new Promise(r => setTimeout(r, 1000));
                try {
                    const v = await api.verifyAuth();
                    if (!v) {
                        flash('Session non établie, veuillez réessayer.', 'warning');
                        setLoading(false);
                        return;
                    }
                } catch {}
            }
            if (typeof SINGLE_FILE_MODE !== 'undefined' && SINGLE_FILE_MODE) {
                buildShell();
                switchPage('dashboard');
            } else {
                window.location.replace('dashboard.php?v=' + Date.now());
            }
        } else {
            setLoading(false);
            flash(res.message, 'danger');
        }
    });
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['login'] = initPage;