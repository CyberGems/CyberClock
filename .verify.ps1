$path = Join-Path $PSScriptRoot 'src\mini\index.html'
$content = [System.IO.File]::ReadAllText($path)
$lineCount = ($content -split "`n").Count
$byteCount = [System.IO.File]::ReadAllBytes($path).Length
Write-Host "LINES: $lineCount"
Write-Host "BYTES: $byteCount"

# Also check end of file
$last100 = $content.Substring([Math]::Max(0, $content.Length - 200))
Write-Host "TAIL: [$last100]"
