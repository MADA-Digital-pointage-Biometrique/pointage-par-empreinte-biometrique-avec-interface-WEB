// ============================================================
// Contrôleur de la vue Connexion (mode mono-fichier index.html)
// ============================================================

function fillDemo(matricule, password) {
    const m = document.getElementById('matricule');
    const p = document.getElementById('password');
    if (m) m.value = matricule;
    if (p) {
        p.value = password;
        p.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const btn = document.getElementById('btn-submit');
    if (btn) btn.style.transform = 'scale(0.98)';
    setTimeout(() => { if (btn) btn.style.transform = ''; }, 150);
}

function initPage() {
    const form = document.getElementById('login-form');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';

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
            res = { ok: false, message: 'Erreur inattendue lors de la connexion.' };
        }

        if (btn) {
            btn.disabled = false;
            btn.classList.remove('opacity-70', 'pointer-events-none');
        }

        if (res.ok) {
            flash(`Bienvenue ${res.user.prenom} ${res.user.nom}`, 'success');
            buildShell();
            switchPage('dashboard');
        } else {
            flash(res.message, 'danger');
        }
    });
}

window.PAGE_MODULES = window.PAGE_MODULES || {};
window.PAGE_MODULES['login'] = initPage;
window.fillDemo = fillDemo;