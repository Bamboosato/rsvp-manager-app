# RSVP Hub

イベント参加者調整AppのMVP実装リポジトリです。

## Tech Stack

- Next.js App Router
- TypeScript
- Firebase / Firestore
- Firebase Cloud Messaging
- Vercel

## Setup

Use Node.js 22 or later. Firebase Admin SDK 14 and its Firestore/Storage
dependencies require Node.js 22 or later; use a supported Node.js version in
both local development and the deployment environment.

```bash
npm install
```

Create `.env.local` from `.env.example` and set the Firebase Web App values.
Invite APIs also require Firebase Admin SDK server credentials.
The canonical production URL is `https://rsvphub.bamboosato.com`.

```bash
cp .env.example .env.local
```

Required values:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
- `NEXT_PUBLIC_APP_BASE_URL`
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `INVITE_SESSION_SECRET`

`NEXT_PUBLIC_FIREBASE_VAPID_KEY` is the Web Push certificate public key from
Firebase Console > Cloud Messaging.
Set `NEXT_PUBLIC_APP_BASE_URL` to `https://rsvphub.bamboosato.com` in production
so shared invite URLs and notification links use the custom domain. Leave it
blank for local development to use the current browser origin.

Production domain checklist:

- Vercel project domain: `rsvphub.bamboosato.com`
- Vercel Production environment variable:
  `NEXT_PUBLIC_APP_BASE_URL=https://rsvphub.bamboosato.com`
- Firebase Authentication Authorized domains:
  `rsvphub.bamboosato.com`

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm test
npm run test:security
npm run audit:security
npm run test:sdk
npm run build:ci
npm run test:e2e -- --workers=1
```

## CI and Dependency Security

GitHub Actions checks main pull requests and pushes with Node.js 24: lint,
typecheck, unit/API tests, build, Chromium E2E, dependency audits, and Firebase
Web/Admin SDK smoke tests against local Auth/Firestore/Storage emulators.
A weekly audit runs on Mondays at 07:00 JST. Dependabot proposes weekly npm and
GitHub Actions updates; updates are not automatically merged.

Any production vulnerability fails the audit. Development vulnerabilities require
an exact, time-limited exception; critical vulnerabilities cannot be excepted.
Audit failures and malformed responses fail the check too. JSON reports and
failure evidence are retained for 14 days.

Node.js 24 and npm 11.19.0 are recommended (minimum Node 22.12); emulator checks require Java 21.
E2E uses a dummy Firebase build and mocked APIs, with one Chromium worker.
Use `npm run build:ci` before E2E, and install Chromium with
`npx --no-install playwright install chromium`. Do not deploy the dummy build.

See [CI operations](docs/ci-operations.md) for dependency overrides, the current
development exception expiry, and required checks. See
[test scope and prerequisites](tests/README.md) for coverage and limitations.

## Firebase

Firestore Rules and indexes are managed in this repository.

```bash
npx firebase deploy --only firestore:rules,firestore:indexes
```

## Maintenance

Developer-only Firestore cleanup commands are available for small, explicit
maintenance tasks. The plan cleanup command is dry-run by default.

```bash
npm run maintenance:delete-plan -- --planId <planId>
```

To physically delete matching documents:

```bash
npm run maintenance:delete-plan -- --planId <planId> --execute
```

The command deletes related documents in this order:

1. `responses`
2. `guests`
3. `events`
4. `plans`

`auditLogs` are reported but kept by default. Add `--include-audit-logs` only
when cleaning disposable test data. Active plans require `--force-active` when
using `--execute`.

## Documents

- `docs/mvp-requirements.md`
- `docs/system-design.md`
- `docs/screen-specification.md`

## Current Scope

The current implementation includes Firebase Authentication entry points, Firestore-backed plan and event management, admin response management, PIN reset, the invitee response flow, PWA manifest/service worker support, and Firebase Cloud Messaging push notifications for invitee response updates.
