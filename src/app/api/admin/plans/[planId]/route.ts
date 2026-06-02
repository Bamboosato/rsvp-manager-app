import { NextRequest, NextResponse } from "next/server";
import {
  authenticateFirebaseRequest,
  firestoreString,
  getFirestoreDocument,
  hashSecret,
  patchFirestoreDocument,
  toFirestoreNullableString,
  toFirestoreString,
  toFirestoreTimestamp,
  type FirestoreFieldValue
} from "@/lib/firebase/serverApi";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ planId: string }>;
};

type UpdatePlanRequest = {
  name?: unknown;
  yearMonth?: unknown;
  accessCode?: unknown;
  clearAccessCode?: unknown;
  password?: unknown;
  clearPassword?: unknown;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authUser = await authenticateFirebaseRequest(request);

  if (!authUser) {
    return NextResponse.json({ message: "認証情報がありません。" }, { status: 401 });
  }

  const { planId } = await context.params;
  const plan = await getFirestoreDocument({
    idToken: authUser.idToken,
    collection: "plans",
    documentId: planId
  });

  if (!plan || firestoreString(plan.fields, "ownerUid") !== authUser.uid) {
    return NextResponse.json({ message: "プランを表示できません。" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as UpdatePlanRequest | null;
  const validation = validateUpdatePlanRequest(body);

  if (!validation.ok) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  const now = new Date().toISOString();
  const fields: Record<string, FirestoreFieldValue> = {
    name: toFirestoreString(validation.name),
    yearMonth: toFirestoreString(validation.yearMonth),
    updatedAt: toFirestoreTimestamp(now)
  };

  if (validation.clearAccessCode) {
    fields.passwordHash = toFirestoreNullableString(null);
  } else if (validation.accessCode) {
    fields.passwordHash = toFirestoreString(hashSecret(validation.accessCode));
  }

  try {
    await patchFirestoreDocument({
      idToken: authUser.idToken,
      collection: "plans",
      documentId: planId,
      fields
    });
  } catch (error) {
    console.error("Failed to update plan.", error);
    return NextResponse.json({ message: "プランの更新に失敗しました。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function validateUpdatePlanRequest(body: UpdatePlanRequest | null):
  | {
      ok: true;
      name: string;
      yearMonth: string;
      accessCode: string | null;
      clearAccessCode: boolean;
    }
  | { ok: false; message: string } {
  if (!body) {
    return { ok: false, message: "入力内容が正しくありません。" };
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const yearMonth = typeof body.yearMonth === "string" ? body.yearMonth.trim() : "";
  const accessCode =
    typeof body.accessCode === "string"
      ? body.accessCode.trim()
      : typeof body.password === "string"
        ? body.password.trim()
        : "";
  const clearAccessCode = body.clearAccessCode === true || body.clearPassword === true;

  if (!name) {
    return { ok: false, message: "プラン名を入力してください。" };
  }

  if (name.length > 80) {
    return { ok: false, message: "プラン名は80文字以内で入力してください。" };
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
    return { ok: false, message: "年月を選択してください。" };
  }

  if (clearAccessCode && accessCode.length > 0) {
    return {
      ok: false,
      message: "アクセスコードを解除する場合は、新しいアクセスコードを空にしてください。"
    };
  }

  if (accessCode && !/^\d{6,12}$/.test(accessCode)) {
    return { ok: false, message: "アクセスコードは6〜12桁の数字で入力してください。" };
  }

  return {
    ok: true,
    name,
    yearMonth,
    accessCode: accessCode.length > 0 ? accessCode : null,
    clearAccessCode
  };
}
