const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, ShadingType, BorderStyle } = require('docx');

// Colors Palette
const PRIMARY = "0F172A";    // Slate 900
const SECONDARY = "F46A21";  // MADA Orange
const ACCENT = "2563EB";     // Royal Blue
const TEXT_DARK = "1E293B";  // Slate 800
const TEXT_MUTED = "64748B"; // Slate 500
const BG_LIGHT = "F8FAFC";   // Slate 50
const BORDER_COLOR = "CBD5E1"; // Slate 300

function createTitle(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 150 },
        children: [
            new TextRun({
                text: text,
                bold: true,
                size: 40, // 20pt
                color: PRIMARY,
                font: "Segoe UI"
            })
        ]
    });
}

function createSubtitle(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 400 },
        children: [
            new TextRun({
                text: text,
                bold: true,
                italic: true,
                size: 24, // 12pt
                color: SECONDARY,
                font: "Segoe UI"
            })
        ]
    });
}

function createHeading1(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 150 },
        children: [
            new TextRun({
                text: text,
                bold: true,
                size: 28, // 14pt
                color: PRIMARY,
                font: "Segoe UI"
            })
        ]
    });
}

function createHeading2(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 250, after: 100 },
        children: [
            new TextRun({
                text: text,
                bold: true,
                size: 24, // 12pt
                color: SECONDARY,
                font: "Segoe UI"
            })
        ]
    });
}

function createParagraph(text, options = {}) {
    return new Paragraph({
        spacing: { before: 60, after: 120 },
        children: [
            new TextRun({
                text: text,
                bold: options.bold || false,
                italic: options.italic || false,
                size: 22, // 11pt
                color: options.color || TEXT_DARK,
                font: "Segoe UI"
            })
        ]
    });
}

function createBullet(text, boldPrefix = "") {
    const children = [];
    if (boldPrefix) {
        children.push(new TextRun({ text: boldPrefix + " ", bold: true, size: 22, color: PRIMARY, font: "Segoe UI" }));
    }
    children.push(new TextRun({ text: text, size: 22, color: TEXT_DARK, font: "Segoe UI" }));

    return new Paragraph({
        bullet: { level: 0 },
        spacing: { before: 40, after: 80 },
        children: children
    });
}

function createStyledTable(headers, rows) {
    const headerRow = new TableRow({
        tableHeader: true,
        children: headers.map(h => new TableCell({
            shading: { fill: PRIMARY, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            children: [new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 20, font: "Segoe UI" })]
            })]
        }))
    });

    const bodyRows = rows.map((r, i) => new TableRow({
        children: r.map(cellText => new TableCell({
            shading: { fill: i % 2 === 0 ? BG_LIGHT : "FFFFFF", type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 150, right: 150 },
            children: [new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: String(cellText), size: 20, color: TEXT_DARK, font: "Segoe UI" })]
            })]
        }))
    }));

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...bodyRows]
    });
}

async function buildDoc() {
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                // En-tête Document
                createTitle("RAPPORT HEBDOMADAIRE D'AVANCÉES & STRUCTURING TECHNIQUE"),
                createSubtitle("Projet MADA Digital — Système de Pointage Biométrique (30 Août - 04 Septembre 2026)"),

                // Meta Box
                createStyledTable(
                    ["Projet", "Développeur", "Version", "Base de Données", "Branche Principale"],
                    [
                        ["Pointage Biométrique MADA", "Alex Denis Adolphe", "v2.5 (PostgreSQL)", "Supabase Cloud (AWS Pooler)", "dbHeberger / PourElina"]
                    ]
                ),

                createParagraph(""),
                createHeading1("1. Synthèse Exécutive des Travaux de la Semaine"),
                createParagraph("Au cours de cette semaine de travail, le système de pointage biométrique MADA Digital a bénéficié d'une refonte majeure visant à industrialiser son architecture backend, renforcer sa sécurité globale et stabiliser les interactions entre le matériel biométrique (capteur R307) et la base de données hébergée sur Supabase."),
                
                createBullet("Migration complète du moteur de persistance local MySQL vers PostgreSQL (Supabase Cloud).", "Persistance Cloud :"),
                createBullet("Développement d'un pilote Python dédié pour le capteur biométrique R307 avec gestion des slots mémoires.", "Pilote Biométrique :"),
                createBullet("Mise en place d'une isolation stricte des privilèges (RBAC) et sécurisation anti-CSRF / injection.", "Sécurité & Profils :"),
                createBullet("Purge complète du code mort legacy MVC au profit d'une architecture API REST pure et SPA Javascript réactive.", "Architecture Clean :"),
                createBullet("Conception d'un système d'exportation CSV exécutif nativement compatible avec Microsoft Excel.", "Rapports & KPI :"),

                createHeading1("2. Migration & Harmonisation Base de Données (Supabase PostgreSQL)"),
                createParagraph("La base de données a été entièrement migrée vers l'instance cloud PostgreSQL de Supabase. Les requêtes SQL legacy spécifiques à MySQL ont été réécrites selon le standard PostgreSQL :"),

                createStyledTable(
                    ["Concept SQL", "Ancienne Syntaxe MySQL", "Nouvelle Syntaxe PostgreSQL (Supabase)", "Impact & Rôle"],
                    [
                        ["Clé Primaire Auto", "INT AUTO_INCREMENT", "SERIAL PRIMARY KEY", "Incrémentation automatique native PG"],
                        ["Identifiant Unique", "VARCHAR(36) UUID", "UUID DEFAULT gen_random_uuid()", "Génération d'UUIDs sécurisés"],
                        ["Gestion des Dates", "CURDATE() / NOW()", "CURRENT_DATE / CURRENT_TIMESTAMP", "Respect des fuseaux horaires (TIMESTAMPTZ)"],
                        ["Gabarit Biométrique", "LONGBLOB", "BYTEA / TEXT", "Stockage binaire chiffré des minuties"],
                        ["Archivage Auto", "Script PHP Cron externe", "Fonction PL/pgSQL archive_pointages()", "Exécution atomique en base sans surcharge PHP"]
                    ]
                ),

                createParagraph(""),
                createHeading2("2.1. Fonction d'Archivage PL/pgSQL"),
                createParagraph("Pour garantir des performances de lecture maximales sur la table des pointages du jour, une fonction d'archivage automatique a été intégrée dans PostgreSQL :"),
                createParagraph("CREATE OR REPLACE FUNCTION public.archive_pointages() RETURNS INTEGER AS $$\nDECLARE moved INTEGER;\nBEGIN\n  INSERT INTO public.historique_pointages SELECT *, NOW() FROM public.pointages WHERE date_heure::date < CURRENT_DATE;\n  GET DIAGNOSTICS moved = ROW_COUNT;\n  DELETE FROM public.pointages WHERE date_heure::date < CURRENT_DATE;\n  RETURN moved;\nEND; $$ LANGUAGE plpgsql SECURITY DEFINER;", { italic: true, color: ACCENT }),

                createHeading1("3. Intégration Matérielle Biométrique & Driver Python (R307)"),
                createParagraph("Le dialogue avec le capteur biométrique matériel R307 (USB-UART via CP2102 à 57600 bauds) a été entièrement fiabilisé."),

                createStyledTable(
                    ["Composant", "Fichier Source", "Rôle Technique & Fonctionnement"],
                    [
                        ["Driver Python", "python/r307_driver.py", "Gestion bas niveau des paquets UART, vérification du mot de passe capteur (0x00000000) et extraction des minuties."],
                        ["CLI Biométrique", "python/r307_cli.py", "Interface en ligne de commande appelée par le serveur PHP pour exécuter les commandes 'status', 'enroll', 'scan' et 'delete'."],
                        ["Mapping Slots", "table biometric_slots", "Association idempotente unique entre l'ID de l'employé (id_employe) et son emplacement mémoire physique sur le capteur (slot_number 0..999)."],
                        ["Détection d'État", "api/sensor_status.php", "Polling automatique en arrière-plan informant le frontend de l'état réel du capteur (Vert: En service / Rouge: HS ou Débranché)."],
                        ["Sécurité UI HS", "frontend/assets/js/pages/empreintes.js", "Désactivation automatique des boutons d'enrôlement et de changement de mode si le capteur biométrique n'est pas alimenté."]
                    ]
                ),

                createHeading1("4. Sécurité, RBAC et Durcissement du Code"),
                createParagraph("Plusieurs niveaux de sécurité ont été mis en œuvre pour protéger la plateforme contre les accès non autorisés et les fuites de données :"),

                createBullet("Tous les identifiants de connexion Supabase, tokens de bornes et clés secrètes ont été extraits du code et centralisés dans le fichier .env (ignoré par Git).", "Isolation des Secrets (.env) :"),
                createBullet("Mise en place d'un contrôle d'accès strict (RBAC) interdisant aux simples administrateurs la modification/suppression de pointages. Seuls les Super Administrateurs possèdent ces privilèges.", "Restriction des Privilèges (RBAC) :"),
                createBullet("Validation d'un jeton anti-CSRF dynamique sur l'ensemble des requêtes de modification (POST, PUT, DELETE).", "Protection Anti-CSRF :"),
                createBullet("Blocage strict par le fichier .htaccess de l'accès direct aux fichiers d'environnement (.env), schémas SQL (.sql), et fichiers de logs (.log).", "Protection Infrastructure (.htaccess) :"),

                createHeading1("5. Rapport Exécutif & Exportation CSV Haute Qualité"),
                createParagraph("L'outil d'exportation de l'historique de pointage a été réécrit pour générer des rapports professionnels nativement lisibles dans Microsoft Excel :"),

                createStyledTable(
                    ["Fonctionnalité CSV", "Spécification Technique", "Bénéfice Utilisateur / Métier"],
                    [
                        ["Encodage UTF-8 BOM", "\\uFEFF en-tête de fichier", "Ouverture directe sous Excel sans altération des caractères accentués français (ex: Présent, Général)."],
                        ["Séparateur Point-Virgule", "Délimiteur ';'", "Séparation automatique des cellules selon le standard régional français."],
                        ["En-tête Exécutif", "Bloc de 5 lignes de métadonnées", "Inclusion de la date, de l'heure d'extraction, du nom de l'administrateur et des filtres appliqués."],
                        ["Durée de Présence", "Calcul dynamique entrée/sortie", "Affichage automatique du temps de travail journalier (ex: 8h 30m)."],
                        ["Synthèse KPI Footer", "Bloc d'indicateurs de fin de page", "Présentation immédiate du volume total, des présences à l'heure, des retards et du taux de ponctualité global (%)."]
                    ]
                ),

                createHeading1("6. Gestion des Branches Git & Perspectives (Branche PourElina)"),
                createParagraph("Pour anticiper les évolutions matérielles futures (passage d'une connexion USB locale à un microcontrôleur autonome ESP32/Arduino via Wi-Fi/Ethernet), les travaux ont été organisés en branches Git :"),

                createBullet("Contient la version stable actuelle avec le driver Python local et la connexion PostgreSQL Supabase.", "Branche 'dbHeberger' (Principale) :"),
                createBullet("Branche dédiée contenant l'architecture découplée sans Python. Le microcontrôleur embarqué interroge directement les endpoints REST HTTP (api/borne_pointage.php et api/sensor_mode.php).", "Branche 'PourElina' (Évolutive) :"),

                createHeading1("7. Procédure d'Installation & Déploiement sur un Nouveau PC"),
                createParagraph("Si le projet est copié sur une nouvelle machine sous XAMPP, suivre les 3 étapes suivantes :"),
                createBullet("Copier le fichier .env à la racine du projet et vérifier la présence des clés de connexion Supabase.", "Étape 1 (.env) :"),
                createBullet("Dans le fichier C:\\xampp\\php\\php.ini, décommenter les lignes extension=pdo_pgsql, extension=pgsql et extension=openssl, puis redémarrer Apache.", "Étape 2 (Driver PHP) :"),
                createBullet("Visiter l'URL http://localhost/projet_Stage_MADA-Digital/api/health.php pour confirmer que le statut affiche 'healthy'.", "Étape 3 (Diagnostic) :")
            ]
        }]
    });

    const buffer = await Packer.toBuffer(doc);
    const outputPath = path.join(__dirname, 'Rapport_Hebdomadaire_MADA_Digital.docx');
    fs.writeFileSync(outputPath, buffer);
    console.log('Document Word généré avec succès à :', outputPath);
}

buildDoc().catch(err => console.error(err));
