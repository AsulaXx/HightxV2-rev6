@echo off
REM ================================================================
REM Clean Firestore (Windows)
REM ================================================================
REM Usage:
REM   clean-firestore.bat           - Dry-run (only shows counts)
REM   clean-firestore.bat --yes     - Actually delete data
REM
REM Requires: service-account.json in project root
REM ================================================================

setlocal
cd /d "%~dp0.."

if not exist "service-account.json" (
  echo [X] service-account.json not found in project root.
  echo     Download from Firebase Console ^> Project Settings ^> Service Accounts
  exit /b 1
)

echo.
echo === Firestore Cleaner ===
if "%1"=="--yes" (
  echo Mode: DELETE
) else (
  echo Mode: DRY-RUN  ^(add --yes to actually delete^)
)
echo.

node scripts/clean-firestore.mjs %*

endlocal
