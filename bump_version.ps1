param (
    [string]$Type = "patch"
)

# 1. Bump package.json version
Write-Host "Bumping package.json version ($Type)..."
npm version $Type --no-git-tag-version

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to bump npm version"
    exit 1
}

# 2. Read the new version
$subVersion = (Get-Content -Path .\package.json | ConvertFrom-Json).version
Write-Host "New version is: $subVersion"

# 3. Update tauri.conf.json
# Write via UTF8Encoding($false) (no BOM): a BOM makes tauri fail with
# "expected value at line 1 column 1" when parsing the config.
Write-Host "Updating tauri.conf.json..."
$tauriConfPath = ".\src-tauri\tauri.conf.json"
$tauriJson = Get-Content -Path $tauriConfPath -Raw | ConvertFrom-Json
$tauriJson.version = $subVersion
[System.IO.File]::WriteAllText(
    (Resolve-Path $tauriConfPath),
    ($tauriJson | ConvertTo-Json -Depth 100),
    (New-Object System.Text.UTF8Encoding($false))
)

# 4. Update Cargo.toml
# Same no-BOM treatment for consistency.
Write-Host "Updating Cargo.toml..."
$cargoTomlPath = ".\src-tauri\Cargo.toml"
$toml = (Get-Content -Path $cargoTomlPath) -replace '^version = ".*"', ('version = "' + $subVersion + '"')
[System.IO.File]::WriteAllLines(
    (Resolve-Path $cargoTomlPath),
    $toml,
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Host "Version bumped to $subVersion in all files."
Write-Host "You can now commit and tag: git commit -am 'v$subVersion' && git tag v$subVersion"
