const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, ShadingType } = require('docx');

// Helper for styled headings
function createTitle(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
        children: [
            new TextRun({
                text: text,
                bold: true,
                size: 44, // 22pt
                color: "1E3A8A",
                font: "Segoe UI"
            })
        ]
    });
}

function createSubtitle(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 600 },
        children: [
            new TextRun({
                text: text,
                italic: true,
                size: 24, // 12pt
                color: "475569",
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
                size: 32, // 16pt
                color: "0F172A",
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
                size: 26, // 13pt
                color: "2563EB",
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
                color: options.color || "334155",
                font: "Segoe UI"
            })
        ]
    });
}

function createBullet(text, boldPrefix = "") {
    const children = [];
    if (boldPrefix) {
        children.push(new TextRun({ text: boldPrefix + " ", bold: true, size: 22, color: "0F172A", font: "Segoe UI" }));
    }
    children.push(new TextRun({ text: text, size: 22, color: "334155", font: "Segoe UI" }));

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
            shading: { fill: "1E293B", type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            children: [new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 20, font: "Segoe UI" })]
            })]
        }))
    });

    const bodyRows = rows.map((r, i) => new TableRow({
        children: r.map(cellText => new TableCell({
            shading: { fill: i % 2 === 0 ? "F8FAFC" : "FFFFFF", type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 150, right: 150 },
            children: [new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: String(cellText), size: 20, color: "334155", font: "Segoe UI" })]
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
                createTitle("MADA DIGITAL - BIOMÉTRIQUE"),
                createSubtitle("Dossier de Conception Technique Rectifié : Distinctions Stricte entre COMPTE_UTILISATEUR et EMPLOYE"),

                createParagraph("Document de spécifications fonctionnelles et techniques rectifié conformément à la séparation stricte entre les Administrateurs Système (COMPTE_UTILISATEUR) et l'Effectif soumis au pointage biométrique (EMPLOYE)."),

                // 1. Dictionnaire de données
                createHeading1("1. Dictionnaire de Données Rectifié"),
                createParagraph("Le dictionnaire distingue désormais deux entités distinctes : les Comptes Utilisateurs Web (Administrateurs) et les Fiches Employés (Pointage Biométrique)."),

                createHeading2("1.1. Table : COMPTE_UTILISATEUR (Comptes Administration Web)"),
                createParagraph("Représente les administrateurs (Super Admin & Admin RH) autorisés à se connecter au tableau de bord."),
                createStyledTable(
                    ["Champ", "Type de donnée", "Taille", "Nul", "Clé", "Description"],
                    [
                        ["id_user", "INT", "11", "Non", "PK", "Identifiant unique de l'administrateur"],
                        ["email", "VARCHAR", "150", "Non", "Unique", "Email de connexion à l'interface administrative"],
                        ["password_hash", "VARCHAR", "255", "Non", "-", "Mot de passe sécurisé (BCrypt / Argon2)"],
                        ["nom", "VARCHAR", "100", "Non", "-", "Nom de l'administrateur"],
                        ["prenom", "VARCHAR", "100", "Non", "-", "Prénom de l'administrateur"],
                        ["role", "ENUM", "'super_admin','admin_rh'", "Non", "-", "Rôle et niveau d'habilitation web"],
                        ["statut_compte", "ENUM", "'actif','inactif'", "Non", "-", "État d'activité du compte d'accès"],
                        ["created_at", "DATETIME", "-", "Non", "-", "Date de création du compte administrateur"]
                    ]
                ),

                createParagraph(""),
                createHeading2("1.2. Table : EMPLOYE (Personnel soumis au pointage biométrique)"),
                createParagraph("Représente l'ensemble des employés enregistrés dans l'effectif. Ils n'ont AUCUN compte ni mot de passe web."),
                createStyledTable(
                    ["Champ", "Type de donnée", "Taille", "Nul", "Clé", "Description"],
                    [
                        ["id_employe", "INT", "11", "Non", "PK", "Identifiant interne de l'employé"],
                        ["matricule", "VARCHAR", "20", "Non", "Unique", "Matricule agent unique (ex: EMP001)"],
                        ["nom", "VARCHAR", "100", "Non", "-", "Nom de famille de l'employé"],
                        ["prenom", "VARCHAR", "100", "Non", "-", "Prénom de l'employé"],
                        ["departement", "VARCHAR", "100", "Oui", "-", "Département ou service d'affectation"],
                        ["poste", "VARCHAR", "100", "Oui", "-", "Fonction / Poste occupé"],
                        ["empreinte_template", "LONGBLOB", "-", "Oui", "-", "Modèle minuties binaire de l'empreinte digitale"],
                        ["statut_enrolement", "BOOLEAN", "-", "Non", "-", "Indique si l'empreinte est enrôlée (1/0)"],
                        ["created_by_user_id", "INT", "11", "Non", "FK", "Référence à l'admin créateur (compte_utilisateur.id_user)"],
                        ["created_at", "DATETIME", "-", "Non", "-", "Date d'intégration dans l'effectif"]
                    ]
                ),

                createParagraph(""),
                createHeading2("1.3. Table : POINTAGE (Registre des Horodatages Biométriques)"),
                createParagraph("Stocke les événements de présence scannés sur la borne biométrique."),
                createStyledTable(
                    ["Champ", "Type de donnée", "Taille", "Nul", "Clé", "Description"],
                    [
                        ["id_pointage", "INT", "11", "Non", "PK", "Identifiant unique de l'horodatage"],
                        ["employe_id", "INT", "11", "Non", "FK", "Référence à l'employé scanné (employe.id_employe)"],
                        ["date_pointage", "DATE", "-", "Non", "-", "Date du jour de la présence (YYYY-MM-DD)"],
                        ["heure_entree", "TIME", "-", "Non", "-", "Heure de scan de l'entrée (HH:MM:SS)"],
                        ["heure_sortie", "TIME", "-", "Oui", "-", "Heure de scan de la sortie (HH:MM:SS)"],
                        ["statut", "ENUM", "'present','retard','encours'", "Non", "-", "Statut calculé automatiquement selon l'horaire"],
                        ["created_at", "TIMESTAMP", "-", "Non", "-", "Horodatage système de la transaction"]
                    ]
                ),

                // 2. MCD Rectifié
                createHeading1("2. Modèle Conceptuel des Données Rectifié (MCD)"),
                createParagraph("Le MCD reflète désormais l'étanchéité entre la gestion administrative et le pointage du personnel."),

                createHeading2("2.1. Entités du Système"),
                createBullet("Attributs : id_user (PK), email (UK), password_hash, nom, prenom, role, statut_compte", "COMPTE_UTILISATEUR :"),
                createBullet("Attributs : id_employe (PK), matricule (UK), nom, prenom, departement, poste, empreinte_template, statut_enrolement", "EMPLOYE :"),
                createBullet("Attributs : id_pointage (PK), date_pointage, heure_entree, heure_sortie, statut", "POINTAGE :"),

                createHeading2("2.2. Associations & Cardinalités"),
                createBullet("Un EMPLOYE effectue 0 à plusieurs (0,N) POINTAGEs. Un POINTAGE concerne 1 et 1 seul (1,1) EMPLOYE.", "Association EFFECTUER (EMPLOYE 0,N <---> 1,1 POINTAGE) :"),
                createBullet("Un COMPTE_UTILISATEUR (Admin) gère / enregistre 0 à plusieurs (0,N) EMPLOYE. Un EMPLOYE est enregistré par 1 (1,1) COMPTE_UTILISATEUR.", "Association GERER (COMPTE_UTILISATEUR 0,N <---> 1,1 EMPLOYE) :"),
                createBullet("Un COMPTE_UTILISATEUR peut forcer manuellement 0 à plusieurs (0,N) POINTAGEs en cas de régularisation.", "Association REGULARISER (COMPTE_UTILISATEUR 0,N <---> 0,1 POINTAGE) :"),

                // 3. MLD Rectifié
                createHeading1("3. Modèle Logique des Données Rectifié (MLD - 3FN)"),
                createBullet("id_user (PK), email (UK), password_hash, nom, prenom, role, statut_compte, created_at", "COMPTE_UTILISATEUR :"),
                createBullet("id_employe (PK), matricule (UK), nom, prenom, departement, poste, empreinte_template, statut_enrolement, #created_by_user_id (FK -> COMPTE_UTILISATEUR.id_user)", "EMPLOYE :"),
                createBullet("id_pointage (PK), #employe_id (FK -> EMPLOYE.id_employe), date_pointage, heure_entree, heure_sortie, statut, #forced_by_user_id (FK -> COMPTE_UTILISATEUR.id_user Nullable)", "POINTAGE :"),

                // 4. Règles de Gestion & Traitement Rectifiées
                createHeading1("4. Règles de Gestion (RG) & Traitement Rectifiées"),
                createBullet("L'accès au Dashboard et au Shell d'administration nécessite un compte dans la table COMPTE_UTILISATEUR (rôles super_admin ou admin_rh).", "RG01 - Séparation des Accès Web :"),
                createBullet("Les individus de la table EMPLOYE sont strictement des agents physiques soumis au pointage biométrique. Ils n'ont AUCUN login ni mot de passe web.", "RG02 - Fiches Employés sans Compte Web :"),
                createBullet("Le terminal biométrique interroge uniquement la table EMPLOYE et vérifie l'empreinte binaire. Les administrateurs de COMPTE_UTILISATEUR ne pointent pas sur la borne.", "RG03 - Exclusivité de la Borne Biométrique :"),
                createBullet("Toute heure d'entrée enregistrée dans la table POINTAGE après l'heure légale (ex: 09h00) reçoit automatiquement le statut 'Retard'.", "RG04 - Calcul Automatique des Présences :"),
                createBullet("Un premier scan crée l'événement d'Entrée. Un second scan au cours de la même journée renseigne l'heure de Sortie pour l'employé.", "RG05 - Cycle d'Horodatage Quotidien :"),
                createBullet("Tout ajout, modification d'employé ou forçage manuel de pointage effectué par un COMPTE_UTILISATEUR est tracé avec l'identifiant de l'administrateur responsable.", "RG06 - Traçabilité Administrative :")
            ]
        }]
    });

    const buffer = await Packer.toBuffer(doc);
    const outputPath = path.join(__dirname, 'MADA_Digital_Documentation_Technique.docx');
    fs.writeFileSync(outputPath, buffer);
    console.log('DOCX rectifié généré à :', outputPath);
}

buildDoc().catch(err => console.error(err));
