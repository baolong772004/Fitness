param(
  [ValidateSet('arm64-v8a', 'x86_64')]
  [string]$Architecture = 'arm64-v8a'
)

$ErrorActionPreference = 'Stop'
$source = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stage = Join-Path $env:TEMP ('aura-rn-build-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$output = Join-Path $source 'builds'

New-Item -ItemType Directory -Path $stage -Force | Out-Null
foreach ($name in @('src', 'assets', 'app.json', 'app.config.js', 'package.json', 'package-lock.json', '.npmrc', 'tsconfig.json', 'eslint.config.js', '.env')) {
  $item = Join-Path $source $name
  if (Test-Path -LiteralPath $item) {
    Copy-Item -LiteralPath $item -Destination $stage -Recurse -Force
  }
}

Push-Location $stage
try {
  & npm.cmd ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

  & npx.cmd expo prebuild --platform android --no-install
  if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed.' }

  Push-Location (Join-Path $stage 'android')
  try {
    & .\gradlew.bat assembleDebug "-PreactNativeArchitectures=$Architecture" --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
  }
  finally { Pop-Location }

  New-Item -ItemType Directory -Path $output -Force | Out-Null
  $apk = Join-Path $stage 'android\app\build\outputs\apk\debug\app-debug.apk'
  $architectureLabel = if ($Architecture -eq 'arm64-v8a') { 'arm64' } else { 'x86_64' }
  $destination = Join-Path $output "aura-fitness-react-native-$architectureLabel-debug.apk"
  Copy-Item -LiteralPath $apk -Destination $destination -Force
  Write-Host "APK: $destination"
  Write-Host "Build files: $stage"
}
finally { Pop-Location }
