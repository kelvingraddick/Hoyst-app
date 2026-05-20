# Hoyst MVP Plan

## Summary
- App name: `Hoyst`
- iOS bundle ID: `com.wavelinkllc.hoyst`
- Android application ID: `com.wavelinkllc.hoyst`
- Branding source of truth is [`design-guide/DESIGN-SYSTEM.md`](/Users/kelvin/Code/Hoyst-app/design-guide/DESIGN-SYSTEM.md) plus the cleaned asset set in [`design-guide`](/Users/kelvin/Code/Hoyst-app/design-guide).
- The new white assets close the last dark-surface branding gap, so the branding plan is now implementation-ready.

## 1. Repo audit summary
- The repo is still greenfield and only contains [`design-guide`](/Users/kelvin/Code/Hoyst-app/design-guide).
- Current brand assets are:
  - `Ring.png`
  - `Icon black.png`
  - `Icon white.png`
  - `Logo black.png`
  - `Logo white.png`
- Supporting design assets remain:
  - [`design-guide/DESIGN-SYSTEM.md`](/Users/kelvin/Code/Hoyst-app/design-guide/DESIGN-SYSTEM.md)
  - four mockup/reference PNGs
- There is still no app scaffold yet: no `package.json`, no `ios/`, no `android/`, no `src/`, and no `functions/`.

## 2. Design-guide summary
- Brand tone from [`design-guide/DESIGN-SYSTEM.md`](/Users/kelvin/Code/Hoyst-app/design-guide/DESIGN-SYSTEM.md#L3): premium, calm but energized, minimal but expressive, modern iOS-inspired, tactile, slightly playful.
- Logo system from [`design-guide/DESIGN-SYSTEM.md`](/Users/kelvin/Code/Hoyst-app/design-guide/DESIGN-SYSTEM.md#L20) is now concretely backed by the new files:
  - `Ring.png` for full-color gradient ring treatments
  - `Icon white.png` for dark surfaces and dark-mode-primary product branding
  - `Icon black.png` for light surfaces and docs
  - `Logo white.png` for dark hero surfaces, onboarding, and splash moments
  - `Logo black.png` for light surfaces, docs, and export-safe neutral uses
- Color and gradient system from [`design-guide/DESIGN-SYSTEM.md`](/Users/kelvin/Code/Hoyst-app/design-guide/DESIGN-SYSTEM.md#L45) stays unchanged:
  - green `#3BAF4A`
  - orange `#FF8A3D`
  - red `#E5483D`
  - purple `#8B6CFF`
  - charcoal `#1F2933`
  - gray `#9CA3AF`
  - white `#FFFFFF`
  - near-black background `#0B0B0C`
- Glass, layout, typography, and motion guidance also stay unchanged:
  - dark mode is primary
  - translucent glass cards with radius `20-28`
  - spacing scale `4, 8, 12, 16, 20, 24, 32`
  - short human copy
  - subtle motion only
- Practical usage update:
  - default to white logo/icon assets inside the app because dark mode is the visual lead
  - use black variants only on light backgrounds
  - use `Ring.png` for ring decoration, streak visuals, avatar accents, and branded CTA treatments
- Feasibility note: use real blur/material on iOS and simulated glass on Android; treat liquid-glass as a visual style target, not a literal API requirement.

## 3. Recommended architecture
- Bare React Native CLI + TypeScript with one mobile app package and one `functions/` package.
- Canonical MVP tabs remain `Home`, `Circles`, `Explore`, `Inbox`, `Profile`.
- `Tap-In` remains the dominant Home hero CTA and a secondary action in circle detail.
- Create-circle remains a modal flow launched from Circles, not a tab.
- Folder layout:
  - `src/app`
  - `src/navigation`
  - `src/design`
  - `src/features`
  - `src/lib`
  - `src/store`
  - `src/types`
  - `src/utils`
  - `functions/src`
- Keep all brand asset selection in `src/design/brand` so dark/light asset swapping is centralized and not hardcoded across screens.

## 4. Recommended libraries and why
- App shell:
  - React Navigation stack + tabs
  - `react-native-screens`
  - `react-native-safe-area-context`
  - `react-native-gesture-handler`
- Styling and graphics:
  - `nativewind@4`
  - `tailwindcss`
  - `react-native-svg`
  - `react-native-linear-gradient`
- State and data:
  - `zustand`
  - `@tanstack/react-query`
- Forms and validation:
  - `react-hook-form`
  - `zod`
  - `@hookform/resolvers`
- Backend and auth:
  - `@react-native-firebase/app`
  - `@react-native-firebase/auth`
  - `@react-native-firebase/firestore`
  - `@react-native-firebase/functions`
  - `@react-native-firebase/storage`
  - `@invertase/react-native-apple-authentication`
  - `@react-native-google-signin/google-signin`
- Media, motion, glass, services:
  - `react-native-image-picker`
  - `luxon`
  - `react-native-reanimated@3`
  - `@react-native-community/blur`
  - `lucide-react-native`
  - `react-native-onesignal`
  - `@sentry/react-native`
  - `react-native-config`
- Functions:
  - `firebase-functions`
  - `firebase-admin`
  - `resend`
  - `react-email`
  - `@sentry/node`

## 5. Firestore/data model proposal
- `users/{uid}`: immutable `handle`, public profile, avatar URL, bio, timezone.
- `userPrivate/{uid}`: notification settings, device data, inbox summary, private app state.
- `handles/{normalizedHandle}`: uniqueness reservation.
- `circles/{circleId}`: title, category, daily task, privacy, join mode, discovery settings, timezone, max size, grace rules, owner, member count.
- `publicCircleIndex/{circleId}`: public Explore projection only. MVP Explore stays pure public-circle discovery.
- `circles/{circleId}/members/{uid}`: role, membership status, per-circle prefs, streak summary, grace ledger.
- `circles/{circleId}/invites/{inviteId}` and `joinRequests/{uid}`: invite and approval flows.
- `circles/{circleId}/days/{dateKey}` and `checkIns/{uid}`: canonical day model and one-check-in-per-user-per-day enforcement.
- `messages/{messageId}` and `reactions/{uid}`: text chat and emoji reactions.
- `nudgeEvents/{eventId}`: immutable nudge audit trail.
- Storage:
  - `users/{uid}/avatar/{fileId}`
  - `circles/{circleId}/check-ins/{dateKey}/{uid}/{fileId}`
- Accountability photos persist indefinitely in MVP.

## 6. Cloud Functions responsibilities
- Signup completion and handle reservation.
- Circle creation and settings changes.
- Invite generation, redemption, request-to-join, approval, rejection.
- Role-sensitive membership actions for owner/admin/member flows.
- Check-in validation, grace evaluation, streak updates, and day-summary updates.
- Nudge validation and server-side rate limiting.
- Notification fan-out for messages, mentions, nudges, reminders, day summaries, weekly summaries.
- Resend email delivery and public-circle index syncing.
- Repair utilities for derived streak and summary state.

## 7. Security rules approach
- Use Firestore Rules v2 from day one.
- Keep sensitive writes in callable functions.
- Allow direct client writes only for low-risk self-owned paths such as profile edits excluding handle changes, notification settings, own messages, and own reactions.
- Restrict circle internals, chat, check-ins, and accountability photos to active members.
- Restrict `publicCircleIndex` to public-safe data only.
- Storage rules:
  - avatar write by owner only
  - accountability photo write by owning member only
  - accountability photo read by active circle members only

## 8. MVP milestone plan
- Foundation: bootstrap RN app, native config, Firebase base wiring, env config, Sentry baseline.
- Design system: tokens, semantic theme, glass surfaces, gradient ring primitive, white/black logo asset wrapper, tab chrome, button/card/input/avatar primitives.
- Auth and profile: email/Apple/Google auth, immutable handle onboarding, timezone capture, avatar upload.
- Circles and discovery: create circle, public Explore, invite/request-to-join flows, owner/admin/member controls.
- Home and check-ins: Home hero Tap-In CTA, today summary, note/photo check-ins, grace and streak surfaces.
- Chat, nudges, inbox, notifications: text chat, reactions, mentions, nudges, inbox center, push and email hooks.
- Polish and release prep: accessibility, dark/light QA, crash monitoring, release assets, app icon pipeline.
- Core acceptance tests: duplicate handle rejection, join-mode flows, timezone cutoffs, rolling 7-day grace use, duplicate check-in rejection, nudge cooldowns, message mentions, photo upload access control, dark/light brand rendering.

## 9. Local/dev setup checklist
- Bootstrap the app as `Hoyst` with `com.wavelinkllc.hoyst`.
- Install Node 20+, Watchman, Xcode, CocoaPods, Android Studio, JDK 17.
- Create Firebase dev and prod projects and register the iOS and Android apps.
- Add `GoogleService-Info.plist` and `google-services.json`.
- Enable Firebase Auth, Firestore, Storage, and Functions.
- Configure Apple Sign In, Google Sign In, OneSignal, Sentry, and Resend.
- Set app env vars such as `APP_ENV`, `GOOGLE_WEB_CLIENT_ID`, `ONESIGNAL_APP_ID`, `SENTRY_DSN`.
- Set Functions secrets such as `RESEND_API_KEY` and `ONESIGNAL_REST_API_KEY`.
- Reference docs during implementation:
  - React Native: https://reactnative.dev/docs/getting-started
  - React Navigation: https://reactnavigation.org/docs/getting-started/
  - React Native Firebase: https://rnfirebase.io/
  - OneSignal: https://documentation.onesignal.com/docs/react-native-sdk-setup
  - Sentry: https://docs.sentry.io/platforms/react-native/

## 10. Open questions
- No blocking product or branding questions remain for the MVP plan.
- Optional future improvements only:
  - SVG/vector exports for crisper scaling
  - future contact-based or social recommendations in Explore, explicitly outside MVP

## 11. Proposed initial scaffold changes
- Root config files:
  - `package.json`
  - `tsconfig.json`
  - `babel.config.js`
  - `metro.config.js`
  - `tailwind.config.js`
  - `nativewind-env.d.ts`
  - ESLint and Prettier config
  - `.editorconfig`
  - `.gitignore`
  - `README.md`
- Native shell:
  - `ios/`
  - `android/`
  - `index.js`
  - `App.tsx`
- App structure:
  - `src/app`
  - `src/navigation`
  - `src/design`
  - `src/features`
  - `src/lib`
  - `src/store`
  - `src/types`
  - `src/utils`
- Brand and design-system foundations:
  - `src/design/brand/assets.ts` to map `Ring.png`, `Icon white.png`, `Icon black.png`, `Logo white.png`, `Logo black.png`
  - `src/design/brand/usage.ts` to define where each asset is used by theme/background context
  - `src/design/tokens/colors.ts`
  - `src/design/tokens/gradients.ts`
  - `src/design/tokens/spacing.ts`
  - `src/design/tokens/radius.ts`
  - `src/design/tokens/shadows.ts`
  - `src/design/tokens/typography.ts`
  - `src/design/tokens/glass.ts`
  - primitives for `Screen`, `Text`, `Button`, `GlassPanel`, `GradientRing`, `Avatar`, `Input`, `TabBar`, `CircleCard`
- Service wrappers:
  - `src/lib/firebase/{app,auth,firestore,functions,storage}.ts`
  - `src/lib/notifications`
  - `src/lib/monitoring`
  - `src/config/env.ts`
- Navigation skeleton:
  - root navigator
  - auth stack
  - main tabs for `Home/Circles/Explore/Inbox/Profile`
  - modal routes for create-circle and invite/join flows
- Base contracts and placeholder screens:
  - `src/types/models.ts`
  - `src/types/firestore.ts`
  - feature schemas and service stubs
  - placeholder screens only
- Functions scaffold:
  - `functions/src/index.ts`
  - `auth`
  - `circles`
  - `checkins`
  - `notifications`
  - `emails`
  - `shared`
- Scaffold assumptions:
  - use [`design-guide/DESIGN-SYSTEM.md`](/Users/kelvin/Code/Hoyst-app/design-guide/DESIGN-SYSTEM.md) over earlier inferred color choices where they differ
  - use white logo/icon assets by default on dark product surfaces
  - use black logo/icon assets on light surfaces only
  - keep `Ring.png` as the decorative gradient ring source for avatars, streaks, and branded CTA treatments
  - keep dark mode as the primary visual target
  - keep Explore limited to public-circle discovery in MVP
  - keep handles immutable, owner/admin/member roles only, and indefinite photo retention
