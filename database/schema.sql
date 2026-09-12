-- ============================================================
-- BASE DE DONNÉES : POINTAGE BIOMÉTRIQUE (MADA DIGITAL)
-- Modèle relationnel complet pour PostgreSQL / Supabase
-- ============================================================

-- 1. DEPARTEMENTS
CREATE TABLE IF NOT EXISTS departements (
    id_departement SERIAL PRIMARY KEY,
    nom_departement VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

-- 2. EMPLOYES
CREATE TABLE IF NOT EXISTS employes (
    id_employe SERIAL PRIMARY KEY,
    matricule VARCHAR(20) NOT NULL UNIQUE,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE,
    telephone VARCHAR(30),
    id_departement INT REFERENCES departements(id_departement) ON DELETE SET NULL ON UPDATE CASCADE,
    poste VARCHAR(100) DEFAULT 'Employé',
    date_embauche DATE DEFAULT CURRENT_DATE,
    statut VARCHAR(20) NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'suspendu')),
    photo_profil VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_employes_departement ON employes(id_departement);
CREATE INDEX IF NOT EXISTS idx_employes_statut ON employes(statut);

-- 3. UTILISATEURS SYSTEME (ADMINISTRATEURS WEB)
CREATE TABLE IF NOT EXISTS utilisateurs_systeme (
    id_utilisateur SERIAL PRIMARY KEY,
    matricule VARCHAR(20) UNIQUE,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    telephone VARCHAR(30),
    id_departement INT REFERENCES departements(id_departement) ON DELETE SET NULL ON UPDATE CASCADE,
    mot_de_passe_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin_systeme', 'admin')),
    statut VARCHAR(20) NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif')),
    derniere_connexion TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON utilisateurs_systeme(email);
CREATE INDEX IF NOT EXISTS idx_users_matricule ON utilisateurs_systeme(matricule);

-- 4. APPAREILS DE POINTAGE
CREATE TABLE IF NOT EXISTS appareils_pointage (
    id_appareil SERIAL PRIMARY KEY,
    nom_appareil VARCHAR(100) NOT NULL,
    emplacement VARCHAR(150),
    type_capteur VARCHAR(30) NOT NULL CHECK (type_capteur IN ('empreinte', 'faciale', 'mixte')),
    adresse_ip VARCHAR(45),
    statut VARCHAR(20) NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'hors_ligne', 'maintenance')),
    derniere_connexion TIMESTAMPTZ
);

-- 5. DONNEES BIOMETRIQUES
CREATE TABLE IF NOT EXISTS donnees_biometriques (
    id_biometrie SERIAL PRIMARY KEY,
    id_employe INT NOT NULL REFERENCES employes(id_employe) ON DELETE CASCADE ON UPDATE CASCADE,
    type_biometrie VARCHAR(20) NOT NULL DEFAULT 'empreinte' CHECK (type_biometrie IN ('empreinte', 'visage')),
    gabarit_chiffre BYTEA NOT NULL, -- aligné schéma réel (gabarit UP_CHAR via decode(?,'hex'))
    algorithme VARCHAR(50) DEFAULT 'R307',
    id_appareil_enrolement INT REFERENCES appareils_pointage(id_appareil) ON DELETE SET NULL ON UPDATE CASCADE,
    date_enregistrement TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_expiration TIMESTAMPTZ,
    statut VARCHAR(20) NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'revoque'))
);

CREATE INDEX IF NOT EXISTS idx_biometrie_employe ON donnees_biometriques(id_employe);

-- 6. MAPPING SLOTS DISPOSITIF (APPAREILS BIOMÉTRIQUES)
CREATE TABLE IF NOT EXISTS biometric_slots (
    id SERIAL PRIMARY KEY,
    id_employe INT NOT NULL UNIQUE REFERENCES employes(id_employe) ON DELETE CASCADE ON UPDATE CASCADE,
    device_id VARCHAR(50) NOT NULL DEFAULT 'r307_main',
    slot_number SMALLINT NOT NULL CHECK (slot_number BETWEEN 0 AND 999),
    empreinte_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_device_slot UNIQUE (device_id, slot_number)
);

CREATE INDEX IF NOT EXISTS idx_slots_device ON biometric_slots(device_id, slot_number);

-- 7. HORAIRES DE TRAVAIL
CREATE TABLE IF NOT EXISTS horaires_travail (
    id_horaire SERIAL PRIMARY KEY,
    nom_horaire VARCHAR(100) NOT NULL,
    heure_debut TIME NOT NULL DEFAULT '08:30:00',
    heure_fin TIME NOT NULL DEFAULT '17:00:00',
    jours_travail VARCHAR(50) NOT NULL DEFAULT 'Lun-Sam',
    tolerance_retard_min INT NOT NULL DEFAULT 10
);

-- 8. AFFECTATIONS DES HORAIRES
CREATE TABLE IF NOT EXISTS affectations_horaire (
    id_affectation SERIAL PRIMARY KEY,
    id_employe INT NOT NULL REFERENCES employes(id_employe) ON DELETE CASCADE ON UPDATE CASCADE,
    id_horaire INT NOT NULL REFERENCES horaires_travail(id_horaire) ON DELETE RESTRICT ON UPDATE CASCADE,
    date_debut DATE NOT NULL DEFAULT CURRENT_DATE,
    date_fin DATE
);

-- 9. ABSENCES ET CONGES
CREATE TABLE IF NOT EXISTS absences_conges (
    id_absence SERIAL PRIMARY KEY,
    id_employe INT NOT NULL REFERENCES employes(id_employe) ON DELETE CASCADE ON UPDATE CASCADE,
    type_absence VARCHAR(50) NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    justificatif VARCHAR(255),
    statut_validation VARCHAR(20) NOT NULL DEFAULT 'en_attente' CHECK (statut_validation IN ('en_attente', 'approuve', 'rejete')),
    id_validateur INT REFERENCES utilisateurs_systeme(id_utilisateur) ON DELETE SET NULL ON UPDATE CASCADE
);

-- 10. JOURNAL D'AUDIT (IMMUABLE)
CREATE TABLE IF NOT EXISTS journal_audit (
    id_log SERIAL PRIMARY KEY,
    id_utilisateur INT REFERENCES utilisateurs_systeme(id_utilisateur) ON DELETE SET NULL ON UPDATE CASCADE,
    action VARCHAR(100) NOT NULL,
    table_concernee VARCHAR(50),
    id_enregistrement_concerne INT,
    details TEXT,
    slot_number SMALLINT,
    score DECIMAL(5,2),
    device_id VARCHAR(50),
    motif TEXT,
    date_heure TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_utilisateur ON journal_audit(id_utilisateur);
CREATE INDEX IF NOT EXISTS idx_audit_date ON journal_audit(date_heure);

-- 11. POINTAGES
CREATE TABLE IF NOT EXISTS pointages (
    id_pointage SERIAL PRIMARY KEY,
    id_uuid_local CHAR(36) NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
    id_employe INT NOT NULL REFERENCES employes(id_employe) ON DELETE RESTRICT ON UPDATE CASCADE,
    id_appareil INT REFERENCES appareils_pointage(id_appareil) ON DELETE SET NULL ON UPDATE CASCADE,
    type_pointage VARCHAR(20) NOT NULL CHECK (type_pointage IN ('entree', 'sortie', 'pause_debut', 'pause_fin')),
    date_heure TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    methode_verification VARCHAR(20) NOT NULL DEFAULT 'empreinte' CHECK (methode_verification IN ('empreinte', 'visage', 'manuel')),
    score_correspondance DECIMAL(5,2) CHECK (score_correspondance IS NULL OR (score_correspondance >= 0 AND score_correspondance <= 100)),
    source_donnee VARCHAR(20) NOT NULL DEFAULT 'serveur' CHECK (source_donnee IN ('serveur', 'local')),
    synchronise BOOLEAN NOT NULL DEFAULT TRUE,
    date_synchronisation TIMESTAMPTZ,
    statut VARCHAR(20) NOT NULL DEFAULT 'valide' CHECK (statut IN ('valide', 'rejete', 'anomalie')),
    commentaire TEXT
);

CREATE INDEX IF NOT EXISTS idx_pointages_employe ON pointages(id_employe);
CREATE INDEX IF NOT EXISTS idx_pointages_date ON pointages(date_heure);

-- 12. HISTORIQUE POINTAGES ARCHIVÉS
CREATE TABLE IF NOT EXISTS historique_pointages (
    LIKE pointages INCLUDING ALL,
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- FONCTION D'ARCHIVAGE AUTOMATIQUE
CREATE OR REPLACE FUNCTION archive_pointages()
RETURNS INTEGER AS $$
DECLARE
    moved INTEGER;
BEGIN
    INSERT INTO historique_pointages
    SELECT *, NOW() FROM pointages
    WHERE date_heure::date < CURRENT_DATE;

    GET DIAGNOSTICS moved = ROW_COUNT;
    DELETE FROM pointages WHERE date_heure::date < CURRENT_DATE;
    RETURN moved;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
