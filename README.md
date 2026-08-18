# Pointage biométrique — MADA Digital

Application de pointage (présence) des employés par **empreinte digitale**,
architecture **MVC** en PHP natif + **prototype frontend** statique.

## Prototype frontend (en cours de développement)

Le backend PHP est en stand-by : on se concentre d'abord sur le frontend.

- Dossier : `frontend/`
- **Aucune installation** : ouvrir `frontend/login.html` dans le navigateur,
  ou servir le dossier : `php -S localhost:8000 -t frontend`
- Données fictives stockées en `localStorage` (aucun serveur requis)
- Couche `frontend/assets/js/api.js` = **même API que le futur backend** :
  il suffira de remplacer chaque méthode par un `fetch()` vers les routes PHP

### Comptes de démonstration
| Matricule | Mot de passe | Rôle      |
|-----------|--------------|-----------|
| `ADM001`  | `admin123`   | Admin     |
| `EMP001`  | `emp123`     | Employé   |
| `EMP002`  | `emp123`     | Employé   |

### Pages
- `login.html` — connexion par matricule
- `dashboard.html` — statistiques (présents, retards, absents), pointage du jour, derniers pointages
- `pointage.html` — scan d'empreinte (simulé), pointage manuel de secours, historique 30 jours
- `employes.html` — liste des employés, ajout/suppression, enrôlement de l'empreinte (admin uniquement)

### Structure du frontend
```
frontend/
├── login.html / dashboard.html / pointage.html / employes.html
└── assets/
    ├── css/style.css
    └── js/
        ├── data.js                 # Données fictives (utilisateurs, pointages)
        ├── api.js                  # API simulée (à brancher sur le backend plus tard)
        ├── app.js                  # Shell partagé (sidebar, topbar, flash, modales)
        └── pages/                  # Logique par page
```

## Backend PHP MVC (préparé, à développer)

```
├── app/
│   ├── Core/                  # App, Router, Database, Model, Controller, Auth, Session, Config
│   │   └── Biometric/         # FingerprintReader, SimulatorReader, SdkReader, BiometricReader
│   ├── Controllers/           # Auth, Dashboard, Pointage, Biometric, User
│   ├── Models/                # User, Pointage, Empreinte
│   └── Views/                 # Templates PHP
├── config/                    # database.php, biometric.php
├── public/                    # Front controller + assets
├── routes/                    # web.php
└── database/                  # schema.sql + seed.php
```

Le schéma SQL prévoit la table `empreintes` (templates LONGBLOB) et le pointage
via lecteur (`config/biometric.php` choisit entre simulateur et SDK réel).

## Installation sur XAMPP

1. Copier le dossier dans `C:\xampp\htdocs\projet_Stage_MADA-Digital`.
2. Démarrer **Apache** et **MySQL** dans le panneau XAMPP.
3. Base de données :
   - Ouvrir `http://localhost/phpmyadmin`
   - Importer `database/schema.sql` (crée la base `pointage_biometrique`)
   - Créer l'admin : `php database/seed.php` (depuis le dossier du projet)
4. La config `config/database.php` (localhost / root / mot de passe vide) correspond
   aux valeurs par défaut de XAMPP.

### Accès
- Prototype frontend : `http://localhost/projet_Stage_MADA-Digital/frontend/login.html`
- Backend PHP (quand il sera actif) : `http://localhost/projet_Stage_MADA-Digital/public`