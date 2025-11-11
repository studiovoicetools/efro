#!/usr/bin/env bash
set -e

echo "🔍 Prüfe Client-Komponenten auf 'use client' Hooks ..."

MISSING_FILES=()

# Alle .tsx-Dateien durchsuchen, die React Hooks nutzen, aber kein 'use client' enthalten
while IFS= read -r file; do
  if grep -Eq "use(State|Effect|Ref|Context|Conversation|Mascot|Elevenlabs)" "$file" && ! grep -q "'use client'" "$file"; then
    MISSING_FILES+=("$file")
  fi
done < <(find src/app -type f -name "*.tsx")

# Falls fehlende Dateien gefunden werden
if [ ${#MISSING_FILES[@]} -gt 0 ]; then
  echo "⚠️  Es fehlen 'use client' Direktiven in folgenden Dateien:"
  for f in "${MISSING_FILES[@]}"; do
    echo " - $f"
    # Automatisch fixen
    sed -i '1i"use client";' "$f"
  done
  echo "✅ Auto-Fix abgeschlossen!"
else
  echo "✅ Alle Client-Komponenten sind korrekt markiert."
fi
