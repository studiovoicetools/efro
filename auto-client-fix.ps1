# auto-client-fix.ps1
$files = Get-ChildItem -Path "src/app" -Recurse -Include "page.tsx"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match "use(Context|Effect|State|Ref|Conversation|Mascot|Elevenlabs)") {
        if ($content -notmatch '"use client"') {
            Write-Host "➡️  Füge 'use client' hinzu in: $($file.FullName)"
            '"use client";' | Out-File -FilePath $file.FullName -Encoding utf8
            $content | Out-File -FilePath $file.FullName -Append -Encoding utf8
        } else {
            Write-Host "✅ Bereits 'use client' vorhanden: $($file.FullName)"
        }
    }
}
Write-Host "`n🎯 Alle betroffenen Seiten sind jetzt als Client-Komponenten markiert."
