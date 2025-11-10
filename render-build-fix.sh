#!/bin/bash
set -e

echo "🚀 EFRO Render Build Fix gestartet ..."

# Stelle sicher, dass die SDK-Datei auch im Build-Pfad vorhanden ist
if [ -f "./mascotbot-sdk-react-0.1.6.tgz" ]; then
  echo "📦 mascotbot-sdk-react-0.1.6.tgz gefunden – kopiere nach ./src/ ..."
  mkdir -p ./src
  cp ./mascotbot-sdk-react-0.1.6.tgz ./src/
else
  echo "❌ mascotbot-sdk-react-0.1.6.tgz fehlt im Projektroot!"
  exit 1
fi

# Führe standardmäßigen Build aus
echo "🧩 Installiere Dependencies ..."
npm ci

echo "🏗  Starte Next.js Build ..."
npm run build

echo "✅ Build erfolgreich abgeschlossen!"
