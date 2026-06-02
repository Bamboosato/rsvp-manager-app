import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
  type Unsubscribe
} from "firebase/firestore";

export type AttendanceStatus = "yes" | "maybe" | "no";

export type AdminResponse = {
  id: string;
  planId: string;
  eventId: string;
  guestId: string;
  attendanceStatus: AttendanceStatus;
};

export type AttendanceSummary = {
  yes: number;
  maybe: number;
  no: number;
};

export function subscribePlanResponses({
  db,
  ownerUid,
  planId,
  onResponses,
  onError
}: {
  db: Firestore;
  ownerUid: string;
  planId: string;
  onResponses: (responses: AdminResponse[]) => void;
  onError: (error: Error) => void;
}): Unsubscribe {
  const responsesQuery = query(
    collection(db, "responses"),
    where("ownerUid", "==", ownerUid),
    where("planId", "==", planId)
  );

  return onSnapshot(
    responsesQuery,
    (snapshot) => {
      onResponses(snapshot.docs.map(mapResponseSnapshot));
    },
    (error) => {
      onError(error);
    }
  );
}

export function buildEventSummaryMap(responses: AdminResponse[]) {
  return responses.reduce<Record<string, AttendanceSummary>>((summaryMap, response) => {
    const summary = summaryMap[response.eventId] ?? {
      yes: 0,
      maybe: 0,
      no: 0
    };

    summary[response.attendanceStatus] += 1;
    summaryMap[response.eventId] = summary;

    return summaryMap;
  }, {});
}

function mapResponseSnapshot(
  snapshot: QueryDocumentSnapshot<DocumentData>
): AdminResponse {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    planId: String(data.planId ?? ""),
    eventId: String(data.eventId ?? ""),
    guestId: String(data.guestId ?? ""),
    attendanceStatus:
      data.attendanceStatus === "maybe"
        ? "maybe"
        : data.attendanceStatus === "no"
          ? "no"
          : "yes"
  };
}
