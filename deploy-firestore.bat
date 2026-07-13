@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo ============================================
echo  Firebase Hosting Auto Deploy
echo ============================================
echo.

REM [1/5] Check Node.js
echo [1/5] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo [X] Node.js not found. Please install Node.js first: https://nodejs.org
    pause
    exit /b 1
)
node -v

echo.
REM [2/5] Install project dependencies
echo [2/5] Running npm install...
call npm install
if errorlevel 1 (
    echo [X] npm install failed.
    pause
    exit /b 1
)

echo.
REM [3/5] Check Firebase CLI
echo [3/5] Checking Firebase CLI...
where firebase >nul 2>nul
if errorlevel 1 (
    echo [!] Firebase CLI not found. Installing globally via npm...
    call npm install -g firebase-tools
    if errorlevel 1 (
        echo [X] Failed to install Firebase CLI.
        pause
        exit /b 1
    )
)

echo.
REM [4/5] Login + select project
echo [4/5] Checking Firebase login...
call firebase login:list >nul 2>nul
if errorlevel 1 (
    echo [!] Not logged in. Opening login...
    call firebase login
)

echo.
echo Available Firebase projects:
echo --------------------------------------------
call firebase projects:list
echo --------------------------------------------
echo.
set /p PROJECT_ID=Enter the Firebase Project ID to deploy to: 
if "!PROJECT_ID!"=="" (
    echo [X] No project ID provided.
    pause
    exit /b 1
)

call firebase use !PROJECT_ID!
if errorlevel 1 (
    echo [X] Failed to select project !PROJECT_ID!.
    pause
    exit /b 1
)

echo.
REM [5/5] Build + deploy hosting only
echo [5/5] Deploying Firestore Rules + Indexes...
echo Building production files...
call npm run build
if errorlevel 1 (
    echo [X] Build failed. Please review the output above.
    pause
    exit /b 1
)

echo Deploying Hosting only...
call firebase deploy --only hosting --project !PROJECT_ID!
if errorlevel 1 (
    echo.
    echo [X] Deploy failed. Please review the output above.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  [OK] Deploy completed successfully!
echo  Project: !PROJECT_ID!
echo  Target: Hosting only
echo ============================================
pause
endlocal
