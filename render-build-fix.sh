#!/usr/bin/env bash
set -e


# 🧠 Starte Pre-Flight-Check (Node-Script)
if [ -f "./render-check.mjs" ]; then
  echo "🔍 Führe render-check.mjs aus ..."
  node ./render-check.mjs
else
  echo "⚠️  render-check.mjs nicht gefunden – überspringe Vorprüfung"
fi




echo "🚀 EFRO Render Build Fix gestartet ..."
echo "📦 Node Version: $(node -v)"
echo "📦 NPM Version: $(npm -v)"
echo "----------------------------"

# 1️⃣ mascotbot-SDK prüfen und kopieren
if [ -f "./mascotbot-sdk-react-0.1.6.tgz" ]; then
  echo "✅ mascotbot-sdk-react-0.1.6.tgz gefunden – kopiere nach ./src/ ..."
  mkdir -p ./src
  cp -f ./mascotbot-sdk-react-0.1.6.tgz ./src/
else
  echo "⚠️  WARNUNG: mascotbot-sdk-react-0.1.6.tgz nicht gefunden!"
fi

# 2️⃣ PostCSS-Konfiguration automatisch reparieren
echo "🧠 Überprüfe PostCSS-Konfiguration ..."
if [ -f "postcss.config.mjs" ] || [ -f "postcss.config.js" ]; then
  echo "⚙️  Entferne alte PostCSS-Konfigurationsdateien (.mjs / .js)"
  rm -f postcss.config.mjs postcss.config.js
fi

if [ ! -f "postcss.config.cjs" ]; then
  echo "🧩 Erstelle neue postcss.config.cjs ..."
  cat <<EOF > postcss.config.cjs
// postcss.config.cjs (automatisch erzeugt)
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
EOF
else
  echo "✅ postcss.config.cjs bereits vorhanden"
fi

# 3️⃣ CSS-Abhängigkeiten prüfen (Tailwind, PostCSS, Autoprefixer)
echo "🧩 Prüfe CSS-Build-Abhängigkeiten ..."
for pkg in tailwindcss postcss autoprefixer; do
  if ! npm list "$pkg" >/dev/null 2>&1; then
    echo "🔧 Installiere $pkg ..."
    npm install -D "$pkg"
  else
    echo "✅ $pkg vorhanden"
  fi
done

# 4️⃣ Node Modules & Cache optimieren
echo "🧹 Bereinige NPM Cache (optional) ..."
npm cache verify --force >/dev/null 2>&1 || true

# 5️⃣ Dependencies installieren
echo "📦 Installiere npm-Pakete ..."
npm install --prefer-offline --no-audit --progress=false

# 6️⃣ Build starten
echo "🏗  Starte Next.js Build ..."
npm run build

# 7️⃣ Erfolgsmeldung
echo "✅ Build erfolgreich abgeschlossen!"
