import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateFirebaseRequest,
  createAuditLogFields,
  createFirestoreDocument,
  firestoreString,
  getFirestoreDocument,
  patchFirestoreDocument,
  toFirestoreNullableString,
  toFirestoreString,
  toFirestoreTimestamp
} from "@/lib/firebase/serverApi";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ responseId: string }>;
};

type UpdateResponseRequest = {
  attendanceStatus?: unknown;
  comment?: unknown;
};

const attendanceStatuses = ["yes", "maybe", "no"] as const;

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authUser = await authenticateFirebaseRequest(request);

  if (!authUser) {
    return NextResponse.json({ message: "認証情報がありません。" }, { status: 401 });
  }

  const { responseId } = await context.params;
  const responseDocument = await getFirestoreDocument({
    idToken: authUser.idToken,
    collection: "responses",
    documentId: responseId
  });

  if (
    !responseDocument ||
    firestoreString(responseDocument.fields, "ownerUid") !== authUser.uid ||
    responseDocument.fields?.isActive?.booleanValue === false
  ) {
    return NextResponse.json({ message: "回答を表示できません。" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as UpdateResponseRequest | null;
  const validation = validateUpdateResponseRequest(body);

  if (!validation.ok) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  const now = new Date().toISOString();
  await patchFirestoreDocument({
    idToken: authUser.idToken,
    collection: "responses",
    documentId: responseId,
    fields: {
      attendanceStatus: toFirestoreString(validation.attendanceStatus),
      comment: toFirestoreNullableString(validation.comment || null),
      isActive: { booleanValue: true },
      answeredAt: toFirestoreTimestamp(now),
      lastUpdatedBy: toFirestoreString("admin"),
      lastUpdatedByUid: toFirestoreString(authUser.uid),
      updatedAt: toFirestoreTimestamp(now)
    }
  });
  await createFirestoreDocument({
    idToken: authUser.idToken,
    collection: "auditLogs",
    documentId: randomUUID(),
    fields: createAuditLogFields({
      ownerUid: authUser.uid,
      actorUid: authUser.uid,
      action: "admin_response_update",
      targetType: "response",
      targetId: responseId,
      summary: "回答を管理者として修正",
      now
    })
  });

  return NextResponse.json({ responseId });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authUser = await authenticateFirebaseRequest(request);

  if (!authUser) {
    return NextResponse.json({ message: "認証情報がありません。" }, { status: 401 });
  }

  const { responseId } = await context.params;
  const responseDocument = await getFirestoreDocument({
    idToken: authUser.idToken,
    collection: "responses",
    documentId: responseId
  });

  if (
    !responseDocument ||
    firestoreString(responseDocument.fields, "ownerUid") !== authUser.uid ||
    responseDocument.fields?.isActive?.booleanValue === false
  ) {
    return NextResponse.json({ message: "回答を表示できません。" }, { status: 404 });
  }

  const now = new Date().toISOString();
  await patchFirestoreDocument({
    idToken: authUser.idToken,
    collection: "responses",
    documentId: responseId,
    fields: {
      isActive: { booleanValue: false },
      lastUpdatedBy: toFirestoreString("admin"),
      lastUpdatedByUid: toFirestoreString(authUser.uid),
      updatedAt: toFirestoreTimestamp(now)
    }
  });
  await createFirestoreDocument({
    idToken: authUser.idToken,
    collection: "auditLogs",
    documentId: randomUUID(),
    fields: createAuditLogFields({
      ownerUid: authUser.uid,
      actorUid: authUser.uid,
      action: "admin_response_delete",
      targetType: "response",
      targetId: responseId,
      summary: "回答を削除",
      now
    })
  });

  return NextResponse.json({ responseId });
}

function validateUpdateResponseRequest(body: UpdateResponseRequest | null):
  | {
      ok: true;
      attendanceStatus: (typeof attendanceStatuses)[number];
      comment: string;
    }
  | { ok: false; message: string } {
  if (!body) {
    return { ok: false, message: "入力内容が正しくありません。" };
  }

  const attendanceStatus =
    typeof body.attendanceStatus === "string" ? body.attendanceStatus : "";
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";

  if (!attendanceStatuses.includes(attendanceStatus as never)) {
    return { ok: false, message: "出欠を選択してください。" };
  }

  if (comment.length > 500) {
    return { ok: false, message: "コメントは500文字以内で入力してください。" };
  }

  return {
    ok: true,
    attendanceStatus: attendanceStatus as (typeof attendanceStatuses)[number],
    comment
  };
}
