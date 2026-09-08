/* ── ANTI-FLASH : doit s'exécuter avant tout rendu (chargé en <head>, synchrone) ── */
(function() {
    document.documentElement.classList.add('page-loading');
    var saved = localStorage.getItem('mada-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (saved === null && prefersDark)) {
        document.documentElement.classList.add('dark');
    }
    function removeLoading() {
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                document.documentElement.classList.remove('page-loading');
            });
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', removeLoading);
    } else {
        removeLoading();
    }
    setTimeout(removeLoading, 300);
})();
