@echo off
title 🧹 EFRO DEV - Clean & Restart
color 0b

echo ===============================================
echo 🧹 Säubere EFRO DEV Umgebung (Logs, Ports, Tunnel)
echo ===============================================

:: Alte Logs löschen
if exist "D:\aiva-elevenlabs-avatar\logs\dev-start.log" (
    del /f /q "D:\aiva-elevenlabs-avatar\logs\dev-start.log"
    echo ✅ Alte Logdatei gelöscht.
) else (
    echo ℹ️ Keine alte Logdatei gefunden.
)

:: Hängende Node- oder Tunnel-Prozesse beenden
echo 🧯 Suche laufende DEV-Prozesse ...
for /f "tokens=5" %%a in ('netstat -ano ^| find ":3000" ^| find "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
taskkill /IM node.exe /F >nul 2>&1
taskkill /IM cloudflared.exe /F >nul 2>&1
echo ✅ Laufende DEV/Tunnel-Prozesse beendet.

:: Firewall-Regeln prüfen und ggf. aktualisieren
echo 🧱 Überprüfe Firewall-Regeln für Port 3000 ...
netsh advfirewall firewall add rule name="Remix Local Port 3000" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1
netsh advfirewall firewall add rule name="Remix Local Port 3000" dir=out action=allow protocol=TCP localport=3000 >nul 2>&1
echo ✅ Firewall-Regeln aktiv.

:: Kurze Pause für Stabilität
timeout /t 3 >nul

:: Startet jetzt automatisch den Hauptstarter
echo 🚀 Starte EFRO DEV Haupt-Setup ...
cd /d "D:\aiva-elevenlabs-avatar"
start "" "start-dev-pro.bat"

echo ===============================================
echo 🟢 Alles bereit! Logs unter: logs\dev-start.log
echo ===============================================
timeout /t 3 >nul
exit /b
