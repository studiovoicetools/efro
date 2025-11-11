#!/usr/bin/env bash
set -e

echo "🧹 EFRO Render Cache Cleanup gestartet ..."
echo "-----------------------------------------"

# Alte Build- und Node-Caches löschen
rm -rf .next node_modules package-lock.json
rm -rf /opt/render/project/.cache || true
rm -rf /opt/render/project/.npm || true

echo "📦 Reinstalliere alle Pakete frisch ..."
npm install --prefer-offline --no-audit --progress=false

echo "✅ Cache Reset abgeschlossen – System ist jetzt sauber."
