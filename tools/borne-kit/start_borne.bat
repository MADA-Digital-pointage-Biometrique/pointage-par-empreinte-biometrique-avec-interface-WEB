@echo off
REM ============================================================
REM  MADA Digital - Borne R307 (kit autonome, sans le projet web)
REM  Double-clic pour demarrer. La fenetre DOIT rester ouverte.
REM  Pre-requis : Python 3.11 + "py -m pip install pyserial",
REM  capteur CP2102 branche, .env renseigne a cote de ce fichier.
REM ============================================================
cd /d "%~dp0"

REM Charge le .env LOCAL du kit (BORNE_TOKEN, R307_API_URL, ...)
if exist ".env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
        if not "%%A"=="" if not defined %%A set "%%A=%%B"
    )
) else (
    echo [ERREUR] Fichier .env introuvable. Copiez .env.borne.example en .env et renseignez-le.
    pause
    exit /b 1
)

if "%BORNE_TOKEN%"=="" echo [AVERTISSEMENT] BORNE_TOKEN manquant dans .env — surveillance desactivee
if "%R307_API_URL%"=="" echo [AVERTISSEMENT] R307_API_URL manquant dans .env — surveillance desactivee
if "%BORNE_TOKEN%"=="CHANGEZ-MOI-mettre-le-meme-que-le-serveur" echo [AVERTISSEMENT] BORNE_TOKEN par defaut — mettez celui du serveur, sinon 401 a chaque pointage

REM Interpreteur Python : "py" (launcher, install python.org) sinon "python".
where py >nul 2>nul
if %errorlevel%==0 ( set "PYBIN=py" ) else ( set "PYBIN=python" )
%PYBIN% -c "import sys,serial; print('pyserial OK', sys.version.split()[0])"
if %errorlevel% neq 0 (
    echo [ERREUR] Python 3.11 et/ou pyserial introuvables. Installez Python
    echo depuis python.org puis : %PYBIN% -m pip install pyserial
    pause
    exit /b 1
)

%PYBIN% python\r307_service.py --port auto --baud 57600
pause
