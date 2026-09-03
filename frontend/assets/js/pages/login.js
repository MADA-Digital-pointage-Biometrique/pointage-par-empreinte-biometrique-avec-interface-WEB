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
        if (btn) {
            btn.disabled = true;
            btn.classList.add('opacity-70', 'pointer-events-none');
        }

        let res;
        try {
            res = await api.login(matricule, password);
        } catch (err) {
            console.error('Login error:', err);
            res = { ok: false, message: 'Erreur réseau : ' + err.message };
        }

        if (btn) {
            btn.disabled = false;
            btn.classList.remove('opacity-70', 'pointer-events-none');
        }

        if (res.ok) {
            flash(`Bienvenue ${res.user.prenom} ${res.user.nom}`, 'success');
            // Vérifie que la session est bien active côté serveur avant de rediriger
            let ok = false;
            for (let i = 0; i < 3; i++) {
                await new Promise(r => setTimeout(r, 400));
                try {
                    const v = await api.verifyAuth();
                    if (v) { ok = true; break; }
                } catch {}
            }
            if (!ok) {
                // Session pas encore prête, on force quand même le dashboard qui vérifiera
                console.warn('verifyAuth non prêt, redirection dashboard quand même');
            }
            if (typeof SINGLE_FILE_MODE !== 'undefined' && SINGLE_FILE_MODE) {
                buildShell();
                switchPage('dashboard');
            } else {
                window.location.replace('dashboard.php?v=' + Date.now());
            }
        } else {
            flash(res.message, 'danger');
        }
    });
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['login'] = initPage;