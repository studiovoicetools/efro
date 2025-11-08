#!/usr/bin/env bash
# =====================================================
# 🔁 EFRO Render Auto Sync + Cleanup + Deploy (Daily)
# =====================================================

set -e

echo "🌍 EFRO Auto-Sync gestartet - $(date)"

# === Variablen ===
APP_URL="https://dev.avatarsalespro.com"
SHOPIFY_API_KEY="${SHOPIFY_API_KEY:-DUMMY_KEY}"
SHOPIFY_CLIENT_SECRET="${SHOPIFY_CLIENT_SECRET:-DUMMY_SECRET}"

# === .env.local erneuern ===
echo "NEXT_PUBLIC_APP_URL=$APP_URL" > .env.local
echo "SHOPIFY_API_KEY=$SHOPIFY_API_KEY" >> .env.local
echo "SHOPIFY_CLIENT_SECRET=$SHOPIFY_CLIENT_SECRET" >> .env.local
echo "✅ .env.local aktualisiert."

# === Cleanup runtime/dynamic ===
echo "🧹 Bereinige doppelte runtime/dynamic..."
find ./src/app/api -type f -name "route.ts" -exec \
  awk '!seen[$0]++' {} > tmp && mv tmp {} \;
echo "✅ Cleanup abgeschlossen."

# === Build ===
echo "🏗️ Starte Build..."
npm run build || { echo "❌ Build fehlgeschlagen"; exit 1; }

# === Git Push ===
echo "🔄 Commit + Push..."
git config user.email "deploy@avatarsalespro.com"
git config user.name "RenderBot"
git add .
git commit -m "Render AutoSync $(date '+%Y-%m-%d %H:%M:%S')" || true
git push origin main || true
echo "✅ Git Push abgeschlossen."

# === Render Redeploy Trigger ===
echo "🚀 Trigger Deploy über API..."
curl -X POST \
  -H "Authorization: Bearer rnd_AHUKGporCmSrLjNtpJ5O4Z7uE168" \
  -H "Content-Type: application/json" \
  -d '{"clearCache":true}' \
  https://api.render.com/v1/services/srv-d457iqh5pdvs73brh48g/deploys

echo "🎉 EFRO AutoSync abgeschlossen - $(date)"
