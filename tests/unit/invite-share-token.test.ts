import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, expect, it, vi } from "vitest";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { findActiveInviteShareTokenByCode, validateInviteShareTokenParam } from "@/lib/invite/shareTokens";

vi.mock("@/lib/firebase/admin", () => ({ getFirebaseAdminFirestore: vi.fn() }));
beforeEach(() => vi.mocked(getFirebaseAdminFirestore).mockReset());
function tokenStore(overrides: Record<string, unknown> = {}, exists = true) {
  const get = vi.fn().mockResolvedValue({ exists, id: "ABC234", data: () => ({
    ownerUid: "owner-1", planId: "plan-1", publicToken: "public-1", eventIds: ["event-1"], status: "active", isActive: true, ...overrides
  }) });
  const doc = vi.fn().mockReturnValue({ get }); const db = { collection: vi.fn().mockReturnValue({ doc }) };
  vi.mocked(getFirebaseAdminFirestore).mockReturnValue(db as unknown as ReturnType<typeof getFirebaseAdminFirestore>);
  return { db, doc };
}
it("normalizes the invite code before looking up the exact document", async () => {
  const store = tokenStore(); expect((await findActiveInviteShareTokenByCode(" abc234 "))?.id).toBe("ABC234");
  expect(store.doc).toHaveBeenCalledWith("ABC234");
});
it.each([null, "", "ABC23", "ABC2345", "ABC/34"])("rejects malformed invite code %s before accessing the database", async (code) => {
  expect(validateInviteShareTokenParam(code).ok).toBe(false);
  expect(await findActiveInviteShareTokenByCode(code ?? "")).toBeNull();
  expect(getFirebaseAdminFirestore).not.toHaveBeenCalled();
});
it.each([{ status: "revoked" }, { isActive: false }, { eventIds: [] }])("rejects revoked/inactive/empty-scope token %#", async (fields) => {
  tokenStore(fields); expect(await findActiveInviteShareTokenByCode("ABC234")).toBeNull();
});
it("rejects a deleted invite-code document", async () => {
  tokenStore({}, false); expect(await findActiveInviteShareTokenByCode("ABC234")).toBeNull();
});
it.each([-1, 0, 1])("enforces token expiration at the exact timestamp (offset %i ms)", async (offset) => {
  const expires = 1_800_000_000_000; tokenStore({ expiresAt: Timestamp.fromMillis(expires) });
  vi.spyOn(Date, "now").mockReturnValue(expires + offset);
  expect(Boolean(await findActiveInviteShareTokenByCode("ABC234"))).toBe(offset < 0);
});
