@echo off
REM ============================================================
REM  Assemble le kit borne depuis les sources du depot (zero duplication).
REM  Sortie : dist\kit-borne\ (dossier pret a copier) + dist\kit-borne.zip
REM  A lancer depuis la racine du projet.
REM ============================================================
setlocal
cd /d "%~dp0\.."

if not exist "python\r307_service.py" (
    echo [ERREUR] Lancez depuis la racine du projet.
    exit /b 1
)

rmdir /s /q "dist\kit-borne" 2>nul
mkdir "dist\kit-borne\python" 2>nul

copy /y "python\r307_service.py"  "dist\kit-borne\python\" >nul
copy /y "python\r307_driver.py"   "dist\kit-borne\python\" >nul
copy /y "python\r307_cli.py"      "dist\kit-borne\python\" >nul
copy /y "python\requirements.txt" "dist\kit-borne\python\" >nul
copy /y "tools\borne-kit\start_borne.bat"    "dist\kit-borne\" >nul
copy /y "tools\borne-kit\.env.borne.example" "dist\kit-borne\" >nul
copy /y "tools\borne-kit\LISEZMOI.txt"        "dist\kit-borne\" >nul

pushd "dist"
powershell -NoProfile -Command "Compress-Archive -Force -Path 'kit-borne\*' -DestinationPath 'kit-borne.zip'"
popd
echo.
echo Kit pret : dist\kit-borne\  +  dist\kit-borne.zip
dir dist
