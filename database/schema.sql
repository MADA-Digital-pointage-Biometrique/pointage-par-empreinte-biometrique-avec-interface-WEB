-- ============================================================
-- BASE DE DONNÉES : POINTAGE BIOMÉTRIQUE
-- Adaptation MySQL / MariaDB pour XAMPP
-- ============================================================

CREATE DATABASE IF NOT EXISTS pointage_biometrique
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE pointage_biometrique;


-- ============================================================
-- 1. DEPARTEMENTS
-- ============================================================

CREATE TABLE departements (
    id_departement INT AUTO_INCREMENT PRIMARY KEY,
    nom_departement VARCHAR(100) NOT NULL,
    description TEXT
) ENGINE=InnoDB;


-- ============================================================
-- 2. EMPLOYES
-- ============================================================

CREATE TABLE employes (
    id_employe INT AUTO_INCREMENT PRIMARY KEY,
    matricule VARCHAR(20) NOT NULL UNIQUE,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE,
    telephone VARCHAR(30),
    id_departement INT,
    poste VARCHAR(100),
    date_embauche DATE,
    statut VARCHAR(20) NOT NULL DEFAULT 'actif',
    photo_profil VARCHAR(255),

    CONSTRAINT fk_employe_departement
        FOREIGN KEY (id_departement)
        REFERENCES departements(id_departement)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT chk_employe_statut
        CHECK (statut IN ('actif', 'inactif', 'suspendu'))
) ENGINE=InnoDB;

CREATE INDEX idx_employes_departement
ON employes(id_departement);

CREATE INDEX idx_employes_statut
ON employes(statut);


-- ============================================================
-- 3. APPAREILS DE POINTAGE
-- ============================================================

CREATE TABLE appareils_pointage (
    id_appareil INT AUTO_INCREMENT PRIMARY KEY,
    nom_appareil VARCHAR(100) NOT NULL,
    emplacement VARCHAR(150),
    type_capteur VARCHAR(30) NOT NULL,
    adresse_ip VARCHAR(45),
    statut VARCHAR(20) NOT NULL DEFAULT 'actif',
    derniere_connexion DATETIME,

    CONSTRAINT chk_appareil_type
        CHECK (type_capteur IN ('empreinte', 'faciale', 'mixte')),

    CONSTRAINT chk_appareil_statut
        CHECK (statut IN ('actif', 'hors_ligne', 'maintenance'))
) ENGINE=InnoDB;


-- ============================================================
-- 4. DONNEES BIOMETRIQUES
-- ============================================================

CREATE TABLE donnees_biometriques (
    id_biometrie INT AUTO_INCREMENT PRIMARY KEY,
    id_employe INT NOT NULL,
    type_biometrie VARCHAR(20) NOT NULL,
    gabarit_chiffre BLOB NOT NULL,
    algorithme VARCHAR(50),
    id_appareil_enrolement INT,
    date_enregistrement DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_expiration DATETIME,
    statut VARCHAR(20) NOT NULL DEFAULT 'actif',

    CONSTRAINT fk_biometrie_employe
        FOREIGN KEY (id_employe)
        REFERENCES employes(id_employe)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_biometrie_appareil
        FOREIGN KEY (id_appareil_enrolement)
        REFERENCES appareils_pointage(id_appareil)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT chk_biometrie_type
        CHECK (type_biometrie IN ('empreinte', 'visage')),

    CONSTRAINT chk_biometrie_statut
        CHECK (statut IN ('actif', 'revoque'))
) ENGINE=InnoDB;

CREATE INDEX idx_biometrie_employe
ON donnees_biometriques(id_employe);

CREATE INDEX idx_biometrie_type
ON donnees_biometriques(type_biometrie);


-- ============================================================
-- 5. HORAIRES DE TRAVAIL
-- ============================================================

CREATE TABLE horaires_travail (
    id_horaire INT AUTO_INCREMENT PRIMARY KEY,
    nom_horaire VARCHAR(100) NOT NULL,
    heure_debut TIME NOT NULL,
    heure_fin TIME NOT NULL,
    jours_travail VARCHAR(50) NOT NULL,
    tolerance_retard_min INT NOT NULL DEFAULT 10
) ENGINE=InnoDB;


-- ============================================================
-- 6. AFFECTATIONS DES HORAIRES
-- ============================================================

CREATE TABLE affectations_horaire (
    id_affectation INT AUTO_INCREMENT PRIMARY KEY,
    id_employe INT NOT NULL,
    id_horaire INT NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE,

    CONSTRAINT fk_affectation_employe
        FOREIGN KEY (id_employe)
        REFERENCES employes(id_employe)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_affectation_horaire
        FOREIGN KEY (id_horaire)
        REFERENCES horaires_travail(id_horaire)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_affectation_employe
ON affectations_horaire(id_employe);

CREATE INDEX idx_affectation_horaire
ON affectations_horaire(id_horaire);


-- ============================================================
-- 7. UTILISATEURS SYSTEME
-- ============================================================

CREATE TABLE utilisateurs_systeme (
    id_utilisateur INT AUTO_INCREMENT PRIMARY KEY,
    id_employe INT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    mot_de_passe_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    statut VARCHAR(20) NOT NULL DEFAULT 'actif',
    derniere_connexion DATETIME,

    CONSTRAINT fk_utilisateur_employe
        FOREIGN KEY (id_employe)
        REFERENCES employes(id_employe)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT chk_utilisateur_role
        CHECK (role IN ('admin_systeme', 'admin')),

    CONSTRAINT chk_utilisateur_statut
        CHECK (statut IN ('actif', 'inactif'))
) ENGINE=InnoDB;


-- ============================================================
-- 8. ABSENCES ET CONGES
-- ============================================================

CREATE TABLE absences_conges (
    id_absence INT AUTO_INCREMENT PRIMARY KEY,
    id_employe INT NOT NULL,
    type_absence VARCHAR(50) NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    justificatif VARCHAR(255),
    statut_validation VARCHAR(20) NOT NULL DEFAULT 'en_attente',
    id_validateur INT NULL,

    CONSTRAINT fk_absence_employe
        FOREIGN KEY (id_employe)
        REFERENCES employes(id_employe)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_absence_validateur
        FOREIGN KEY (id_validateur)
        REFERENCES utilisateurs_systeme(id_utilisateur)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT chk_absence_statut
        CHECK (
            statut_validation IN (
                'en_attente',
                'approuve',
                'rejete'
            )
        )
) ENGINE=InnoDB;

CREATE INDEX idx_absences_employe
ON absences_conges(id_employe);


-- ============================================================
-- 9. JOURNAL D'AUDIT
-- ============================================================

CREATE TABLE journal_audit (
    id_log INT AUTO_INCREMENT PRIMARY KEY,
    id_utilisateur INT NULL,
    action VARCHAR(100) NOT NULL,
    table_concernee VARCHAR(50),
    id_enregistrement_concerne INT,
    details TEXT,
    date_heure DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_utilisateur
        FOREIGN KEY (id_utilisateur)
        REFERENCES utilisateurs_systeme(id_utilisateur)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_audit_utilisateur
ON journal_audit(id_utilisateur);

CREATE INDEX idx_audit_date
ON journal_audit(date_heure);


-- ============================================================
-- 10. GABARITS / APPAREILS / SLOTS
-- ============================================================

CREATE TABLE gabarits_appareils (
    id_gabarit_appareil INT AUTO_INCREMENT PRIMARY KEY,
    id_biometrie INT NOT NULL,
    id_appareil INT NOT NULL,
    numero_slot INT NOT NULL,
    date_transfert DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    statut VARCHAR(20) NOT NULL DEFAULT 'actif',

    CONSTRAINT fk_gabarit_appareil_biometrie
        FOREIGN KEY (id_biometrie)
        REFERENCES donnees_biometriques(id_biometrie)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_gabarit_appareil_appareil
        FOREIGN KEY (id_appareil)
        REFERENCES appareils_pointage(id_appareil)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT uq_appareil_slot
        UNIQUE (id_appareil, numero_slot),

    CONSTRAINT chk_numero_slot
        CHECK (numero_slot BETWEEN 0 AND 999),

    CONSTRAINT chk_gabarit_statut
        CHECK (
            statut IN (
                'actif',
                'a_retirer',
                'retire'
            )
        )
) ENGINE=InnoDB;

CREATE INDEX idx_gabarits_biometrie
ON gabarits_appareils(id_biometrie);

CREATE INDEX idx_gabarits_appareil
ON gabarits_appareils(id_appareil);


-- ============================================================
-- 11. POINTAGES
-- ============================================================

CREATE TABLE pointages (
    id_pointage INT AUTO_INCREMENT PRIMARY KEY,

    -- UUID généré par le microcontrôleur
    -- Sert à empêcher les doublons lors de la synchronisation
    id_uuid_local CHAR(36) NOT NULL UNIQUE,

    id_employe INT NOT NULL,
    id_appareil INT NULL,

    type_pointage VARCHAR(20) NOT NULL,

    -- Heure réelle de capture fournie par le RTC
    date_heure DATETIME NOT NULL,

    methode_verification VARCHAR(20) NOT NULL,

    score_correspondance DECIMAL(5,2),

    source_donnee VARCHAR(20) NOT NULL DEFAULT 'serveur',

    synchronise BOOLEAN NOT NULL DEFAULT TRUE,

    date_synchronisation DATETIME NULL,

    statut VARCHAR(20) NOT NULL DEFAULT 'valide',

    commentaire TEXT,

    CONSTRAINT fk_pointage_employe
        FOREIGN KEY (id_employe)
        REFERENCES employes(id_employe)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_pointage_appareil
        FOREIGN KEY (id_appareil)
        REFERENCES appareils_pointage(id_appareil)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT chk_pointage_type
        CHECK (
            type_pointage IN (
                'entree',
                'sortie',
                'pause_debut',
                'pause_fin'
            )
        ),

    CONSTRAINT chk_pointage_methode
        CHECK (
            methode_verification IN (
                'empreinte',
                'visage',
                'manuel'
            )
        ),

    CONSTRAINT chk_pointage_score
        CHECK (
            score_correspondance IS NULL
            OR (
                score_correspondance >= 0
                AND score_correspondance <= 100
            )
        ),

    CONSTRAINT chk_pointage_source
        CHECK (
            source_donnee IN (
                'serveur',
                'local'
            )
        ),

    CONSTRAINT chk_pointage_statut
        CHECK (
            statut IN (
                'valide',
                'rejete',
                'anomalie'
            )
        )
) ENGINE=InnoDB;

CREATE INDEX idx_pointages_employe
ON pointages(id_employe);

CREATE INDEX idx_pointages_date
ON pointages(date_heure);

CREATE INDEX idx_pointages_statut
ON pointages(statut);

CREATE INDEX idx_pointages_synchronise
ON pointages(synchronise);
