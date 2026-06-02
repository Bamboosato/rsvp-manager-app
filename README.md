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

The current implementation includes the Next.js foundation, Firebase Authentication entry points, Firestore-backed plan listing, plan creation, and plan disabling. Event management, invitation flows, and push notifications will be implemented in later steps.
