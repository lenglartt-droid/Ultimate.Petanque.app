# Map markers — full circles on Android

## Problem

Custom map pins looked like a **quarter circle** (top-right arc only).

## Cause

On Android, `react-native-maps` draws custom marker views as a **bitmap**. With **New Architecture** (`newArchEnabled: true`), the layout size used for that bitmap can be **smaller than the real marker UI**, so the circle is clipped.

## Fix (in this repo)

1. **`patches/react-native-maps+1.20.1.patch`** — expands marker bitmap size from the child view and refreshes on layout change.
2. **`app/(tabs)/map.tsx`** — fixed 64×64 marker canvas, single circular disc per pin, badges kept inside the disc.
3. **`package.json`** — `postinstall`: `patch-package` (run `npm install` so the patch applies).

## Build steps

```bash
npm install
# rebuild native app (patch is in native Java)
npx expo run:android
# or release APK script
```

Expo Go may not include the native patch; use a **dev build or release APK**.
