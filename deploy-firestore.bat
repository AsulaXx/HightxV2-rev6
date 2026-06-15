@echo off
chcp 65001 >nul
setlocal

echo ============================================
echo  Deploy Firestore Rules ^& Indexes
echo  Project: hightxclient
echo ============================================
echo.

REM ตรวจสอบว่ามี Firebase CLI ติดตั้งหรือยัง
where firebase >nul 2>nul
if errorlevel 1 (
    echo [!] ไม่พบ Firebase CLI กำลังติดตั้งผ่าน npm...
    call npm install -g firebase-tools
    if errorlevel 1 (
        echo [X] ติดตั้ง Firebase CLI ไม่สำเร็จ กรุณาติดตั้ง Node.js ก่อน
        pause
        exit /b 1
    )
)

echo [1/3] ตรวจสอบสถานะ login...
call firebase login:list >nul 2>nul
if errorlevel 1 (
    echo [!] ยังไม่ได้ login กำลังเปิดหน้า login...
    call firebase login
)

echo.
echo [2/3] ตั้งค่าโปรเจกต์เป็น hightxclient...
call firebase use hightxclient

echo.
echo [3/3] กำลัง Deploy Firestore Rules + Indexes...
call firebase deploy --only firestore:rules,firestore:indexes

if errorlevel 1 (
    echo.
    echo [X] Deploy ล้มเหลว กรุณาตรวจสอบข้อความด้านบน
    pause
    exit /b 1
)

echo.
echo ============================================
echo  [OK] Deploy สำเร็จแล้ว!
echo ============================================
pause
endlocal
