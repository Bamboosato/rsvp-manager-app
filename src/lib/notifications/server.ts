import { createHash } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { FirebaseMessagingError } from "firebase-admin/messaging";
import {
  getFirebaseAdminFirestore,
  getFirebaseAdminMessaging
} from "@/lib/firebase/admin";

const invalidTokenErrorCodes = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered"
]);

type RegisterNotificationTokenInput = {
  ownerUid: string;
  fcmToken: string;
  userAgent: string | null;
};

type SendInviteResponseNotificationInput = {
  ownerUid: string;
  planId: string;
  planName: string;
  nickname: string;
  origin: string;
};

export function createNotificationTokenId(fcmToken: string) {
  return createHash("sha256").update(fcmToken).digest("hex");
}

export async function registerNotificationToken({
  ownerUid,
  fcmToken,
  userAgent
}: RegisterNotificationTokenInput) {
  const db = getFirebaseAdminFirestore();
  const now = Timestamp.now();
  const tokenId = createNotificationTokenId(fcmToken);

  await db.collection("notificationTokens").doc(tokenId).set(
    {
      tokenId,
      ownerUid,
      fcmToken,
      userAgent,
      isActive: true,
      lastSeenAt: now,
      updatedAt: now,
      createdAt: now
    },
    { merge: true }
  );

  return tokenId;
}

export async function sendInviteResponseNotification({
  ownerUid,
  planId,
  planName,
  nickname,
  origin
}: SendInviteResponseNotificationInput) {
  const db = getFirebaseAdminFirestore();
  const snapshot = await db
    .collection("notificationTokens")
    .where("ownerUid", "==", ownerUid)
    .where("isActive", "==", true)
    .get();

  const tokenDocuments = snapshot.docs
    .map((document) => {
      const data = document.data();
      const fcmToken = typeof data.fcmToken === "string" ? data.fcmToken : "";

      return fcmToken ? { id: document.id, fcmToken } : null;
    })
    .filter((entry): entry is { id: string; fcmToken: string } => Boolean(entry));

  if (tokenDocuments.length === 0) {
    return;
  }

  const url = `${origin}/admin/plans/${encodeURIComponent(planId)}`;
  const iconUrl = `${origin}/icons/rsvp-hub-icon-192.png`;
  const body = `プラン${planName}を${nickname}さんが更新しました。`;
  const messaging = getFirebaseAdminMessaging();
  const webpush = {
    ...(origin.startsWith("https://")
      ? {
          fcmOptions: {
            link: url
          }
        }
      : {}),
    notification: {
      title: "RSVP Hub",
      body,
      icon: iconUrl,
      badge: iconUrl,
      tag: `invite-response-${planId}`,
      data: {
        url,
        planId
      }
    }
  };

  for (const chunk of chunkArray(tokenDocuments, 500)) {
    const response = await messaging.sendEachForMulticast({
      tokens: chunk.map((entry) => entry.fcmToken),
      notification: {
        title: "RSVP Hub",
        body
      },
      data: {
        type: "invite_response_updated",
        ownerUid,
        planId,
        url
      },
      webpush
    });

    const invalidTokenIds = response.responses
      .map((sendResponse, index) => {
        if (sendResponse.success) {
          return null;
        }

        const code = getMessagingErrorCode(sendResponse.error);
        return code && invalidTokenErrorCodes.has(code) ? chunk[index]?.id : null;
      })
      .filter((tokenId): tokenId is string => Boolean(tokenId));

    await deactivateInvalidTokens(invalidTokenIds);
  }
}

async function deactivateInvalidTokens(tokenIds: string[]) {
  if (tokenIds.length === 0) {
    return;
  }

  const db = getFirebaseAdminFirestore();
  const batch = db.batch();
  const now = Timestamp.now();

  tokenIds.forEach((tokenId) => {
    batch.update(db.collection("notificationTokens").doc(tokenId), {
      isActive: false,
      updatedAt: now
    });
  });

  await batch.commit();
}

function getMessagingErrorCode(error: unknown) {
  if (error instanceof FirebaseMessagingError) {
    return error.code;
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }

  return null;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}
