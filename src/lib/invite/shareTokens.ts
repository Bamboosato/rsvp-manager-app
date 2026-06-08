import { randomBytes } from "crypto";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import type { InvitePlan } from "./server";

const inviteShareTokensCollection = "inviteShareTokens";
const inviteShareTokenPattern = /^[A-Za-z0-9_-]{24,120}$/;

export type InviteShareToken = {
  id: string;
  token: string;
  publicToken: string;
  planId: string;
  ownerUid: string;
  eventIds: string[];
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
};

export function validateInviteShareTokenParam(value: string | null):
  | { ok: true; token: string }
  | { ok: false; message: string } {
  const token = value?.trim() ?? "";

  if (!token) {
    return { ok: false, message: "配信用URLが正しくありません。" };
  }

  if (!inviteShareTokenPattern.test(token)) {
    return { ok: false, message: "配信用URLが正しくありません。" };
  }

  return { ok: true, token };
}

export async function createInviteShareToken({
  ownerUid,
  planId,
  publicToken,
  eventIds
}: {
  ownerUid: string;
  planId: string;
  publicToken: string;
  eventIds: string[];
}) {
  const db = getFirebaseAdminFirestore();
  const token = randomBytes(24).toString("base64url");
  const now = Timestamp.now();

  await db.collection(inviteShareTokensCollection).doc(token).create({
    token,
    publicToken,
    planId,
    ownerUid,
    eventIds,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    revokedAt: null,
    revokedReason: null
  });

  return token;
}

export async function findActiveInviteShareTokenForPlan({
  plan,
  token
}: {
  plan: InvitePlan;
  token: string;
}) {
  const validation = validateInviteShareTokenParam(token);

  if (!validation.ok) {
    return null;
  }

  const document = await getFirebaseAdminFirestore()
    .collection(inviteShareTokensCollection)
    .doc(validation.token)
    .get();

  if (!document.exists) {
    return null;
  }

  const shareToken = mapInviteShareToken(document.id, document.data() ?? {});

  if (
    !shareToken.isActive ||
    shareToken.ownerUid !== plan.ownerUid ||
    shareToken.planId !== plan.id ||
    shareToken.publicToken !== plan.publicToken ||
    shareToken.eventIds.length === 0
  ) {
    return null;
  }

  return shareToken;
}

export async function disablePlanAndRevokeInviteShareTokens({
  ownerUid,
  planId
}: {
  ownerUid: string;
  planId: string;
}) {
  const db = getFirebaseAdminFirestore();
  const planRef = db.collection("plans").doc(planId);
  const planDocument = await planRef.get();

  if (!planDocument.exists || planDocument.data()?.ownerUid !== ownerUid) {
    return { ok: false as const, reason: "not-found" as const };
  }

  const activeTokenSnapshot = await db
    .collection(inviteShareTokensCollection)
    .where("ownerUid", "==", ownerUid)
    .where("planId", "==", planId)
    .where("isActive", "==", true)
    .get();
  const now = Timestamp.now();
  const tokenDocuments = activeTokenSnapshot.docs;
  const firstBatch = db.batch();
  firstBatch.update(planRef, {
    isActive: false,
    updatedAt: now
  });

  tokenDocuments.slice(0, 499).forEach((document) => {
    firstBatch.update(document.ref, {
      isActive: false,
      updatedAt: now,
      revokedAt: now,
      revokedReason: "plan_deleted"
    });
  });

  await firstBatch.commit();

  for (let index = 499; index < tokenDocuments.length; index += 500) {
    const batch = db.batch();

    tokenDocuments.slice(index, index + 500).forEach((document) => {
      batch.update(document.ref, {
        isActive: false,
        updatedAt: now,
        revokedAt: now,
        revokedReason: "plan_deleted"
      });
    });

    await batch.commit();
  }

  return {
    ok: true as const,
    revokedTokenCount: tokenDocuments.length
  };
}

function mapInviteShareToken(id: string, data: DocumentData): InviteShareToken {
  return {
    id,
    token: String(data.token ?? id),
    publicToken: String(data.publicToken ?? ""),
    planId: String(data.planId ?? ""),
    ownerUid: String(data.ownerUid ?? ""),
    eventIds: Array.isArray(data.eventIds)
      ? data.eventIds.filter((eventId): eventId is string => typeof eventId === "string")
      : [],
    isActive: data.isActive === true,
    createdAt: timestampToIsoString(data.createdAt),
    updatedAt: timestampToIsoString(data.updatedAt),
    revokedAt: timestampToIsoString(data.revokedAt),
    revokedReason: typeof data.revokedReason === "string" ? data.revokedReason : null
  };
}

function timestampToIsoString(value: unknown) {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  return null;
}
