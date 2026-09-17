# Android app (APK) for kids and parents

The Android app is the web app wrapped as a **Trusted Web Activity**: a real APK with its own icon and splash, full screen,
no address bar, and the same notifications the web app already sends. Every deploy to `main` is live inside the app at once;
nothing needs rebuilding or re-installing.

## Build the APK in ten minutes (no Android Studio)

1. Deploy `main` and open https://www.pwabuilder.com. Enter `https://school-support-system.vercel.app` and press Start.
   The report should show the manifest, icons and service worker as ready.
2. Package for stores → **Android** → choose *Trusted Web Activity*. Settings: package id `com.betnagroup.studyportal`,
   app name `Study Portal`, launcher name `Study Portal`, start URL `/`, display standalone, theme `#0b1020`, signing key
   **Create new**. Download the zip.
3. The zip contains `app-release-signed.apk` (install it directly on the boys' phones: send it on WhatsApp or Drive and
   allow "install from this source") and `assetlinks.json` with the certificate fingerprint. Keep the signing key file
   safe; it is needed for every future update of the APK itself.
4. Copy the fingerprint into Vercel → Settings → Environment Variables:
   `ANDROID_PACKAGE=com.betnagroup.studyportal` and `ANDROID_SHA256=<the SHA-256 from assetlinks.json>`, then redeploy.
   The site then serves `/.well-known/assetlinks.json`, which makes Android trust the app and hide the browser bar.
5. Optional: upload the `.aab` from the same zip to Google Play (internal testing track) so updates install like any app.

## What the app adds

- **Notifications that arrive with the phone locked**: the existing browser push (VAPID) works inside the app once each
  person turns notifications on (kids: Me → Reminders; parents: More → You).
- **Device dimension**: each session the app reports platform, whether it runs from the icon or a browser tab, screen,
  battery level and charging, network type, language and timezone. Parents see it on the Kids page. `app_installed_at`
  marks the first launch from the icon.
- **Home-screen shortcuts**: Today, Snaps and Parent home from a long press on the icon.
- **Offline note** instead of a browser error when the connection drops.

## Next step, when needed: a native shell (Capacitor)

A TWA cannot read anything the browser cannot. Two things need a native shell:

- **Screen time / app usage** (to verify "phone parked by the agreed hour"): Android `UsageStatsManager` through a
  Capacitor plugin, with the usage-access permission granted once on the boy's phone.
- **Background location** without the app open.

That is a separate `apps/android` project with `@capacitor/android`, built with Gradle; the web app stays the same and is
loaded from the site (`server.url`), so it also updates on every deploy.
