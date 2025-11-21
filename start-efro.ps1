param(
    # Standard: Projektordner = Ordner, in dem das Script liegt
    [string]$ProjectDir = $PSScriptRoot,
    # Port fuer localhost-Entwicklung (Shopify-CLI-Proxy)
    [int]$LocalhostPort = 3458
)

# -------------------------------------------------------------
# Logging
# -------------------------------------------------------------
$logFile = Join-Path $ProjectDir "EFRO-start.log"

function Log {
    param(
        [string]$Level,
        [string]$Message
    )
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] [$Level] $Message"
    Write-Host $line
    Add-Content -Path $logFile -Value $line
}

Write-Host "=== EFRO STARTER (LOCALHOST, KEIN CLOUDFLARE) ===" -ForegroundColor Cyan
Log "INFO" "EFRO Starter gestartet."

# -------------------------------------------------------------
# 1) Projektordner setzen
# -------------------------------------------------------------
try {
    Set-Location $ProjectDir
    Log "INFO" "Arbeitsordner gesetzt auf: $ProjectDir"
} catch {
    Log "ERROR" "Projektordner $ProjectDir nicht gefunden."
    exit 1
}

# -------------------------------------------------------------
# 2) Shopify CLI & Node pruefen
# -------------------------------------------------------------
# Shopify CLI ueber PATH suchen
$shopifyFromPath = Get-Command shopify -ErrorAction SilentlyContinue
if (-not $shopifyFromPath) {
    Log "ERROR" "Shopify CLI wurde nicht gefunden."
    Log "ERROR" "Bitte in einer PowerShell ausfuehren:"
    Log "ERROR" "  npm install -g @shopify/cli@latest"
    exit 1
}
Log "INFO" "Shopify CLI gefunden: $($shopifyFromPath.Source)"

# Node (optional) pruefen – nur zu Info
try {
    $nodeV = node -v
    Log "INFO" "Node Version aktiv: $nodeV"
} catch {
    Log "WARN" "Node konnte nicht abgefragt werden. Bitte Node.js Installation pruefen."
}

try {
    $shopifyVersion = & shopify --version
    Log "INFO" "Shopify CLI Version: $shopifyVersion"
} catch {
    Log "WARN" "Shopify Version konnte nicht gelesen werden."
}

# -------------------------------------------------------------
# 3) Shopify App Dev mit --use-localhost starten
#    => Kein Cloudflare, kein ngrok, alles ueber localhost
# -------------------------------------------------------------
Log "INFO" "Starte 'shopify app dev --use-localhost' ..."

$shopCmd = @"
cd `"$ProjectDir`"
shopify app dev --use-localhost --localhost-port=$LocalhostPort
"@

Start-Process "powershell" -ArgumentList "-NoExit", "-Command", $shopCmd
Log "INFO" "Shopify App Dev (localhost) gestartet."

Write-Host ""
Write-Host "=== EFRO DEV (LOCALHOST) GESTARTET ===" -ForegroundColor Cyan
Write-Host "Shopify CLI laeuft jetzt mit --use-localhost auf Port $LocalhostPort."
Write-Host "Oeffne deinen Dev-Store und starte die EFRO-App wie gewohnt."
Write-Host "Log-Datei: $logFile"
