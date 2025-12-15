# tools/efro.ps1
# Repo-local helpers (safe PowerShell edits)

. "$PSScriptRoot\Invoke-EfroSafeEdit.ps1"

function Invoke-EfroSafeRegexReplace {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Pattern,
    [Parameter(Mandatory=$true)][string]$Replacement,
    [int]$Expected = 1,
    [int]$Count = 1,
    [string]$Options = "Multiline,Singleline",
    [int]$MinLength = 2000,
    [string]$TagPrefix = "edit",
    [switch]$DryRun
  )

  Invoke-EfroSafeEdit -Path $Path -MinLength $MinLength -TagPrefix $TagPrefix -DryRun:$DryRun -Edit {
    param($old)

    # Parse RegexOptions safely (no op_BitwiseOr issues)
    $opt = [System.Text.RegularExpressions.RegexOptions]::None
    foreach ($name in ($Options -split '\s*,\s*')) {
      if ([string]::IsNullOrWhiteSpace($name)) { continue }
      try {
        $opt = $opt -bor ([System.Text.RegularExpressions.RegexOptions]::$name)
      } catch {
        throw "ABBRUCH: Unbekannte RegexOption: '$name' (Options='$Options')"
      }
    }

    $matches = [regex]::Matches($old, $Pattern, $opt).Count
    if ($matches -ne $Expected) {
      throw "ABBRUCH: Pattern-Matches=$matches (erwartet $Expected)"
    }

    $re = [regex]::new($Pattern, $opt)
    $new = $re.Replace($old, $Replacement, $Count)

    if ($new -eq $old) { throw "ABBRUCH: Replace hat nichts geändert" }
    $new
  }
}
