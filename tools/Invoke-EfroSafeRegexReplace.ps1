function Invoke-EfroSafeRegexReplace {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [int]$MinLength = 2000,
    [string]$TagPrefix = "regex",
    [int]$Expected = 1,
    [int]$Count = 1,
    [string]$Options = "Multiline",
    [Parameter(Mandatory=$true)][string]$Pattern,
    [Parameter(Mandatory=$true)][string]$Replacement,
    [switch]$DryRun
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

  $rxOpt = [System.Text.RegularExpressions.RegexOptions]::None
  foreach ($o in ($Options -split '\s*,\s*' | Where-Object { $_ })) {
    $rxOpt = $rxOpt -bor [System.Enum]::Parse([System.Text.RegularExpressions.RegexOptions], $o, $true)
  }

  $m = [regex]::Matches($old, $Pattern, $rxOpt).Count
  if ($m -ne $Expected) { throw "ABBRUCH: Pattern-Matches=$m (erwartet $Expected)" }
  $rx = [regex]::new($Pattern, $rxOpt)
  $new = $rx.Replace($old, $Replacement, $Count)
  if ($new -eq $old) { throw "ABBRUCH: Replace hat nichts geändert" }
  if ([string]::IsNullOrWhiteSpace($new)) { throw "ABBRUCH: Output ist leer/whitespace" }
  if ($new.Length -lt $MinLength) { throw "ABBRUCH: Output zu kurz ($($new.Length)) < MinLength ($MinLength)" }

  if ($DryRun) {
    Write-Host "DRYRUN OK -> würde schreiben: $full (len $($new.Length))" -ForegroundColor Cyan
    return
  }

  [System.IO.File]::WriteAllText($full, $new, [System.Text.UTF8Encoding]::new($false))
  Write-Host "SAFE REGEX OK -> $full (len $($new.Length))" -ForegroundColor Green
  git diff -- $Path | Select-Object -First 80
}
