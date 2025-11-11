#!/usr/bin/env bash
set -e

echo "🚀 EFRO Auto-Fix gestartet ..."
echo "📦 Node Version: $(node -v)"
echo "📦 NPM Version: $(npm -v)"
echo "----------------------------"

# 1️⃣ SDK prüfen
if [ -f "./mascotbot-sdk-react-0.1.6.tgz" ]; then
  echo "✅ mascotbot-sdk-react-0.1.6.tgz gefunden – kopiere nach ./src/"
  mkdir -p ./src
  cp ./mascotbot-sdk-react-0.1.6.tgz ./src/
else
  echo "⚠️ WARNUNG: mascotbot-sdk-react-0.1.6.tgz fehlt!"
fi

# 2️⃣ Tailwind-Version prüfen und ggf. fixen
echo "🧠 Prüfe Tailwind-Version ..."
TAILWIND_VERSION=$(npm list tailwindcss | grep "tailwindcss@" | awk -F'@' '{print $2}' | tail -n1)
echo "📦 Aktuelle Tailwind-Version: ${TAILWIND_VERSION}"

if [[ "$TAILWIND_VERSION" == 4* ]]; then
  echo "🚨 Tailwind v4 erkannt – führe Downgrade auf v3.4.18 durch ..."
  npm uninstall -D @tailwindcss/postcss || true
  npm uninstall -D tailwindcss || true
  npm install -D tailwindcss@3.4.18 postcss@8.4.41 autoprefixer@10.4.20
else
  echo "✅ Tailwind v3 ist aktiv"
fi

# 3️⃣ PostCSS-Konfiguration absichern
echo "🧩 Erstelle sichere postcss.config.cjs ..."
cat > postcss.config.cjs << 'EOF'
// postcss.config.cjs – auto-fixed for Tailwind v3
module.exports = {
  plugins: [
    require('tailwindcss'),
    require('autoprefixer'),
  ],
};
EOF

# 4️⃣ DevDependencies erzwingen
echo "⚙️  Setze NODE_ENV=development, damit DevDependencies installiert werden ..."
export NODE_ENV=development

# 5️⃣ NPM-Abhängigkeiten installieren
echo "📦 Installiere npm-Pakete ..."
npm install --prefer-offline --no-audit --progress=false

# 6️⃣ TypeScript sicherstellen
if [ ! -f "./node_modules/.bin/tsc" ]; then
  echo "🧠 Erzwinge TypeScript-Installation ..."
  npm install --save-dev typescript @types/node @types/react @types/react-dom
else
  echo "✅ TypeScript vorhanden"
fi

# 7️⃣ Supabase SSR sicherstellen
if ! npm list @supabase/ssr >/dev/null 2>&1; then
  echo "🧩 Installiere fehlendes @supabase/ssr-Modul ..."
  npm install @supabase/ssr@0.0.10 --save-dev
else
  echo "✅ @supabase/ssr bereits vorhanden"
fi

# 8️⃣ Sicherheits-Check-Ausgabe
echo "----------------------------"
echo "✅ Final Check:"
echo "   - Tailwind-Version: $(npm list tailwindcss | grep 'tailwindcss@' | awk -F'@' '{print $2}' | tail -n1)"
echo "   - TypeScript: $(npx tsc --version 2>/dev/null || echo 'nicht installiert')"
echo "   - Supabase SSR: $(npm list @supabase/ssr | grep '@supabase/ssr@' | awk -F'@' '{print $2}' | tail -n1)"
echo "----------------------------"

# 9️⃣ Next.js Build starten
echo "🏗️  Starte Next.js Build ..."
npm run build

echo "✅ Build erfolgreich abgeschlossen!"
