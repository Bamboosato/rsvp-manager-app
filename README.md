# RSVP Hub

イベント参加者調整AppのMVP実装リポジトリです。

## Tech Stack

- Next.js App Router
- TypeScript
- Firebase / Firestore
- Firebase Cloud Messaging
- Vercel

## Setup

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
```

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
