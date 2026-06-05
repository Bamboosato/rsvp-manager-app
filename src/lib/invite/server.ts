import { randomUUID } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { hashSecret, normalizeNickname, verifySecret } from "@/lib/firebase/serverApi";

export type AttendanceStatus = "yes" | "maybe" | "no";

export type InvitePlan = {
  id: string;
  planId: string;
  ownerUid: string;
  name: string;
  yearMonth: string;
  passwordHash: string | null;
  publicToken: string;
  isActive: boolean;
};

export type InviteEvent = {
  id: string;
  eventId: string;
  planId: string;
  ownerUid: string;
  name: string;
  eventDate: string;
  timeSlot: "AM" | "PM";
  timeDetail: string;
  place: string;
  status: "accepting" | "closed";
  sortOrder: number;
  isActive: boolean;
};

export type InviteGuest = {
  id: string;
  guestId: string;
  planId: string;
  ownerUid: string;
  nickname: string;
  nicknameKey: string;
  pinHash: string;
};

export type InviteResponse = {
  id: string;
  responseId: string;
  planId: string;
  eventId: string;
  guestId: string;
  ownerUid: string;
  attendanceStatus: AttendanceStatus;
  comment: string;
  answeredAt: string | null;
  lastUpdatedBy: "admin" | "guest";
};

export type SaveInviteResponseInput = {
  eventId: string;
  attendanceStatus: AttendanceStatus;
  comment: string;
};

export async function findPlanByPublicToken(publicToken: string) {
  const snapshot = await getFirebaseAdminFirestore()
    .collection("plans")
    .where("publicToken", "==", publicToken)
    .limit(1)
    .get();
  const document = snapshot.docs[0];

  if (!document) {
    return null;
  }

  return mapPlan(document.id, document.data());
}

export function toPublicPlan(plan: InvitePlan) {
  return {
    name: plan.name,
    yearMonth: plan.yearMonth,
    hasPassword: Boolean(plan.passwordHash)
  };
}

export async function findGuestByNickname({
  ownerUid,
  planId,
  nickname
}: {
  ownerUid: string;
  planId: string;
  nickname: string;
}) {
  const nicknameKey = normalizeNickname(nickname);
  const snapshot = await getFirebaseAdminFirestore()
    .collection("guests")
    .where("ownerUid", "==", ownerUid)
    .where("planId", "==", planId)
    .where("nicknameKey", "==", nicknameKey)
    .limit(1)
    .get();
  const document = snapshot.docs[0];

  if (!document) {
    return null;
  }

  return mapGuest(document.id, document.data());
}

export async function createInviteGuest({
  ownerUid,
  planId,
  nickname,
  pin
}: {
  ownerUid: string;
  planId: string;
  nickname: string;
  pin: string;
}) {
  const db = getFirebaseAdminFirestore();
  const guestId = randomUUID();
  const now = Timestamp.now();
  const nicknameKey = normalizeNickname(nickname);

  await db.collection("guests").doc(guestId).create({
    guestId,
    planId,
    ownerUid,
    nickname,
    nicknameKey,
    pinHash: hashSecret(pin),
    pinResetAt: null,
    pinResetByUid: null,
    createdAt: now,
    updatedAt: now
  });

  return {
    id: guestId,
    guestId,
    planId,
    ownerUid,
    nickname,
    nicknameKey,
    pinHash: ""
  };
}

export function verifyGuestPin(guest: InviteGuest, pin: string) {
  return verifySecret(pin, guest.pinHash);
}

export async function listInviteEvents(plan: InvitePlan) {
  const snapshot = await getFirebaseAdminFirestore()
    .collection("events")
    .where("ownerUid", "==", plan.ownerUid)
    .where("planId", "==", plan.id)
    .where("isActive", "==", true)
    .orderBy("eventDate", "asc")
    .orderBy("timeSlot", "asc")
    .orderBy("sortOrder", "asc")
    .get();

  return snapshot.docs.map((document) => mapEvent(document.id, document.data()));
}

export async function listGuestResponses({
  ownerUid,
  planId,
  guestId
}: {
  ownerUid: string;
  planId: string;
  guestId: string;
}) {
  const snapshot = await getFirebaseAdminFirestore()
    .collection("responses")
    .where("ownerUid", "==", ownerUid)
    .where("planId", "==", planId)
    .where("guestId", "==", guestId)
    .orderBy("eventId", "asc")
    .get();

  return snapshot.docs
    .filter((document) => document.data().isActive !== false)
    .map((document) => mapResponse(document.id, document.data()));
}

export async function saveInviteResponses({
  plan,
  guestId,
  responses
}: {
  plan: InvitePlan;
  guestId: string;
  responses: SaveInviteResponseInput[];
}) {
  const events = await listInviteEvents(plan);
  const eventMap = new Map(events.map((event) => [event.id, event]));
  const invalidEvent = responses.find((response) => {
    const event = eventMap.get(response.eventId);
    return !event || event.status !== "accepting";
  });

  if (invalidEvent) {
    return {
      ok: false as const,
      message: "一部のイベントが締切済になったため保存できませんでした。内容を確認してください。"
    };
  }

  const db = getFirebaseAdminFirestore();
  const now = Timestamp.now();
  const batch = db.batch();

  await Promise.all(
    responses.map(async (response) => {
      const responseId = `${response.eventId}_${guestId}`;
      const responseRef = db.collection("responses").doc(responseId);
      const existingResponse = await responseRef.get();
      const updateFields = {
        isActive: true,
        attendanceStatus: response.attendanceStatus,
        comment: response.comment || null,
        answeredAt: now,
        lastUpdatedBy: "guest",
        lastUpdatedByUid: null,
        updatedAt: now
      };

      if (existingResponse.exists) {
        batch.update(responseRef, updateFields);
        return;
      }

      batch.create(responseRef, {
        responseId,
        planId: plan.id,
        eventId: response.eventId,
        guestId,
        ownerUid: plan.ownerUid,
        ...updateFields,
        createdAt: now
      });
    })
  );

  await batch.commit();

  return {
    ok: true as const
  };
}

function mapPlan(id: string, data: FirebaseFirestore.DocumentData): InvitePlan {
  return {
    id,
    planId: String(data.planId ?? id),
    ownerUid: String(data.ownerUid ?? ""),
    name: String(data.name ?? ""),
    yearMonth: String(data.yearMonth ?? ""),
    passwordHash: typeof data.passwordHash === "string" ? data.passwordHash : null,
    publicToken: String(data.publicToken ?? ""),
    isActive: Boolean(data.isActive)
  };
}

function mapGuest(id: string, data: FirebaseFirestore.DocumentData): InviteGuest {
  return {
    id,
    guestId: String(data.guestId ?? id),
    planId: String(data.planId ?? ""),
    ownerUid: String(data.ownerUid ?? ""),
    nickname: String(data.nickname ?? ""),
    nicknameKey: String(data.nicknameKey ?? ""),
    pinHash: String(data.pinHash ?? "")
  };
}

function mapEvent(id: string, data: FirebaseFirestore.DocumentData): InviteEvent {
  return {
    id,
    eventId: String(data.eventId ?? id),
    planId: String(data.planId ?? ""),
    ownerUid: String(data.ownerUid ?? ""),
    name: String(data.name ?? ""),
    eventDate: String(data.eventDate ?? ""),
    timeSlot: data.timeSlot === "PM" ? "PM" : "AM",
    timeDetail: String(data.timeDetail ?? ""),
    place: String(data.place ?? ""),
    status: data.status === "closed" ? "closed" : "accepting",
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
    isActive: Boolean(data.isActive)
  };
}

function mapResponse(id: string, data: FirebaseFirestore.DocumentData): InviteResponse {
  return {
    id,
    responseId: String(data.responseId ?? id),
    planId: String(data.planId ?? ""),
    eventId: String(data.eventId ?? ""),
    guestId: String(data.guestId ?? ""),
    ownerUid: String(data.ownerUid ?? ""),
    attendanceStatus:
      data.attendanceStatus === "maybe"
        ? "maybe"
        : data.attendanceStatus === "no"
          ? "no"
          : "yes",
    comment: typeof data.comment === "string" ? data.comment : "",
    answeredAt:
      data.answeredAt instanceof Timestamp ? data.answeredAt.toDate().toISOString() : null,
    lastUpdatedBy: data.lastUpdatedBy === "guest" ? "guest" : "admin"
  };
}
