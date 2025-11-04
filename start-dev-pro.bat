@echo off
title 🚀 EFRO Dev Environment
color 0A

:: ====== Verzeichnisse ======
set PROJECT_PATH=D:\aiva-elevenlabs-avatar
set LOG_PATH=%PROJECT_PATH%\logs

:: ====== Log-Verzeichnis prüfen ======
if not exist "%LOG_PATH%" mkdir "%LOG_PATH%"

echo [EFRO DEV] Starte Entwicklungsumgebung ...
echo ============================================
echo.

:: ====== Next.js Server starten ======
start "🟢 NEXT.JS SERVER" cmd /k "cd /d %PROJECT_PATH% && echo [Next.js] Starte Server... && npm run dev >> %LOG_PATH%\nextjs.log 2>&1"

timeout /t 5 /nobreak >nul

:: ====== Cloudflare Tunnel starten (mit Auto-Restart) ======
echo [Cloudflare] Tunnel wird gestartet und überwacht...
:RESTART_TUNNEL
start "🌐 CLOUDFLARE TUNNEL" cmd /k "cd /d C:\Users\MEZE AYDIN\.cloudflared && echo [Tunnel] Starte efro-dev... && cloudflared tunnel run efro-dev >> %LOG_PATH%\tunnel.log 2>&1"
timeout /t 60 >nul

:: Prüfen, ob Tunnel-Prozess noch läuft
tasklist | find /i "cloudflared.exe" >nul
if errorlevel 1 (
    echo [WARNUNG] Tunnel getrennt. Neustart in 5 Sekunden...
    timeout /t 5 /nobreak >nul
    goto RESTART_TUNNEL
)

echo [OK] Tunnel aktiv. Drücke STRG+C zum Beenden.
pause >nul
