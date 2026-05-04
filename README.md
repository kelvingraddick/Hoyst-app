# Hoyst-app
iOS, Android, and macOS app for the Hoyst accountability platform

## Firebase backend

This repo uses the Firebase CLI from the root `node_modules`, pinned through `firebase-tools`.

The default Firebase project is `hoyst-firebase-app`. Function sources live in `functions/src` and compile to `functions/lib`.

### Auth setup

Hoyst uses Firebase Auth as the account source of truth and Firestore profile
documents to decide whether a signed-in user can take protected actions.

Current Firebase project status:

- Firebase Auth is initialized as Identity Platform.
- Email/password and Phone are enabled.
- Apple and Google providers are enabled.
- Phone SMS is restricted to the US region allowlist.
- Firestore is live in `nam5`.
- Storage is live at `hoyst-firebase-app.firebasestorage.app`.
- Firestore and Storage rules are deployed from this repo.
- Cloud Functions are deployed in `us-central1` on `nodejs22`.
- Android debug SHA-1 and SHA-256 fingerprints are registered for Google sign-in.

Local app env values live in `.env`, which is intentionally ignored by git.
For a fresh install, copy `.env.example` to `.env` and replace each placeholder
with the Firebase and service values for the Hoyst project:

```sh
cp .env.example .env
```

The local `.env` should define:

```sh
APP_ENV=development
GOOGLE_WEB_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=your-google-ios-client-id.apps.googleusercontent.com
GOOGLE_REVERSED_CLIENT_ID=com.googleusercontent.apps.your-google-ios-client-id
ONESIGNAL_APP_ID=your-onesignal-app-id
SENTRY_DSN=your-sentry-dsn
```

`src/config/env.ts` reads these values through `react-native-config`; it does
not provide hardcoded Google client ID fallbacks. Keep optional services blank
in `.env` until they are ready to receive local app events.

Do not put backend-only credentials in `.env`. Cloud Functions secrets such as
email provider API keys or push notification REST API keys should be set as
Firebase Functions secrets, not committed to this repo and not bundled into the
mobile app.

Google native app config is intentionally kept out of git. On a fresh machine,
download the Firebase app config files from the Firebase console or restore
them from a secure backup, then place them at:

- `android/app/google-services.json`
- `ios/GoogleService-Info.plist`

After adding those files locally, rebuild the native app. The iOS project
already references `ios/GoogleService-Info.plist` through
`ios/Hoyst.xcodeproj/project.pbxproj`.

Auth and account backend entry points:

- `completeProfile`: reserves the immutable handle and creates `users/{uid}` and
  `userPrivate/{uid}`.
- `createCircle`: creates a circle and owner membership.
- `joinCircle`: joins open circles or creates request-to-join records.
- `submitTapIn`: enforces one Tap In per active member per circle day.
