import { randomBytes } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const codeLength = 10;

export type LineRegistrationCode = {
  code: string;
  ownerUid: string;
  lineAccountId: string;
  isActive: boolean;
};

export function parseLineRegistrationCode(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");
  const prefixedMatch = normalized.match(
    /^(?:登録|とうろく|register)[:：\s]+([A-Za-z0-9_-]{8,80})$/i
  );

  if (prefixedMatch?.[1]) {
    return prefixedMatch[1].toUpperCase();
  }

  const codeOnlyMatch = normalized.match(/^([A-Za-z0-9_-]{8,80})$/);

  return codeOnlyMatch?.[1]?.toUpperCase() ?? null;
}

export async function ensureLineRegistrationCode({
  ownerUid,
  lineAccountId
}: {
  ownerUid: string;
  lineAccountId: string;
}) {
  const db = getFirebaseAdminFirestore();
  const ownerCodeRef = db
    .collection("lineRegistrationCodeOwners")
    .doc(buildOwnerCodeDocumentId({ lineAccountId, ownerUid }));
  const existingOwnerCode = await ownerCodeRef.get();
  const existingOwnerCodeData = existingOwnerCode.data();

  if (
    existingOwnerCode.exists &&
    existingOwnerCodeData?.isActive === true &&
    typeof existingOwnerCodeData.code === "string"
  ) {
    return existingOwnerCodeData.code;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createRegistrationCode();
    const codeRef = db.collection("lineRegistrationCodes").doc(code);
    const now = Timestamp.now();
    const batch = db.batch();

    batch.create(codeRef, {
      code,
      ownerUid,
      lineAccountId,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
    batch.set(ownerCodeRef, {
      code,
      ownerUid,
      lineAccountId,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });

    try {
      await batch.commit();
      return code;
    } catch (error) {
      if (attempt === 4) {
        throw error;
      }
    }
  }

  throw new Error("Failed to create LINE registration code.");
}

export async function findActiveLineRegistrationCode({
  code,
  lineAccountId
}: {
  code: string;
  lineAccountId: string;
}) {
  const document = await getFirebaseAdminFirestore()
    .collection("lineRegistrationCodes")
    .doc(code)
    .get();

  if (!document.exists) {
    return null;
  }

  const data = document.data() ?? {};

  if (data.isActive !== true || data.lineAccountId !== lineAccountId) {
    return null;
  }

  return {
    code: String(data.code ?? document.id),
    ownerUid: String(data.ownerUid ?? ""),
    lineAccountId: String(data.lineAccountId ?? ""),
    isActive: true
  } satisfies LineRegistrationCode;
}

function createRegistrationCode() {
  const randomValues = randomBytes(codeLength);

  return Array.from(randomValues)
    .map((value) => codeAlphabet[value % codeAlphabet.length])
    .join("");
}

function buildOwnerCodeDocumentId({
  lineAccountId,
  ownerUid
}: {
  lineAccountId: string;
  ownerUid: string;
}) {
  return `${lineAccountId}_${ownerUid}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 180);
}
