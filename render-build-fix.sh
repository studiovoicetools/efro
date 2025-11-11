#!/usr/bin/env bash
set -euo pipefail

echo "🚀 EFRO Auto-Fix gestartet ..."
echo "📦 Node Version: $(node -v)"
echo "📦 NPM Version: $(npm -v)"
echo "----------------------------"

# Farben für bessere Lesbarkeit
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1️⃣ SDK prüfen
if [ -f "./mascotbot-sdk-react-0.1.6.tgz" ]; then
  echo -e "${GREEN}✅ mascotbot-sdk-react-0.1.6.tgz gefunden – kopiere nach ./src/${NC}"
  mkdir -p ./src
  cp ./mascotbot-sdk-react-0.1.6.tgz ./src/
else
  echo -e "${YELLOW}⚠️ WARNUNG: mascotbot-sdk-react-0.1.6.tgz fehlt!${NC}"
fi

# 2️⃣ Tailwind-Version prüfen
echo "🧠 Prüfe Tailwind-Version ..."
TAILWIND_VERSION=$(npm list tailwindcss 2>/dev/null | grep "tailwindcss@" | awk -F'@' '{print $2}' | tail -n1 || echo "none")
echo "📦 Aktuelle Tailwind-Version: ${TAILWIND_VERSION:-none}"

if [[ "$TAILWIND_VERSION" == 4* ]]; then
  echo -e "${YELLOW}🚨 Tailwind v4 erkannt – Downgrade auf v3.4.18 ...${NC}"
  npm uninstall -D @tailwindcss/postcss tailwindcss || true
  npm install -D tailwindcss@3.4.18 postcss@8.4.41 autoprefixer@10.4.20
else
  echo -e "${GREEN}✅ Tailwind v3 ist aktiv${NC}"
fi

# 3️⃣ Sichere PostCSS-Konfiguration
echo "🧩 Erstelle kompatible postcss.config.cjs ..."
cat > postcss.config.cjs <<'EOF'
// postcss.config.cjs – kompatibel mit Next.js 14 + Tailwind v3
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
EOF

# 4️⃣ DevDependencies sicherstellen
echo "⚙️ Setze NODE_ENV=development, um DevDependencies zu installieren ..."
export NODE_ENV=development

# 5️⃣ NPM-Abhängigkeiten installieren
echo "📦 Installiere npm-Pakete ..."
npm install --prefer-offline --no-audit --progress=false

# 6️⃣ TypeScript prüfen
if [ ! -f "./node_modules/.bin/tsc" ]; then
  echo -e "${YELLOW}🧠 Installiere fehlendes TypeScript ...${NC}"
  npm install -D typescript @types/node @types/react @types/react-dom
else
  echo -e "${GREEN}✅ TypeScript vorhanden${NC}"
fi

# 7️⃣ Supabase SSR prüfen
if ! npm list @supabase/ssr >/dev/null 2>&1; then
  echo -e "${YELLOW}🧩 Installiere fehlendes @supabase/ssr-Modul ...${NC}"
  npm install @supabase/ssr@latest
else
  echo -e "${GREEN}✅ @supabase/ssr bereits vorhanden${NC}"
fi

# 8️⃣ Final Check
echo "----------------------------"
echo -e "${GREEN}✅ Final Check:${NC}"
echo "   - Tailwind-Version: $(npx tailwindcss -v 2>/dev/null || echo 'nicht gefunden')"
echo "   - TypeScript: $(npx tsc -v 2>/dev/null || echo 'nicht gefunden')"
if npm list @supabase/ssr >/dev/null 2>&1; then
  echo "   - Supabase SSR: installiert"
else
  echo "   - Supabase SSR: fehlt"
fi
echo "----------------------------"

# 9️⃣ Next.js Build starten
echo "🏗️ Starte Next.js Build ..."
if npm run build; then
  echo -e "${GREEN}✅ Build erfolgreich abgeschlossen!${NC}"
else
  echo -e "${RED}❌ Build fehlgeschlagen.${NC}"
  exit 1
fi
