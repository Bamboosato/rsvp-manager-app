import { pbkdf2Sync, randomBytes, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type FirebaseLookupResponse = {
  users?: Array<{
    localId: string;
    email?: string;
  }>;
};

type CreatePlanRequest = {
  name?: unknown;
  yearMonth?: unknown;
  password?: unknown;
};

type FirestoreRunQueryRow = {
  document?: unknown;
};

const maxActivePlans = 3;
const passwordHashIterations = 120000;

export async function POST(request: NextRequest) {
  const idToken = getBearerToken(request);

  if (!idToken) {
    return NextResponse.json({ message: "認証情報がありません。" }, { status: 401 });
  }

  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!firebaseApiKey || !projectId) {
    return NextResponse.json(
      { message: "Firebase設定が不足しています。" },
      { status: 500 }
    );
  }

  const authUser = await verifyFirebaseIdToken(idToken, firebaseApiKey);

  if (!authUser) {
    return NextResponse.json({ message: "認証情報が無効です。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CreatePlanRequest | null;
  const validation = validateCreatePlanRequest(body);

  if (!validation.ok) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  let activePlanCount: number;

  try {
    activePlanCount = await countActivePlans({
      idToken,
      ownerUid: authUser.uid,
      projectId
    });
  } catch {
    return NextResponse.json(
      { message: "有効プラン数の確認に失敗しました。" },
      { status: 500 }
    );
  }

  if (activePlanCount >= maxActivePlans) {
    return NextResponse.json(
      { message: "有効プランは最大3件までです。" },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const planId = randomUUID();
  const publicToken = randomBytes(24).toString("base64url");
  const passwordHash = validation.password
    ? hashPlanPassword(validation.password)
    : null;

  const createResponse = await fetch(
    `${getFirestoreDocumentsUrl(projectId)}/plans?documentId=${encodeURIComponent(planId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: {
          planId: { stringValue: planId },
          ownerUid: { stringValue: authUser.uid },
          name: { stringValue: validation.name },
          yearMonth: { stringValue: validation.yearMonth },
          passwordHash: passwordHash
            ? { stringValue: passwordHash }
            : { nullValue: null },
          publicToken: { stringValue: publicToken },
          isActive: { booleanValue: true },
          createdAt: { timestampValue: now },
          updatedAt: { timestampValue: now }
        }
      })
    }
  );

  if (!createResponse.ok) {
    return NextResponse.json(
      { message: "プランの作成に失敗しました。" },
      { status: createResponse.status }
    );
  }

  return NextResponse.json(
    {
      plan: {
        id: planId,
        name: validation.name,
        yearMonth: validation.yearMonth,
        publicToken,
        isActive: true,
        createdAt: now
      }
    },
    { status: 201 }
  );
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function verifyFirebaseIdToken(idToken: string, firebaseApiKey: string) {
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
    email: user.email ?? null
  };
}

function validateCreatePlanRequest(body: CreatePlanRequest | null):
  | { ok: true; name: string; yearMonth: string; password: string | null }
  | { ok: false; message: string } {
  if (!body) {
    return { ok: false, message: "入力内容が正しくありません。" };
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const yearMonth =
    typeof body.yearMonth === "string" ? body.yearMonth.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!name) {
    return { ok: false, message: "プラン名を入力してください。" };
  }

  if (name.length > 80) {
    return { ok: false, message: "プラン名は80文字以内で入力してください。" };
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
    return { ok: false, message: "年月を選択してください。" };
  }

  if (password.length > 100) {
    return {
      ok: false,
      message: "プランパスワードは100文字以内で入力してください。"
    };
  }

  return {
    ok: true,
    name,
    yearMonth,
    password: password.length > 0 ? password : null
  };
}

async function countActivePlans({
  idToken,
  ownerUid,
  projectId
}: {
  idToken: string;
  ownerUid: string;
  projectId: string;
}) {
  const response = await fetch(`${getFirestoreDocumentsUrl(projectId)}:runQuery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "plans" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: "ownerUid" },
                  op: "EQUAL",
                  value: { stringValue: ownerUid }
                }
              },
              {
                fieldFilter: {
                  field: { fieldPath: "isActive" },
                  op: "EQUAL",
                  value: { booleanValue: true }
                }
              }
            ]
          }
        },
        limit: maxActivePlans
      }
    })
  });

  if (!response.ok) {
    throw new Error("Failed to count active plans.");
  }

  const rows = (await response.json()) as FirestoreRunQueryRow[];
  return rows.filter((row) => row.document).length;
}

function hashPlanPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(
    password,
    salt,
    passwordHashIterations,
    32,
    "sha256"
  ).toString("base64url");

  return `pbkdf2_sha256$${passwordHashIterations}$${salt}$${hash}`;
}

function getFirestoreDocumentsUrl(projectId: string) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}
