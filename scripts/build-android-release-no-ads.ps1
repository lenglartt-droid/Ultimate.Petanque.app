# Release APK without native AdMob (for AOSP / non-Play emulators). Not for production.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:EXPO_PUBLIC_DISABLE_NATIVE_ADMOB = "true"
Write-Host "Building release APK WITHOUT native AdMob (emulator testing only)" -ForegroundColor Yellow

Set-Location android
.\gradlew.bat clean assembleRelease --no-daemon --max-workers=1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "APK: android\app\build\outputs\apk\release\app-release.apk" -ForegroundColor Green
Write-Host "This build has no ads. For production, run: cd android; .\gradlew.bat assembleRelease" -ForegroundColor Cyan
