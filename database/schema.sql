-- Base de données : pointage_biometrique
CREATE DATABASE IF NOT EXISTS pointage_biometrique
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE pointage_biometrique;

CREATE TABLE IF NOT EXISTS users (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    matricule  VARCHAR(20)  NOT NULL UNIQUE,
    nom        VARCHAR(100) NOT NULL,
    prenom     VARCHAR(100) DEFAULT NULL,
    email      VARCHAR(150) DEFAULT NULL,
    role       ENUM('employe', 'admin') NOT NULL DEFAULT 'employe',
    password   VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pointages (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    date_pointage DATE NOT NULL,
    heure_entree  TIME NULL,
    heure_sortie  TIME NULL,
    UNIQUE KEY uniq_pointage (user_id, date_pointage),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS empreintes (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    template   LONGBLOB NOT NULL COMMENT 'Template biométrique chiffré',
    appareil   VARCHAR(100) DEFAULT NULL COMMENT 'Réf. du lecteur biométrique',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_empreinte (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
