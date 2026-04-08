#Requires -Version 5
# Watches MARKETING.md and pushes it to acer-server whenever it changes.
# Before pushing, updates the last-updated date in the header.
# Started at logon by Scheduled Task: OpenClawSyncMarketing

$ErrorActionPreference = 'Stop'

$Source      = 'C:\Projects\dev-psy-bot\docs\MARKETING.md'
$RemoteHost  = 'acer-server'
$RemotePath  = '/home/andrei/.openclaw/workspace/dev-psy-bot/MARKETING.md'
$LogFile     = 'C:\Users\andre\bin\sync-marketing.log'
$PollSeconds = 60

function Write-Log($msg) {
    $line = "{0} {1}" -f (Get-Date -Format 's'), $msg
    Add-Content -LiteralPath $LogFile -Value $line
}

function Push-File {
    try {
        $out = & scp -B -q -- $Source ("{0}:{1}" -f $RemoteHost, $RemotePath) 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "PUSH ok"
        } else {
            Write-Log "PUSH fail ($LASTEXITCODE): $out"
        }
    } catch {
        Write-Log "PUSH error: $_"
    }
}

# Returns MD5 hash of content excluding the date line ("> **..:** YYYY-MM-DD").
# This way a date-only change does not count as a content change.
function Get-ContentStamp {
    try {
        $lines = Get-Content -LiteralPath $Source -Encoding UTF8 -ErrorAction Stop
        $filtered = $lines | Where-Object { $_ -notmatch '\d{4}-\d{2}-\d{2}' }
        $hash = ($filtered -join "`n" | Get-FileHash -Algorithm MD5 -ErrorAction Stop).Hash
        return $hash
    } catch {
        return $null
    }
}

# Updates the "...:** YYYY-MM-DD" line in the header to today's date.
# Matches any line of the form "> **<anything>:** YYYY-MM-DD"
# Returns $true if the file was modified.
function Update-DateInHeader {
    $today   = (Get-Date).ToString('yyyy-MM-dd')
    $lines   = Get-Content -LiteralPath $Source -Encoding UTF8
    # Pattern: blockquote line that ends with a date
    $pattern = '^(>\s\*\*[^*]+\*\*\s)(\d{4}-\d{2}-\d{2})$'
    $found   = $false
    $changed = $false

    $newLines = $lines | ForEach-Object {
        if ($_ -match $pattern) {
            $found = $true
            if ($Matches[2] -ne $today) {
                $changed = $true
                "$($Matches[1])$today"
            } else {
                $_
            }
        } else {
            $_
        }
    }

    if ($changed) {
        $newLines | Set-Content -LiteralPath $Source -Encoding UTF8
        Write-Log "DATE updated -> $today"
    }
    return $changed
}

if (-not (Test-Path -LiteralPath $Source)) {
    Write-Log "FATAL source missing: $Source"
    exit 1
}

Write-Log "watcher start (source=$Source remote=${RemoteHost}:${RemotePath})"

# Initial push so server is in sync after a reboot/restart of the watcher.
Update-DateInHeader | Out-Null
Push-File
$lastStamp = Get-ContentStamp

while ($true) {
    Start-Sleep -Seconds $PollSeconds
    $stamp = Get-ContentStamp
    if ($null -eq $stamp) { continue }
    if ($stamp -ne $lastStamp) {
        $lastStamp = $stamp
        Update-DateInHeader | Out-Null
        Push-File
    }
}
