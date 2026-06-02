# RSVP Manager App

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
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `INVITE_SESSION_SECRET`

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

## Documents

- `docs/mvp-requirements.md`
- `docs/system-design.md`
- `docs/screen-specification.md`

## Current Scope

The current implementation includes Firebase Authentication entry points, Firestore-backed plan and event management, admin response management, PIN reset, and the invitee response flow. Push notifications are still pending.
