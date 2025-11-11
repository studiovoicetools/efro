#!/usr/bin/env bash
set -e

echo "🔍 Prüfe @supabase/ssr Installation ..."

if npm list @supabase/ssr >/dev/null 2>&1; then
  echo "✅ @supabase/ssr bereits vorhanden"
else
  echo "⚙️  Installiere fehlendes @supabase/ssr ..."
  npm install @supabase/ssr
fi
