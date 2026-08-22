$ErrorActionPreference = "Stop"
$androidRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $androidRoot
$distRoot = Join-Path $projectRoot "dist"
$assetsRoot = Join-Path $androidRoot "app\src\main\assets"

Push-Location $projectRoot
try {
    npm run build
} finally {
    Pop-Location
}

if (-not (Test-Path (Join-Path $distRoot "index.html"))) {
    throw "Web build did not produce dist/index.html"
}

if (Test-Path $assetsRoot) {
    Remove-Item -LiteralPath $assetsRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $assetsRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $distRoot "index.html") -Destination $assetsRoot -Force
Copy-Item -LiteralPath (Join-Path $distRoot "assets") -Destination (Join-Path $assetsRoot "assets") -Recurse -Force

Write-Host "Synced Web build into $assetsRoot"
