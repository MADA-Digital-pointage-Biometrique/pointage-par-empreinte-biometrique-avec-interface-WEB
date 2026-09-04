const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function buildPDF() {
    const pdfPath = path.join(__dirname, 'MADA_Digital_Guide_Technique_Architecture.pdf');
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Color Palette
    const primary = '#1E3A8A'; // Indigo Dark
    const secondary = '#2563EB'; // Blue
    const textDark = '#0F172A';
    const textMuted = '#475569';
    const bgLight = '#F8FAFC';

    // Page Header / Cover Title
    doc.fillColor(primary)
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('MADA DIGITAL - GUIDE TECHNIQUE & ARCHITECTURE', { align: 'center' });
    
    doc.moveDown(0.5);
    doc.fillColor(secondary)
        .fontSize(13)
        .font('Helvetica-Oblique')
        .text('Explications détaillées de la structure, des méthodes et des fonctions développées', { align: 'center' });

    doc.moveDown(1.5);
    doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1.5);

    // Helper Functions
    function addHeading1(title) {
        doc.moveDown(1);
        doc.fillColor(primary).fontSize(16).font('Helvetica-Bold').text(title);
        doc.moveDown(0.4);
        doc.strokeColor(secondary).lineWidth(2).moveTo(50, doc.y).lineTo(150, doc.y).stroke();
        doc.moveDown(0.6);
    }

    function addHeading2(title) {
        doc.moveDown(0.8);
        doc.fillColor(secondary).fontSize(12).font('Helvetica-Bold').text(title);
        doc.moveDown(0.3);
    }

    function addBody(text) {
        doc.fillColor(textDark).fontSize(10).font('Helvetica').text(text, { align: 'justify', lineGap: 3 });
        doc.moveDown(0.4);
    }

    function addCodeBlock(code) {
        doc.moveDown(0.3);
        const y = doc.y;
        doc.rect(50, y, 495, 0).fill(bgLight); // Background padding calculated
        doc.fillColor('#0F172A').fontSize(8.5).font('Courier').text(code, 60, y + 8, { lineGap: 2 });
        doc.moveDown(0.6);
    }

    // 1. Structure des Dossiers & Fichiers
    addHeading1('1. Arborescence & Position des Fichiers');
    addBody('L\'application MADA Digital repose sur une architecture moderne sans framework lourd, organisée de manière modulaire :');
    
    addCodeBlock(`
g:/projet/projet_Stage_MADA-Digital/
├── frontend/                     # Racine des pages de l'application client
│   ├── login.html                # Page de connexion réservée aux Administrateurs
│   ├── dashboard.html            # Tableau de bord principal (Vue globale & KPIs)
│   ├── employes.html             # Gestion du personnel et enrôlement biométrique
│   ├── pointage.html             # Terminal interactif de la borne biométrique
│   ├── historique.html           # Registre complet des horodatages et exports CSV
│   └── assets/
│       ├── css/
│       │   └── app.css           # Styles CSS globaux & effets glassmorphism
│       └── js/
│           ├── theme.js          # Gestion dynamique du mode Sombre / Clair (Dark/Light)
│           ├── data.js           # Base de données locale de démo (Seed & localStorage)
│           ├── api.js            # Méthodes d'authentification et requêtes API REST
│           ├── app.js            # Shell d'application (Sidebar, Topbar, Horloge, Notifications)
│           └── pages/
│               ├── dashboard.js  # Calculs statistiques & graphiques du tableau de bord
│               ├── employes.js   # Filtrage, modal d'ajout et enrôlement d'empreintes
│           ├── pointage.js   # Pointage biométrique (lecteur optique)
│               └── historique.js # Calculs des durées, filtres 30J et export CSV
    `);

    // 2. Horloge Temps Réel dans le Header
    addHeading1('2. Implémentation de l\'Horloge Temps Réel dans la Topbar');
    addBody('L\'horloge digitale affichée dans la barre de navigation supérieure (Topbar Header) est gérée dynamiquement par le script global app.js lors de l\'injection du shell.');
    
    addHeading2('Méthode étape par étape :');
    addBody('1. Lors de l\'appel de buildShell(), le composant topbar est injecté dans le DOM avec l\'élément d\'affichage <div id="topbar-clock">. ');
    addBody('2. La fonction updateClock() est exécutée immédiatement puis répétée toutes les 1000 millisecondes (1 seconde) via setInterval().');
    addBody('3. La date locale est formatée en français via toLocaleDateString() et l\'heure exacte via toTimeString().');

    addCodeBlock(`
// Extrait de frontend/assets/js/app.js (Gestion de l'horloge temps réel)
function startClock() {
    const clockEl = document.getElementById('topbar-clock');
    if (!clockEl) return;

    function update() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR', { 
            weekday: 'short', day: 'numeric', month: 'short' 
        });
        const timeStr = now.toTimeString().slice(0, 8); // Format "HH:MM:SS"
        
        clockEl.innerHTML = \`
            <span class="font-semibold text-slate-700 dark:text-slate-200">\${dateStr}</span>
            <span class="font-mono text-blue-600 dark:text-blue-400 font-bold ml-1">\${timeStr}</span>
        \`;
    }
    update();
    setInterval(update, 1000); // Mise à jour chaque seconde
}
    `);

    // 3. Shell d'Application Dynamique (App Shell)
    addHeading1('3. Méthode d\'Injection Automatique du App Shell');
    addBody('Pour éviter la duplication du code HTML des menus entre les pages, app.js détecte la présence de l\'attribut data-page sur la balise <body> et injecte automatiquement :');
    addBody('• La barre latérale (Sidebar) dans l\'élément #app-shell avec mise en évidence du menu actif.');
    addBody('• La barre supérieure (Topbar Header) dans l\'élément #topbar-slot avec recherche en direct et menus déroulants.');

    // 4. Sécurité & Séparation des Rôles
    addHeading1('4. Sécurité & Séparation Stricte entre Admin et Employé');
    addBody('Conformément aux spécifications :');
    addBody('• COMPTE_UTILISATEUR (Administrateurs Web) : Seuls Super Admin et Admin RH possèdent des mots de passe pour se connecter au Dashboard.');
    addBody('• EMPLOYE (Personnel) : Les employés n\'ont AUCUN mot de passe ni compte web. Ils effectuent leurs pointages exclusivement via le scan de leur empreinte sur la borne.');

    addCodeBlock(`
// Extrait de frontend/assets/js/api.js (Restriction d'accès aux Admins uniquement)
async login(matriculeOrEmail, password) {
    const db = loadDB();
    const user = db.users.find(u => 
        (u.email === matriculeOrEmail || u.matricule === matriculeOrEmail) && 
        u.password_hash === password
    );

    if (!user) return { ok: false, message: 'Identifiants incorrects.' };
    
    // Restriction stricte aux rôles administrateurs
    if (user.role !== 'super_admin' && user.role !== 'admin' && user.role !== 'admin_rh') {
        return { 
            ok: false, 
            message: 'Accès refusé. Les employés pointent exclusivement sur la borne biométrique.' 
        };
    }

    saveCurrentUser(user);
    return { ok: true, user };
}
    `);

    // 5. Notifications Toasts & Modales de Confirmation
    addHeading1('5. Message Boxes, Toasts & Modales de Confirmation');
    addBody('Les alertes natives du navigateur (alert, confirm) ont été remplacées par deux composants glassmorphism sur-mesure :');
    addBody('1. flash(message, type) : Génère des cartes de notification flottantes en haut à droite avec icônes animées et disparition automatique après 4.5s.');
    addBody('2. showConfirmModal({ title, message, type, onConfirm }) : Affiche une boîte de confirmation modale centrée avec des boutons interactifs pour valider les actions critiques (suppression, ré-enrôlement).');

    // Finalize PDF Document
    doc.end();
    stream.on('finish', () => {
        console.log('PDF generated successfully at:', pdfPath);
    });
}

buildPDF();
