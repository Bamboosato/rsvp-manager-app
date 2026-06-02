import { pbkdf2Sync, randomBytes } from "crypto";
import { NextRequest } from "next/server";

type FirebaseLookupResponse = {
  users?: Array<{
    localId: string;
    email?: string;
  }>;
};

export type AuthenticatedFirebaseUser = {
  uid: string;
  email: string | null;
  idToken: string;
};

export type FirestoreFieldValue = {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  nullValue?: null;
};

export type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreFieldValue>;
  createTime?: string;
  updateTime?: string;
};

export type FirestoreRunQueryRow = {
  document?: FirestoreDocument;
};

const secretHashIterations = 120000;

export function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function authenticateFirebaseRequest(
  request: NextRequest
): Promise<AuthenticatedFirebaseUser | null> {
  const idToken = getBearerToken(request);
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!idToken || !firebaseApiKey) {
    return null;
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as FirebaseLookupResponse;
  const user = data.users?.[0];

  if (!user?.localId) {
    return null;
  }

  return {
    uid: user.localId,
    email: user.email ?? null,
    idToken
  };
}

export function getRequiredFirebaseProjectId() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
  }

  return projectId;
}

export function getFirestoreDocumentsUrl(projectId = getRequiredFirebaseProjectId()) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

export async function runFirestoreQuery({
  idToken,
  query
}: {
  idToken: string;
  query: unknown;
}) {
  const response = await fetch(`${getFirestoreDocumentsUrl()}:runQuery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(query)
  });

  if (!response.ok) {
    throw new Error(`Firestore query failed: ${response.status}`);
  }

  return (await response.json()) as FirestoreRunQueryRow[];
}

export async function getFirestoreDocument({
  idToken,
  collection,
  documentId
}: {
  idToken: string;
  collection: string;
  documentId: string;
}) {
  const response = await fetch(
    `${getFirestoreDocumentsUrl()}/${collection}/${encodeURIComponent(documentId)}`,
    {
      headers: {
        Authorization: `Bearer ${idToken}`
      }
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Firestore document read failed: ${response.status}`);
  }

  return (await response.json()) as FirestoreDocument;
}

export async function createFirestoreDocument({
  idToken,
  collection,
  documentId,
  fields
}: {
  idToken: string;
  collection: string;
  documentId: string;
  fields: Record<string, FirestoreFieldValue>;
}) {
  const response = await fetch(
    `${getFirestoreDocumentsUrl()}/${collection}?documentId=${encodeURIComponent(documentId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields })
    }
  );

  if (!response.ok) {
    throw new Error(`Firestore document create failed: ${response.status}`);
  }

  return (await response.json()) as FirestoreDocument;
}

export async function patchFirestoreDocument({
  idToken,
  collection,
  documentId,
  fields
}: {
  idToken: string;
  collection: string;
  documentId: string;
  fields: Record<string, FirestoreFieldValue>;
}) {
  const updateMask = Object.keys(fields)
    .map((fieldPath) => `updateMask.fieldPaths=${encodeURIComponent(fieldPath)}`)
    .join("&");
  const response = await fetch(
    `${getFirestoreDocumentsUrl()}/${collection}/${encodeURIComponent(documentId)}?${updateMask}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields })
    }
  );

  if (!response.ok) {
    throw new Error(`Firestore document update failed: ${response.status}`);
  }

  return (await response.json()) as FirestoreDocument;
}

export function toFirestoreString(value: string): FirestoreFieldValue {
  return { stringValue: value };
}

export function toFirestoreNullableString(value: string | null): FirestoreFieldValue {
  return value === null ? { nullValue: null } : { stringValue: value };
}

export function toFirestoreTimestamp(value: string): FirestoreFieldValue {
  return { timestampValue: value };
}

export function firestoreString(
  fields: Record<string, FirestoreFieldValue> | undefined,
  key: string
) {
  return fields?.[key]?.stringValue ?? "";
}

export function firestoreNullableString(
  fields: Record<string, FirestoreFieldValue> | undefined,
  key: string
) {
  if (!fields || !fields[key] || "nullValue" in fields[key]) {
    return null;
  }

  return fields[key].stringValue ?? null;
}

export function firestoreBoolean(
  fields: Record<string, FirestoreFieldValue> | undefined,
  key: string
) {
  return fields?.[key]?.booleanValue ?? false;
}

export function firestoreTimestamp(
  fields: Record<string, FirestoreFieldValue> | undefined,
  key: string
) {
  return fields?.[key]?.timestampValue ?? null;
}

export function normalizeNickname(rawNickname: string) {
  return rawNickname
    .trim()
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0xfee0)
    )
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(
    secret,
    salt,
    secretHashIterations,
    32,
    "sha256"
  ).toString("base64url");

  return `pbkdf2_sha256$${secretHashIterations}$${salt}$${hash}`;
}

export function verifySecret(secret: string, storedHash: string) {
  const [algorithm, iterationsText, salt, hash] = storedHash.split("$");
  const iterations = Number(iterationsText);

  if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !hash) {
    return false;
  }

  const candidateHash = pbkdf2Sync(
    secret,
    salt,
    iterations,
    32,
    "sha256"
  ).toString("base64url");

  return candidateHash === hash;
}

export function createAuditLogFields({
  ownerUid,
  actorUid,
  action,
  targetType,
  targetId,
  summary,
  now
}: {
  ownerUid: string;
  actorUid: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  now: string;
}) {
  return {
    ownerUid: toFirestoreString(ownerUid),
    actorType: toFirestoreString("admin"),
    actorUid: toFirestoreString(actorUid),
    action: toFirestoreString(action),
    targetType: toFirestoreString(targetType),
    targetId: toFirestoreString(targetId),
    summary: toFirestoreString(summary),
    createdAt: toFirestoreTimestamp(now)
  };
}
