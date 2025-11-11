#!/usr/bin/env bash
set -e

echo "🚀 EFRO Render-Build gestartet ..."
echo "----------------------------"

# 1️⃣ Node & NPM Version anzeigen
echo "📦 Node Version: $(node -v)"
echo "📦 NPM Version: $(npm -v)"

# 2️⃣ Prebuild ausführen
echo "⚙️  Führe Prebuild durch ..."
npm run prebuild

# 3️⃣ Next.js Build starten
echo "🏗️  Starte Next.js Build ..."
npm run build

echo "✅ Render-Build erfolgreich abgeschlossen!"
