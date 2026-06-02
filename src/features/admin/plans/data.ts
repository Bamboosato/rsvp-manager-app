import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  type QueryDocumentSnapshot,
  type Timestamp,
  type Unsubscribe
} from "firebase/firestore";

export type AdminPlan = {
  id: string;
  ownerUid: string;
  name: string;
  yearMonth: string;
  publicToken: string;
  hasPassword: boolean;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type EventAdminProfileInput = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

export function subscribeOwnerPlans({
  db,
  ownerUid,
  onPlans,
  onError
}: {
  db: Firestore;
  ownerUid: string;
  onPlans: (plans: AdminPlan[]) => void;
  onError: (error: Error) => void;
}): Unsubscribe {
  const plansQuery = query(
    collection(db, "plans"),
    where("ownerUid", "==", ownerUid),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(
    plansQuery,
    (snapshot) => {
      onPlans(snapshot.docs.map(mapPlanSnapshot));
    },
    (error) => {
      onError(error);
    }
  );
}

export function subscribeOwnerPlan({
  db,
  ownerUid,
  planId,
  onPlan,
  onError
}: {
  db: Firestore;
  ownerUid: string;
  planId: string;
  onPlan: (plan: AdminPlan | null) => void;
  onError: (error: Error) => void;
}): Unsubscribe {
  return onSnapshot(
    doc(db, "plans", planId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onPlan(null);
        return;
      }

      const plan = mapPlanSnapshot(snapshot);
      onPlan(plan.ownerUid === ownerUid ? plan : null);
    },
    (error) => {
      onError(error);
    }
  );
}

export async function disablePlan(db: Firestore, planId: string) {
  await updateDoc(doc(db, "plans", planId), {
    isActive: false,
    updatedAt: serverTimestamp()
  });
}

export async function ensureEventAdminProfile(
  db: Firestore,
  input: EventAdminProfileInput
) {
  const profileRef = doc(db, "eventAdmins", input.uid);
  const existingProfile = await getDoc(profileRef);

  await setDoc(
    profileRef,
    {
      uid: input.uid,
      email: input.email ?? "",
      displayName: input.displayName ?? "",
      isActive: true,
      updatedAt: serverTimestamp(),
      ...(existingProfile.exists() ? {} : { createdAt: serverTimestamp() })
    },
    { merge: true }
  );
}

export function formatYearMonth(yearMonth: string) {
  const [year, month] = yearMonth.split("-");

  if (!year || !month) {
    return yearMonth;
  }

  return `${year}年${month}月`;
}

export function formatDateTime(date: Date | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function mapPlanSnapshot(
  snapshot: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): AdminPlan {
  const data = snapshot.data() ?? {};

  return {
    id: snapshot.id,
    ownerUid: String(data.ownerUid ?? ""),
    name: String(data.name ?? ""),
    yearMonth: String(data.yearMonth ?? ""),
    publicToken: String(data.publicToken ?? ""),
    hasPassword: Boolean(data.passwordHash),
    isActive: Boolean(data.isActive),
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt)
  };
}

function timestampToDate(value: unknown) {
  if (isFirestoreTimestamp(value)) {
    return value.toDate();
  }

  return null;
}

function isFirestoreTimestamp(value: unknown): value is Timestamp {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  );
}
