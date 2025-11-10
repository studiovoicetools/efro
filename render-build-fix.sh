#!/usr/bin/env bash
set -e

echo "🚀 EFRO Render Build Fix gestartet ..."
echo "📦 Node Version: $(node -v)"
echo "📦 NPM Version: $(npm -v)"
echo "----------------------------"

# 1️⃣ Prüfen, ob mascotbot-sdk-react-0.1.6.tgz vorhanden ist
if [ -f "./mascotbot-sdk-react-0.1.6.tgz" ]; then
  echo "✅ mascotbot-sdk-react-0.1.6.tgz gefunden – kopiere nach ./src/ ..."
  mkdir -p ./src
  cp ./mascotbot-sdk-react-0.1.6.tgz ./src/
else
  echo "⚠️ WARNUNG: mascotbot-sdk-react-0.1.6.tgz nicht gefunden!"
fi

# 2️⃣ CSS-Build-Abhängigkeiten prüfen und ggf. installieren
echo "🧩 Prüfe Tailwind / PostCSS / Autoprefixer ..."
if ! npm list tailwindcss >/dev/null 2>&1; then
  echo "🔧 Installiere tailwindcss ..."
  npm install -D tailwindcss
else
  echo "✅ tailwindcss vorhanden"
fi

if ! npm list postcss >/dev/null 2>&1; then
  echo "🔧 Installiere postcss ..."
  npm install -D postcss
else
  echo "✅ postcss vorhanden"
fi

if ! npm list autoprefixer >/dev/null 2>&1; then
  echo "🔧 Installiere autoprefixer ..."
  npm install -D autoprefixer
else
  echo "✅ autoprefixer vorhanden"
fi

echo "----------------------------"
echo "🧠 CSS-Build-Abhängigkeiten geprüft und aktualisiert"

# 3️⃣ Dependencies installieren (schnell + sicher)
echo "🧩 Installiere npm-Pakete ..."
npm install --prefer-offline --no-audit --progress=false

# 4️⃣ Next.js Build starten
echo "🏗  Starte Next.js Build ..."
npm run build

# 5️⃣ Erfolgsmeldung
echo "✅ Build erfolgreich abgeschlossen!"
