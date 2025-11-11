#!/usr/bin/env bash
set -e

echo "🚀 EFRO Auto-Prebuild gestartet ..."
echo "📦 Node: $(node -v)"
echo "📦 NPM: $(npm -v)"
echo "----------------------------"

# 🧩 Tailwind prüfen
if ! npx tailwindcss --version >/dev/null 2>&1; then
  echo "⚠️ Tailwind nicht gefunden – installiere v3.4.18 ..."
  npm install -D tailwindcss@3.4.18 postcss@8.4.41 autoprefixer@10.4.20
else
  echo "✅ Tailwind bereits vorhanden"
fi

# 🧩 PostCSS-Konfiguration
cat > postcss.config.cjs << 'EOF'
// postcss.config.cjs – kompatibel mit Next.js 14 + Tailwind v3
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
EOF

# 🧠 TypeScript sicherstellen (immer installieren, auch in production)
if ! npx tsc -v >/dev/null 2>&1; then
  echo "⚠️ TypeScript fehlt – installiere..."
  npm install --save-dev typescript @types/node @types/react @types/react-dom
else
  echo "✅ TypeScript erkannt"
fi

# 🧠 Supabase SSR prüfen
if ! npm list @supabase/ssr >/dev/null 2>&1; then
  echo "⚠️ Supabase SSR fehlt – installiere..."
  npm install @supabase/ssr
else
  echo "✅ Supabase SSR vorhanden"
fi

# 🧩 Final Check
echo "----------------------------"
echo "✅ Final Check:"
echo "   - Tailwind-Version: $(npx tailwindcss --version || echo 'nicht erkannt')"
echo "   - TypeScript: $(npx tsc -v || echo 'nicht erkannt')"
echo "   - Supabase SSR: $(npm list @supabase/ssr | grep @supabase/ssr || echo 'nicht installiert')"
echo "----------------------------"

# 🏗️ Next.js Build starten
npm run build
