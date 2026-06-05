import {
  collection,
  doc,
  onSnapshot as onDocumentSnapshot,
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

export type EventStatus = "accepting" | "closed";
export type EventTimeSlot = "AM" | "PM";

export type AdminEvent = {
  id: string;
  eventId: string;
  planId: string;
  ownerUid: string;
  name: string;
  eventDate: string;
  timeSlot: EventTimeSlot;
  timeDetail: string;
  place: string;
  status: EventStatus;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type CreateEventInput = {
  planId: string;
  ownerUid: string;
  name: string;
  eventDate: string;
  timeSlot: EventTimeSlot;
  timeDetail: string;
  place: string;
};

export type UpdateEventInput = {
  eventId: string;
  name: string;
  eventDate: string;
  timeSlot: EventTimeSlot;
  timeDetail: string;
  place: string;
  status: EventStatus;
};

export function subscribeOwnerEvents({
  db,
  ownerUid,
  onEvents,
  onError
}: {
  db: Firestore;
  ownerUid: string;
  onEvents: (events: AdminEvent[]) => void;
  onError: (error: Error) => void;
}): Unsubscribe {
  const eventsQuery = query(
    collection(db, "events"),
    where("ownerUid", "==", ownerUid)
  );

  return onSnapshot(
    eventsQuery,
    (snapshot) => {
      onEvents(snapshot.docs.map(mapEventSnapshot));
    },
    (error) => {
      onError(error);
    }
  );
}

export function subscribePlanEvents({
  db,
  ownerUid,
  planId,
  onEvents,
  onError
}: {
  db: Firestore;
  ownerUid: string;
  planId: string;
  onEvents: (events: AdminEvent[]) => void;
  onError: (error: Error) => void;
}): Unsubscribe {
  const eventsQuery = query(
    collection(db, "events"),
    where("ownerUid", "==", ownerUid),
    where("planId", "==", planId),
    where("isActive", "==", true),
    orderBy("eventDate", "asc"),
    orderBy("timeSlot", "asc"),
    orderBy("sortOrder", "asc")
  );

  return onSnapshot(
    eventsQuery,
    (snapshot) => {
      onEvents(snapshot.docs.map(mapEventSnapshot));
    },
    (error) => {
      onError(error);
    }
  );
}

export function subscribeOwnerEvent({
  db,
  ownerUid,
  eventId,
  onEvent,
  onError
}: {
  db: Firestore;
  ownerUid: string;
  eventId: string;
  onEvent: (event: AdminEvent | null) => void;
  onError: (error: Error) => void;
}): Unsubscribe {
  return onDocumentSnapshot(
    doc(db, "events", eventId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onEvent(null);
        return;
      }

      const event = mapEventSnapshot(snapshot);
      onEvent(event.ownerUid === ownerUid ? event : null);
    },
    (error) => {
      onError(error);
    }
  );
}

export async function createEvent(db: Firestore, input: CreateEventInput) {
  const eventRef = doc(collection(db, "events"));

  await setDoc(eventRef, {
    eventId: eventRef.id,
    planId: input.planId,
    ownerUid: input.ownerUid,
    name: input.name.trim(),
    eventDate: input.eventDate,
    timeSlot: input.timeSlot,
    timeDetail: input.timeDetail.trim(),
    place: input.place.trim(),
    status: "accepting",
    sortOrder: Date.now(),
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return eventRef.id;
}

export async function updateEventStatus({
  db,
  eventId,
  status
}: {
  db: Firestore;
  eventId: string;
  status: EventStatus;
}) {
  await updateDoc(doc(db, "events", eventId), {
    status,
    updatedAt: serverTimestamp()
  });
}

export async function updateEventDetails(db: Firestore, input: UpdateEventInput) {
  await updateDoc(doc(db, "events", input.eventId), {
    name: input.name.trim(),
    eventDate: input.eventDate,
    timeSlot: input.timeSlot,
    timeDetail: input.timeDetail.trim(),
    place: input.place.trim(),
    status: input.status,
    updatedAt: serverTimestamp()
  });
}

export async function disableEvent(db: Firestore, eventId: string) {
  await updateDoc(doc(db, "events", eventId), {
    isActive: false,
    updatedAt: serverTimestamp()
  });
}

export function formatEventDate(eventDate: string) {
  const [year, month, day] = eventDate.split("-");

  if (!year || !month || !day) {
    return eventDate;
  }

  return `${year}/${month}/${day}`;
}

export function formatEventTime(timeSlot: EventTimeSlot | string, timeDetail?: string) {
  const detail = timeDetail?.trim();

  return detail ? `${timeSlot} ${detail}` : timeSlot;
}

export function getEventStatusLabel(status: EventStatus) {
  return status === "accepting" ? "受付中" : "締切済";
}

export function getNextEventStatus(status: EventStatus): EventStatus {
  return status === "accepting" ? "closed" : "accepting";
}

function mapEventSnapshot(
  snapshot: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): AdminEvent {
  const data = snapshot.data() ?? {};

  return {
    id: snapshot.id,
    eventId: String(data.eventId ?? snapshot.id),
    planId: String(data.planId ?? ""),
    ownerUid: String(data.ownerUid ?? ""),
    name: String(data.name ?? ""),
    eventDate: String(data.eventDate ?? ""),
    timeSlot: data.timeSlot === "PM" ? "PM" : "AM",
    timeDetail: String(data.timeDetail ?? ""),
    place: String(data.place ?? ""),
    status: data.status === "closed" ? "closed" : "accepting",
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
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
