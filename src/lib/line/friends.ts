import { createHash, randomUUID } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore, getFirebaseAdminStorageBucket } from "@/lib/firebase/admin";
import { findActiveLineRegistrationCode } from "./registrationCodes";
import { getLineUserProfile, type LineUserProfile } from "./client";

export type LineFriend = {
  id: string;
  ownerUid: string;
  lineAccountId: string;
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
  linePictureUrl: string | null;
  pictureStoragePath: string | null;
  memo: string;
  isActive: boolean;
  isDeliverable: boolean;
  isFriend: boolean;
  registeredAt: string | null;
  updatedAt: string | null;
  blockedAt: string | null;
};

type SavedProfileImage = {
  pictureUrl: string;
  storagePath: string;
};

export function buildLineFriendId({
  ownerUid,
  lineAccountId,
  lineUserId
}: {
  ownerUid: string;
  lineAccountId: string;
  lineUserId: string;
}) {
  return createHash("sha256")
    .update(`${lineAccountId}\0${ownerUid}\0${lineUserId}`)
    .digest("hex");
}

export async function listLineFriends(ownerUid: string) {
  const snapshot = await getFirebaseAdminFirestore()
    .collection("lineFriends")
    .where("ownerUid", "==", ownerUid)
    .get();

  return snapshot.docs
    .map((document) => mapLineFriend(document.id, document.data()))
    .filter((friend) => friend.isActive)
    .sort((first, second) => first.displayName.localeCompare(second.displayName, "ja"));
}

export async function registerLineFriendByCode({
  lineAccountId,
  lineUserId,
  code
}: {
  lineAccountId: string;
  lineUserId: string;
  code: string;
}) {
  const registrationCode = await findActiveLineRegistrationCode({
    code,
    lineAccountId
  });

  if (!registrationCode?.ownerUid) {
    return {
      ok: false as const,
      reason: "invalid-code" as const
    };
  }

  const profile =
    (await getLineUserProfile(lineUserId)) ??
    ({
      userId: lineUserId,
      displayName: "LINEユーザー",
      pictureUrl: null
    } satisfies LineUserProfile);
  const savedImage = profile.pictureUrl
    ? await saveLineProfileImage({
        lineAccountId,
        lineUserId,
        pictureUrl: profile.pictureUrl
      }).catch((error) => {
        console.error("Failed to save LINE profile image.", error);
        return null;
      })
    : null;
  const db = getFirebaseAdminFirestore();
  const friendId = buildLineFriendId({
    ownerUid: registrationCode.ownerUid,
    lineAccountId,
    lineUserId
  });
  const friendRef = db.collection("lineFriends").doc(friendId);
  const existingFriend = await friendRef.get();
  const existingData = existingFriend.data() ?? {};
  const now = Timestamp.now();

  await friendRef.set(
    {
      friendId,
      ownerUid: registrationCode.ownerUid,
      lineAccountId,
      lineUserId,
      displayName: profile.displayName,
      linePictureUrl: profile.pictureUrl,
      ...(savedImage
        ? {
            pictureUrl: savedImage.pictureUrl,
            pictureStoragePath: savedImage.storagePath
          }
        : existingData.pictureUrl
          ? {}
          : {
              pictureUrl: null,
              pictureStoragePath: null
            }),
      memo: typeof existingData.memo === "string" ? existingData.memo : "",
      isActive: true,
      isDeliverable: existingData.isDeliverable === false ? false : true,
      isFriend: true,
      registrationCode: code,
      blockedAt: null,
      registeredAt: existingData.registeredAt ?? now,
      lastRegisteredAt: now,
      updatedAt: now
    },
    { merge: true }
  );

  return {
    ok: true as const,
    friend: mapLineFriend(friendId, {
      ...existingData,
      friendId,
      ownerUid: registrationCode.ownerUid,
      lineAccountId,
      lineUserId,
      displayName: profile.displayName,
      linePictureUrl: profile.pictureUrl,
      pictureUrl: savedImage?.pictureUrl ?? existingData.pictureUrl ?? null,
      pictureStoragePath: savedImage?.storagePath ?? existingData.pictureStoragePath ?? null,
      memo: typeof existingData.memo === "string" ? existingData.memo : "",
      isActive: true,
      isDeliverable: existingData.isDeliverable === false ? false : true,
      isFriend: true,
      blockedAt: null,
      registeredAt: existingData.registeredAt ?? now,
      updatedAt: now
    })
  };
}

export async function markLineUserUnfollowed({
  lineAccountId,
  lineUserId
}: {
  lineAccountId: string;
  lineUserId: string;
}) {
  const db = getFirebaseAdminFirestore();
  const snapshot = await db
    .collection("lineFriends")
    .where("lineUserId", "==", lineUserId)
    .get();
  const now = Timestamp.now();
  const batch = db.batch();
  let updateCount = 0;

  snapshot.docs.forEach((document) => {
    const data = document.data();

    if (data.lineAccountId !== lineAccountId || data.isActive !== true) {
      return;
    }

    updateCount += 1;
    batch.update(document.ref, {
      isFriend: false,
      isDeliverable: false,
      blockedAt: now,
      updatedAt: now
    });
  });

  if (updateCount > 0) {
    await batch.commit();
  }
}

export async function updateLineFriend({
  ownerUid,
  friendId,
  memo,
  isDeliverable
}: {
  ownerUid: string;
  friendId: string;
  memo: string;
  isDeliverable: boolean;
}) {
  const db = getFirebaseAdminFirestore();
  const friendRef = db.collection("lineFriends").doc(friendId);
  const friendDocument = await friendRef.get();
  const friendData = friendDocument.data();

  if (!friendDocument.exists || friendData?.ownerUid !== ownerUid || friendData.isActive !== true) {
    return null;
  }

  await friendRef.update({
    memo,
    isDeliverable,
    updatedAt: Timestamp.now()
  });

  return {
    ...mapLineFriend(friendDocument.id, friendData),
    memo,
    isDeliverable
  };
}

export async function deleteLineFriend({
  ownerUid,
  friendId
}: {
  ownerUid: string;
  friendId: string;
}) {
  const db = getFirebaseAdminFirestore();
  const friendRef = db.collection("lineFriends").doc(friendId);
  const friendDocument = await friendRef.get();
  const friendData = friendDocument.data();

  if (!friendDocument.exists || friendData?.ownerUid !== ownerUid || friendData.isActive !== true) {
    return false;
  }

  const now = Timestamp.now();
  await friendRef.update({
    isActive: false,
    isDeliverable: false,
    deletedAt: now,
    updatedAt: now
  });

  return true;
}

export async function getOwnedDeliverableLineFriends({
  ownerUid,
  friendIds
}: {
  ownerUid: string;
  friendIds: string[];
}) {
  const db = getFirebaseAdminFirestore();
  const friendDocuments = await db.getAll(
    ...friendIds.map((friendId) => db.collection("lineFriends").doc(friendId))
  );

  return friendDocuments
    .map((document) => {
      if (!document.exists) {
        return null;
      }

      return mapLineFriend(document.id, document.data() ?? {});
    })
    .filter(
      (friend): friend is LineFriend =>
        friend !== null &&
        friend.ownerUid === ownerUid &&
        friend.isActive &&
        friend.isDeliverable &&
        friend.isFriend
    );
}

function mapLineFriend(id: string, data: FirebaseFirestore.DocumentData): LineFriend {
  return {
    id,
    ownerUid: String(data.ownerUid ?? ""),
    lineAccountId: String(data.lineAccountId ?? ""),
    lineUserId: String(data.lineUserId ?? ""),
    displayName: String(data.displayName ?? "LINEユーザー"),
    pictureUrl: typeof data.pictureUrl === "string" ? data.pictureUrl : null,
    linePictureUrl: typeof data.linePictureUrl === "string" ? data.linePictureUrl : null,
    pictureStoragePath:
      typeof data.pictureStoragePath === "string" ? data.pictureStoragePath : null,
    memo: String(data.memo ?? ""),
    isActive: data.isActive === true,
    isDeliverable: data.isDeliverable !== false,
    isFriend: data.isFriend !== false,
    registeredAt: timestampToIsoString(data.registeredAt),
    updatedAt: timestampToIsoString(data.updatedAt),
    blockedAt: timestampToIsoString(data.blockedAt)
  };
}

async function saveLineProfileImage({
  lineAccountId,
  lineUserId,
  pictureUrl
}: {
  lineAccountId: string;
  lineUserId: string;
  pictureUrl: string;
}): Promise<SavedProfileImage | null> {
  const storageBucket =
    process.env.FIREBASE_ADMIN_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!storageBucket) {
    return null;
  }

  const response = await fetch(pictureUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";

  if (!contentType.startsWith("image/")) {
    return null;
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.length > 5 * 1024 * 1024) {
    return null;
  }

  const extension = getImageExtension(contentType);
  const storagePath = `line-friends/${lineAccountId}/${lineUserId}/profile.${extension}`;
  const downloadToken = randomUUID();
  const bucket = getFirebaseAdminStorageBucket();
  const file = bucket.file(storagePath);

  await file.save(bytes, {
    resumable: false,
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: downloadToken
      }
    }
  });

  return {
    storagePath,
    pictureUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
      storagePath
    )}?alt=media&token=${downloadToken}`
  };
}

function getImageExtension(contentType: string) {
  if (contentType.includes("png")) {
    return "png";
  }

  if (contentType.includes("webp")) {
    return "webp";
  }

  return "jpg";
}

function timestampToIsoString(value: unknown) {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  return null;
}
