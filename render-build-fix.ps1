Write-Host "=== EFRO Render AutoFix gestartet ==="
Write-Host ""

# Environment Check
$inRender = Test-Path env:RENDER
if ($inRender) {
    Write-Host "Running on Render (env:RENDER detected)"
} else {
    Write-Host "Running locally"
}

# Node / NPM Versions
Write-Host ("Node Version: " + (node -v))
Write-Host ("NPM Version: " + (npm -v))
Write-Host "----------------------------------------"

# Dependencies installieren
Write-Host "Installing dependencies..."
npm install --force
if ($LASTEXITCODE -ne 0) { exit 1 }

# Tailwind / PostCSS / Autoprefixer sicherstellen
Write-Host "Installing Tailwind, PostCSS, and Autoprefixer..."
npm install -D tailwindcss@3.4.18 postcss@8.4.41 autoprefixer@10.4.20 --force
if ($LASTEXITCODE -ne 0) { exit 1 }

# TypeScript prufen
if (-not (Test-Path "./node_modules/.bin/tsc")) {
    Write-Host "Installing TypeScript..."
    npm install -D typescript @types/node @types/react @types/react-dom --force
}

# Supabase prufen
if (-not (Test-Path "./node_modules/@supabase/ssr")) {
    Write-Host "Installing @supabase/ssr..."
    npm install @supabase/ssr --force
}

# postcss.config.cjs erzeugen
$postcssConfig = @"
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
"@
Set-Content -Path "./postcss.config.cjs" -Value $postcssConfig -Encoding UTF8

# .next Cache loschen
if (Test-Path ".next") {
    Remove-Item ".next" -Recurse -Force
    Write-Host ".next cache removed"
}

# Build ausfuhren  aber nur auf Render
if ($inRender) {
    Write-Host "Running Next.js build (Render mode)..."
    npx next build
} else {
    Write-Host "Local mode detected  build skipped to prevent recursion."
}

Write-Host ""
Write-Host "EFRO Render-Fix completed successfully."
