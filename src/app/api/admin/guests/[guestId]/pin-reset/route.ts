import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateFirebaseRequest,
  createAuditLogFields,
  createFirestoreDocument,
  firestoreString,
  getFirestoreDocument,
  hashSecret,
  patchFirestoreDocument,
  toFirestoreString,
  toFirestoreTimestamp
} from "@/lib/firebase/serverApi";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ guestId: string }>;
};

type PinResetRequest = {
  newPin?: unknown;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const authUser = await authenticateFirebaseRequest(request);

  if (!authUser) {
    return NextResponse.json({ message: "認証情報がありません。" }, { status: 401 });
  }

  const { guestId } = await context.params;
  const guestDocument = await getFirestoreDocument({
    idToken: authUser.idToken,
    collection: "guests",
    documentId: guestId
  });

  if (!guestDocument || firestoreString(guestDocument.fields, "ownerUid") !== authUser.uid) {
    return NextResponse.json({ message: "招待者を表示できません。" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as PinResetRequest | null;
  const newPin = typeof body?.newPin === "string" ? body.newPin.trim() : "";

  if (!/^\d{4}$/.test(newPin)) {
    return NextResponse.json(
      { message: "PINは4桁の数字で入力してください。" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  await patchFirestoreDocument({
    idToken: authUser.idToken,
    collection: "guests",
    documentId: guestId,
    fields: {
      pinHash: toFirestoreString(hashSecret(newPin)),
      pinResetAt: toFirestoreTimestamp(now),
      pinResetByUid: toFirestoreString(authUser.uid),
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
      action: "admin_pin_reset",
      targetType: "guest",
      targetId: guestId,
      summary: `${firestoreString(guestDocument.fields, "nickname")} のPINをリセット`,
      now
    })
  });

  return NextResponse.json({ guestId });
}
