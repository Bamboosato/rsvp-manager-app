import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { saveInviteResponses, listGuestResponses } from "@/lib/invite/server";
import { eventFixture, planFixture } from "./fixtures";

vi.mock("@/lib/firebase/admin", () => ({ getFirebaseAdminFirestore: vi.fn() }));
function storeFixture(events = [eventFixture()], exists = false) {
  const eventQuery = { where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ docs: events.map((event) => ({ id: event.id, data: () => event })) }) };
  const responseRef = { get: vi.fn().mockResolvedValue({ exists }) };
  const responseQuery = { where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ docs: [] }), doc: vi.fn().mockReturnValue(responseRef) };
  const batch = { update: vi.fn(), create: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
  const db = { collection: vi.fn((name: string) => name === "events" ? eventQuery : responseQuery), batch: vi.fn().mockReturnValue(batch) };
  vi.mocked(getFirebaseAdminFirestore).mockReturnValue(db as unknown as ReturnType<typeof getFirebaseAdminFirestore>);
  return { db, eventQuery, responseQuery, responseRef, batch };
}
beforeEach(() => vi.mocked(getFirebaseAdminFirestore).mockReset());
const input = () => ({ plan: planFixture(), guestId: "guest-1", allowedEventIds: ["event-1"],
  responses: [{ eventId: "event-1", attendanceStatus: "yes" as const, comment: "" }] });

describe("RSVP persistence preconditions", () => {
  it.each(["closed", "unshared", "removed"])("blocks all writes if an event is %s", async (state) => {
    const event = eventFixture(); if (state === "closed") event.status = "closed";
    const store = storeFixture(state === "removed" ? [] : [event]); const body = input();
    if (state === "unshared") body.allowedEventIds = [];
    expect((await saveInviteResponses(body)).ok).toBe(false);
    expect(store.db.batch).not.toHaveBeenCalled(); expect(store.batch.commit).not.toHaveBeenCalled();
  });
  it("creates the answer with session-owned identity and no plaintext PIN", async () => {
    const store = storeFixture(); expect((await saveInviteResponses(input())).ok).toBe(true);
    expect(store.responseQuery.doc).toHaveBeenCalledWith("event-1_guest-1");
    expect(store.batch.create).toHaveBeenCalledWith(store.responseRef, expect.objectContaining({
      ownerUid: "owner-1", planId: "plan-1", guestId: "guest-1", eventId: "event-1", attendanceStatus: "yes", comment: null
    }));
    expect(store.batch.commit).toHaveBeenCalledOnce();
  });
  it("updates an existing answer instead of creating a second one", async () => {
    const store = storeFixture([eventFixture()], true); const body = input(); body.responses[0].comment = "Changed";
    expect((await saveInviteResponses(body)).ok).toBe(true);
    expect(store.batch.create).not.toHaveBeenCalled();
    expect(store.batch.update).toHaveBeenCalledWith(store.responseRef, expect.objectContaining({ comment: "Changed", isActive: true }));
  });
  it("propagates a failed batch commit instead of acknowledging a saved answer", async () => {
    const store = storeFixture(); store.batch.commit.mockRejectedValue(new Error("Commit failed"));
    await expect(saveInviteResponses(input())).rejects.toThrow("Commit failed");
  });
  it("scopes reads to owner, plan and guest and excludes deactivated answers", async () => {
    const store = storeFixture();
    store.responseQuery.get.mockResolvedValue({ docs: [
      { id: "active", data: () => ({ isActive: true, eventId: "event-1" }) },
      { id: "inactive", data: () => ({ isActive: false, eventId: "event-2" }) }
    ] });
    const results = await listGuestResponses({ ownerUid: "owner-1", planId: "plan-1", guestId: "guest-1" });
    expect(results.map((response) => response.id)).toEqual(["active"]);
    expect(store.responseQuery.where.mock.calls).toEqual([
      ["ownerUid", "==", "owner-1"], ["planId", "==", "plan-1"], ["guestId", "==", "guest-1"]
    ]);
  });
});
