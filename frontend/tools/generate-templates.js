// ============================================================
// Générateur de templates SPA (compatibles file://)
// Extrait les vues des pages .html vers assets/js/templates.js
// Usage : node tools/generate-templates.js
// ============================================================
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pages = ['dashboard', 'employes', 'historique', 'pointage', 'parametres'];
const out = {};

function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

// Extrait un bloc HTML équilibré à partir de la première balise <div>
// (à partir de fromIndex) dont l'attribut satisfait le prédicat,
// jusqu'à sa balise fermante.
function extractBlock(html, predicate, fromIndex = 0) {
    const openRe = /<div\b[^>]*>/g;
    openRe.lastIndex = fromIndex;
    let m;
    while ((m = openRe.exec(html)) !== null) {
        const openIdx = m.index;
        if (!predicate(m[0])) continue;
        const scanRe = /<\/?div\b[^>]*>/g;
        scanRe.lastIndex = openIdx;
        let depth = 0;
        let closeIdx = -1;
        let s;
        while ((s = scanRe.exec(html)) !== null) {
            if (s[0].startsWith('</')) {
                depth--;
                if (depth === 0) { closeIdx = scanRe.lastIndex; break; }
            } else {
                depth++;
            }
        }
        if (closeIdx === -1) throw new Error('Bloc div non fermé');
        return html.slice(openIdx, closeIdx);
    }
    throw new Error('Bloc div introuvable');
}

// --- Vue login : carte d'authentification --------------------
out.login = extractBlock(read('login.html'), t => t.includes('max-w-[420px]'));

// --- Vues applicatives : contenu du <main> + toutes les modales ---
for (const p of pages) {
    const html = read(p + '.html');
    const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
    if (!main) throw new Error('Balise <main> introuvable dans ' + p + '.html');
    let t = main[1];

    // Modales (déclarées hors <main>, ex. modal-add, modal-enroll, modal-force-pointage)
    const modalRe = /<div\b[^>]*\bid="modal-[^"]*"[^>]*>/g;
    let m;
    while ((m = modalRe.exec(html)) !== null) {
        try {
            t += '\n' + extractBlock(html, tag => tag.includes('id="modal-'), m.index);
        } catch (e) {
            console.warn('Modale non extraite à la position ' + m.index + ' :', e.message);
        }
    }

    out[p] = t;
}

const banner = [
    '// ============================================================',
    '// PAGE_TEMPLATES - vues SPA intégrées (compatibles file://)',
    '// Auto-généré par tools/generate-templates.js - NE PAS ÉDITER À LA MAIN',
    '// Re-générer après modification d\'un fichier .html : node tools/generate-templates.js',
    '// ============================================================',
    ''
].join('\n');

const body = Object.entries(out)
    .map(([k, v]) => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(v))
    .join(',\n');

fs.writeFileSync(
    path.join(root, 'assets', 'js', 'templates.js'),
    banner + 'window.PAGE_TEMPLATES = {\n' + body + '\n};\n'
);

console.log('templates.js généré avec : ' + Object.keys(out).join(', '));