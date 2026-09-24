// ============================================================
// MadaAnim — animations de progression (count-up) pour KPI & graphiques
// ============================================================
// Principe : la valeur finale est DÉJÀ calculée par la logique existante
// (API + dashboard.js). Ce module est purement présentationnel : il part
// visuellement de 0 et anime jusqu'à la valeur réelle, puis S'ARRÊTE
// exactement dessus (ex. 75 % : 0 → 20 → 40 → 60 → 75).
// Aucune donnée, aucun calcul métier : uniquement de l'affichage.
// Respecte prefers-reduced-motion (affichage direct de la valeur finale).
(function () {
    // Une seule animation à la fois par élément (les re-rendus annulent l'ancienne)
    const running = new WeakMap();

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function formatValue(v, opts) {
        const dec = opts.decimals || 0;
        if (typeof opts.format === 'function') return opts.format(v);
        return dec > 0 ? v.toFixed(dec) : String(Math.round(v));
    }

    /**
     * Anime le textContent d'un élément de 0 vers `target`.
     * opts : { duration=550, prefix='', suffix='', decimals=0, format=fn }
     * PERF : 550ms (au lieu de 900ms) — la valeur finale est visible plus
     * tôt, l'effet count-up reste perceptible.
     */
    function animateNumber(el, target, opts = {}) {
        if (!el) return;
        target = Number(target) || 0;
        const dur = opts.duration !== undefined ? opts.duration : 550;
        const reduced = window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const render = (v) => {
            el.textContent = (opts.prefix || '') + formatValue(v, opts) + (opts.suffix || '');
        };

        // Re-rendu : annule l'animation précédente sur ce même élément
        const prev = running.get(el);
        if (prev) { try { prev(); } catch (e) {} running.delete(el); }

        if (reduced || dur <= 0 || !isFinite(target)) { render(target); return; }

        let raf = 0, start = 0, cancelled = false;
        const cancel = () => { cancelled = true; if (raf) cancelAnimationFrame(raf); };
        running.set(el, cancel);

        const step = (ts) => {
            if (cancelled) return;
            if (!start) start = ts;
            const t = Math.min(1, (ts - start) / dur);
            render(target * easeOutCubic(t));
            if (t < 1) {
                raf = requestAnimationFrame(step);
            } else {
                render(target); // arrêt EXACT à la valeur réelle
                running.delete(el);
            }
        };
        raf = requestAnimationFrame(step);
    }

    /**
     * Anime la hauteur des barres d'un conteneur de 0 % vers leur hauteur
     * cible (attribut data-h, en %). Purement CSSOM — compatible CSP
     * style-src sans unsafe-inline. La transition préserve la transition
     * de couleur au survol (transition-colors Tailwind).
     */
    function animateBars(container, selector = '[data-h]') {
        if (!container) return;
        const bars = container.querySelectorAll(selector);
        if (!bars.length) return;
        const reduced = window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) {
            bars.forEach(el => { el.style.height = el.dataset.h + '%'; });
            return;
        }
        bars.forEach(el => {
            el.style.height = '0%';
            el.style.transition = 'height 450ms cubic-bezier(0.22, 1, 0.36, 1), '
                + 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)';
        });
        // Double rAF : garantit que la hauteur 0 % est appliquée avant la cible
        requestAnimationFrame(() => requestAnimationFrame(() => {
            bars.forEach(el => { el.style.height = (el.dataset.h || 0) + '%'; });
        }));
    }

    window.MadaAnim = { animateNumber, animateBars };
})();
