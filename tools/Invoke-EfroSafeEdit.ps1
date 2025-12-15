function Invoke-EfroSafeEdit {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [int]$MinLength = 2000,
    [string]$TagPrefix = "edit",
    [switch]$DryRun,
    [Parameter(Mandatory=$true)][ScriptBlock]$Edit
  )

  if (!(Test-Path $Path)) { throw "ABBRUCH: Datei nicht gefunden: $Path" }

  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  git diff > "_checkpoint_$ts.patch" | Out-Null
  git tag -f "${TagPrefix}_$ts" | Out-Null

  $full  = (Resolve-Path $Path).Path
  $bytes = [System.IO.File]::ReadAllBytes($full)
  $old   = [System.Text.Encoding]::UTF8.GetString($bytes)

  if ([string]::IsNullOrWhiteSpace($old)) { throw "ABBRUCH: Input ist leer/whitespace" }
  if ($old.Length -lt $MinLength) { throw "ABBRUCH: Input zu kurz ($($old.Length)) < MinLength ($MinLength)" }

  $new = & $Edit $old

  if ($null -eq $new) { throw "ABBRUCH: Edit gab null zurück" }
  if ([string]::IsNullOrWhiteSpace($new)) { throw "ABBRUCH: Output ist leer/whitespace" }
  if ($new.Length -lt $MinLength) { throw "ABBRUCH: Output zu kurz ($($new.Length)) < MinLength ($MinLength)" }

  if ($DryRun) {
    Write-Host "DRYRUN OK -> würde schreiben: $full (len $($new.Length))" -ForegroundColor Cyan
    return
  }

  [System.IO.File]::WriteAllText($full, $new, [System.Text.UTF8Encoding]::new($false))
  Write-Host "SAFE EDIT OK -> $full (len $($new.Length))" -ForegroundColor Green
  git diff -- $Path | Select-Object -First 80
}
