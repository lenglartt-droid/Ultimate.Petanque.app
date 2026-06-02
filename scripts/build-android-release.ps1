# Clean release APK with 16 KB–friendly NDK settings.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Updating Expo/RN deps (16 KB page size fixes in SDK 53.0.14+)..." -ForegroundColor Cyan
npx expo install --fix
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Clean release build (NDK r28 from android/gradle.properties)..." -ForegroundColor Yellow
Set-Location android
.\gradlew.bat clean assembleRelease --no-daemon --max-workers=1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "APK: android\app\build\outputs\apk\release\app-release.apk" -ForegroundColor Green
Write-Host "Verify 16 KB: Android Studio -> Build -> Analyze APK -> Alignment" -ForegroundColor Cyan
Write-Host "See docs/android-16kb-page-size.md" -ForegroundColor Cyan
