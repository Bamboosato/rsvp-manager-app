import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateFirebaseRequest,
  createAuditLogFields,
  createFirestoreDocument,
  firestoreBoolean,
  firestoreNullableString,
  firestoreString,
  firestoreTimestamp,
  getFirestoreDocument,
  hashSecret,
  normalizeNickname,
  runFirestoreQuery,
  toFirestoreNullableString,
  toFirestoreString,
  toFirestoreTimestamp,
  verifySecret,
  type FirestoreDocument,
  type FirestoreFieldValue
} from "@/lib/firebase/serverApi";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

type SaveResponseRequest = {
  nickname?: unknown;
  pin?: unknown;
  attendanceStatus?: unknown;
  comment?: unknown;
};

const attendanceStatuses = ["yes", "maybe", "no"] as const;

export async function GET(request: NextRequest, context: RouteContext) {
  const authUser = await authenticateFirebaseRequest(request);

  if (!authUser) {
    return NextResponse.json({ message: "認証情報がありません。" }, { status: 401 });
  }

  const { eventId } = await context.params;
  const event = await getOwnedEvent({
    idToken: authUser.idToken,
    eventId,
    ownerUid: authUser.uid
  });

  if (!event) {
    return NextResponse.json({ message: "イベントを表示できません。" }, { status: 404 });
  }

  const planDocument = await getFirestoreDocument({
    idToken: authUser.idToken,
    collection: "plans",
    documentId: event.planId
  });
  const plan =
    planDocument && firestoreString(planDocument.fields, "ownerUid") === authUser.uid
      ? {
          id: getDocumentId(planDocument.name),
          name: firestoreString(planDocument.fields, "name"),
          yearMonth: firestoreString(planDocument.fields, "yearMonth")
        }
      : null;

  const responseRows = await runFirestoreQuery({
    idToken: authUser.idToken,
    query: {
      structuredQuery: {
        from: [{ collectionId: "responses" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: "ownerUid" },
                  op: "EQUAL",
                  value: { stringValue: authUser.uid }
                }
              },
              {
                fieldFilter: {
                  field: { fieldPath: "eventId" },
                  op: "EQUAL",
                  value: { stringValue: eventId }
                }
              }
            ]
          }
        },
        orderBy: [
          {
            field: { fieldPath: "answeredAt" },
            direction: "DESCENDING"
          }
        ]
      }
    }
  });
  const responseDocuments = responseRows
    .map((row) => row.document)
    .filter((document): document is FirestoreDocument => Boolean(document));
  const guestIds = Array.from(
    new Set(responseDocuments.map((document) => firestoreString(document.fields, "guestId")))
  ).filter(Boolean);
  const guestMap = await getGuestMap({
    idToken: authUser.idToken,
    guestIds,
    ownerUid: authUser.uid
  });
  const responses = responseDocuments.map((document) => {
    const fields = document.fields;
    const guestId = firestoreString(fields, "guestId");
    const guest = guestMap.get(guestId);

    return {
      id: getDocumentId(document.name),
      responseId: firestoreString(fields, "responseId"),
      planId: firestoreString(fields, "planId"),
      eventId: firestoreString(fields, "eventId"),
      guestId,
      nickname: guest?.nickname ?? "(招待者名なし)",
      attendanceStatus: firestoreString(fields, "attendanceStatus"),
      comment: firestoreNullableString(fields, "comment") ?? "",
      answeredAt: firestoreTimestamp(fields, "answeredAt"),
      lastUpdatedBy: firestoreString(fields, "lastUpdatedBy"),
      lastUpdatedByUid: firestoreNullableString(fields, "lastUpdatedByUid")
    };
  });

  return NextResponse.json({
    event,
    plan,
    summary: countResponses(responses),
    responses
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authUser = await authenticateFirebaseRequest(request);

  if (!authUser) {
    return NextResponse.json({ message: "認証情報がありません。" }, { status: 401 });
  }

  const { eventId } = await context.params;
  const event = await getOwnedEvent({
    idToken: authUser.idToken,
    eventId,
    ownerUid: authUser.uid
  });

  if (!event || !event.isActive) {
    return NextResponse.json({ message: "イベントを表示できません。" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as SaveResponseRequest | null;
  const validation = validateSaveResponseRequest(body);

  if (!validation.ok) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  const nicknameKey = normalizeNickname(validation.nickname);
  const existingGuest = await findGuestByNicknameKey({
    idToken: authUser.idToken,
    ownerUid: authUser.uid,
    planId: event.planId,
    nicknameKey
  });

  let guestId: string;

  if (existingGuest) {
    if (!verifySecret(validation.pin, firestoreString(existingGuest.fields, "pinHash"))) {
      return NextResponse.json(
        { message: "同じニックネームは既に使用されています。" },
        { status: 409 }
      );
    }

    guestId = getDocumentId(existingGuest.name);
  } else {
    guestId = randomUUID();
    const now = new Date().toISOString();

    await createFirestoreDocument({
      idToken: authUser.idToken,
      collection: "guests",
      documentId: guestId,
      fields: {
        guestId: toFirestoreString(guestId),
        planId: toFirestoreString(event.planId),
        ownerUid: toFirestoreString(authUser.uid),
        nickname: toFirestoreString(validation.nickname),
        nicknameKey: toFirestoreString(nicknameKey),
        pinHash: toFirestoreString(hashSecret(validation.pin)),
        pinResetAt: { nullValue: null },
        pinResetByUid: { nullValue: null },
        createdAt: toFirestoreTimestamp(now),
        updatedAt: toFirestoreTimestamp(now)
      }
    });
  }

  const responseId = `${eventId}_${guestId}`;
  const now = new Date().toISOString();
  try {
    await createFirestoreDocument({
      idToken: authUser.idToken,
      collection: "responses",
      documentId: responseId,
      fields: createResponseFields({
        responseId,
        planId: event.planId,
        eventId,
        guestId,
        ownerUid: authUser.uid,
        attendanceStatus: validation.attendanceStatus,
        comment: validation.comment,
        lastUpdatedByUid: authUser.uid,
        now
      })
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("409")) {
      return NextResponse.json(
        { message: "この招待者の回答は既に登録されています。修正から更新してください。" },
        { status: 409 }
      );
    }

    throw error;
  }
  await createFirestoreDocument({
    idToken: authUser.idToken,
    collection: "auditLogs",
    documentId: randomUUID(),
    fields: createAuditLogFields({
      ownerUid: authUser.uid,
      actorUid: authUser.uid,
      action: "admin_response_create",
      targetType: "response",
      targetId: responseId,
      summary: `${validation.nickname} の回答を代理追加`,
      now
    })
  });

  return NextResponse.json({ responseId }, { status: 201 });
}

function validateSaveResponseRequest(body: SaveResponseRequest | null):
  | {
      ok: true;
      nickname: string;
      pin: string;
      attendanceStatus: (typeof attendanceStatuses)[number];
      comment: string;
    }
  | { ok: false; message: string } {
  if (!body) {
    return { ok: false, message: "入力内容が正しくありません。" };
  }

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  const attendanceStatus =
    typeof body.attendanceStatus === "string" ? body.attendanceStatus : "";
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";

  if (!nickname) {
    return { ok: false, message: "ニックネームを入力してください。" };
  }

  if (nickname.length > 40) {
    return { ok: false, message: "ニックネームは40文字以内で入力してください。" };
  }

  if (!/^\d{4}$/.test(pin)) {
    return { ok: false, message: "PINは4桁の数字で入力してください。" };
  }

  if (!attendanceStatuses.includes(attendanceStatus as never)) {
    return { ok: false, message: "出欠を選択してください。" };
  }

  if (comment.length > 500) {
    return { ok: false, message: "コメントは500文字以内で入力してください。" };
  }

  return {
    ok: true,
    nickname,
    pin,
    attendanceStatus: attendanceStatus as (typeof attendanceStatuses)[number],
    comment
  };
}

async function getOwnedEvent({
  idToken,
  eventId,
  ownerUid
}: {
  idToken: string;
  eventId: string;
  ownerUid: string;
}) {
  const eventDocument = await getFirestoreDocument({
    idToken,
    collection: "events",
    documentId: eventId
  });

  if (!eventDocument || firestoreString(eventDocument.fields, "ownerUid") !== ownerUid) {
    return null;
  }

  return {
    id: getDocumentId(eventDocument.name),
    eventId: firestoreString(eventDocument.fields, "eventId"),
    planId: firestoreString(eventDocument.fields, "planId"),
    ownerUid: firestoreString(eventDocument.fields, "ownerUid"),
    name: firestoreString(eventDocument.fields, "name"),
    eventDate: firestoreString(eventDocument.fields, "eventDate"),
    timeSlot: firestoreString(eventDocument.fields, "timeSlot"),
    place: firestoreString(eventDocument.fields, "place"),
    status: firestoreString(eventDocument.fields, "status"),
    isActive: firestoreBoolean(eventDocument.fields, "isActive")
  };
}

async function findGuestByNicknameKey({
  idToken,
  ownerUid,
  planId,
  nicknameKey
}: {
  idToken: string;
  ownerUid: string;
  planId: string;
  nicknameKey: string;
}) {
  const rows = await runFirestoreQuery({
    idToken,
    query: {
      structuredQuery: {
        from: [{ collectionId: "guests" }],
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
                  field: { fieldPath: "planId" },
                  op: "EQUAL",
                  value: { stringValue: planId }
                }
              },
              {
                fieldFilter: {
                  field: { fieldPath: "nicknameKey" },
                  op: "EQUAL",
                  value: { stringValue: nicknameKey }
                }
              }
            ]
          }
        },
        limit: 1
      }
    }
  });

  return rows.find((row) => row.document)?.document ?? null;
}

async function getGuestMap({
  idToken,
  guestIds,
  ownerUid
}: {
  idToken: string;
  guestIds: string[];
  ownerUid: string;
}) {
  const entries = await Promise.all(
    guestIds.map(async (guestId) => {
      const guest = await getFirestoreDocument({
        idToken,
        collection: "guests",
        documentId: guestId
      });

      if (!guest || firestoreString(guest.fields, "ownerUid") !== ownerUid) {
        return null;
      }

      return [
        guestId,
        {
          nickname: firestoreString(guest.fields, "nickname")
        }
      ] as const;
    })
  );

  return new Map(entries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)));
}

function createResponseFields({
  responseId,
  planId,
  eventId,
  guestId,
  ownerUid,
  attendanceStatus,
  comment,
  lastUpdatedByUid,
  now
}: {
  responseId: string;
  planId: string;
  eventId: string;
  guestId: string;
  ownerUid: string;
  attendanceStatus: string;
  comment: string;
  lastUpdatedByUid: string;
  now: string;
}): Record<string, FirestoreFieldValue> {
  return {
    responseId: toFirestoreString(responseId),
    planId: toFirestoreString(planId),
    eventId: toFirestoreString(eventId),
    guestId: toFirestoreString(guestId),
    ownerUid: toFirestoreString(ownerUid),
    attendanceStatus: toFirestoreString(attendanceStatus),
    comment: toFirestoreNullableString(comment || null),
    answeredAt: toFirestoreTimestamp(now),
    lastUpdatedBy: toFirestoreString("admin"),
    lastUpdatedByUid: toFirestoreString(lastUpdatedByUid),
    createdAt: toFirestoreTimestamp(now),
    updatedAt: toFirestoreTimestamp(now)
  };
}

function countResponses(
  responses: Array<{
    attendanceStatus: string;
  }>
) {
  return responses.reduce(
    (summary, response) => {
      if (response.attendanceStatus === "yes") {
        summary.yes += 1;
      } else if (response.attendanceStatus === "maybe") {
        summary.maybe += 1;
      } else if (response.attendanceStatus === "no") {
        summary.no += 1;
      }

      return summary;
    },
    { yes: 0, maybe: 0, no: 0 }
  );
}

function getDocumentId(documentName: string) {
  return documentName.split("/").pop() ?? documentName;
}
