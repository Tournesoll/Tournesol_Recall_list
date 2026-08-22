# Recall Lite Android

This is the Android Studio shell for the Recall Lite web app. The Vite build is copied into `app/src/main/assets`, and the app serves it through the native WebView so JavaScript, local storage, and IndexedDB remain available offline.

## Open

Open this `android` folder with the Android Studio installation at `F:\AndroidStudio`.

## Build from PowerShell

From the repository root, sync the latest web build into the Android assets:

```powershell
.\sync-web.ps1
```

Then build the debug APK from the `android` folder with the Gradle wrapper or Android Studio:

```powershell
.\gradlew.bat assembleDebug
```

The APK is written to `app/build/outputs/apk/debug/app-debug.apk`.
