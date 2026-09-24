@echo off
REM ============================================================
REM  MADA Digital - Daemon R307 (surveillance capteur + lock COM)
REM  Double-clic pour demarrer la surveillance du capteur R307.
REM  La fenetre doit rester ouverte (le service tourne dedans).
REM ============================================================
cd /d "%~dp0"

REM Charge les variables du .env du projet (BORNE_TOKEN, R307_API_URL, ...)
if exist "..\.env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in ("..\.env") do (
        if not "%%A"=="" if not defined %%A set "%%A=%%B"
    )
)

REM Sans BORNE_TOKEN ou R307_API_URL : le daemon tourne mais la
REM surveillance continue est desactivee (message au lancement).
if "%BORNE_TOKEN%"=="" echo [AVERTISSEMENT] BORNE_TOKEN manquant dans .env — surveillance desactivee
if "%R307_API_URL%"=="" echo [AVERTISSEMENT] R307_API_URL manquant dans .env — surveillance desactivee

py r307_service.py --port auto --baud 57600
pause
