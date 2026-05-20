# Windows-friendly release APK build (avoids EBUSY / Ninja "Permission denied" locks)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$root\android\gradlew.bat")) {
  throw "Run from repo root; android\gradlew.bat not found under $root"
}

$env:NODE_ENV = "production"

function Remove-LockedPath {
  param([string]$Path, [string]$Label)
  if (-not (Test-Path $Path)) { return }
  Write-Host "Removing $Label..."
  Remove-Item -Recurse -Force $Path -ErrorAction SilentlyContinue
  if (Test-Path $Path) {
    Write-Host "  (some files still locked — close Android Studio / second Gradle build, then retry)"
  }
}

Write-Host "Stopping Gradle daemons..."
Set-Location "$root\android"
& .\gradlew.bat --stop 2>$null
Start-Sleep -Seconds 3

# CMake / Ninja cache (fixes: configureCMakeRelWithDebInfo FAILED, ninja: Permission denied)
Remove-LockedPath "$root\android\app\.cxx" "android/app/.cxx (CMake cache)"
Remove-LockedPath "$root\android\app\build\intermediates\cxx" "android/app/build/intermediates/cxx"

# RN codegen locks (fixes: EBUSY on clipboard ShadowNodes.h)
Remove-LockedPath "$root\node_modules\@react-native-clipboard\clipboard\android\build" "clipboard android/build"

Start-Sleep -Seconds 2

Write-Host "Building release APK (--no-daemon, max-workers=1)..."
& .\gradlew.bat assembleRelease --no-daemon --max-workers=1
$code = $LASTEXITCODE
if ($code -eq 0) {
  Write-Host ""
  Write-Host "OK: android\app\build\outputs\apk\release\app-release.apk"
} else {
  Write-Host "Build failed ($code). If Permission denied persists:"
  Write-Host "  1) Add Defender exclusions for the project folder"
  Write-Host "  2) Close other Gradle builds / Android Studio"
  Write-Host "  3) Run this script again in a new PowerShell window"
}
exit $code
