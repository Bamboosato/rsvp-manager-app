import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { authenticateFirebaseRequest, getFirestoreDocument, patchFirestoreDocument, hashSecret, verifySecret, normalizeNickname } from "@/lib/firebase/serverApi";
import { PATCH } from "@/app/api/admin/plans/[planId]/route";

function request(token?: string) {
  return new NextRequest("http://localhost/api/admin/plans/plan-1", {
    method: "PATCH", headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ name: "CI plan", yearMonth: "2026-10" })
  });
}

describe("Firebase REST authentication and ownership", () => {
  it("does not call Firebase when the caller is unauthenticated", async () => {
    expect(await authenticateFirebaseRequest(request())).toBeNull(); expect(fetch).not.toHaveBeenCalled();
    expect((await PATCH(request(), { params: Promise.resolve({ planId: "plan-1" }) })).status).toBe(401);
  });
  it("rejects an expired or unknown ID token", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 401 }));
    expect(await authenticateFirebaseRequest(request("expired"))).toBeNull();
  });
  it("does not accept a lookup response without a user ID", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ users: [{ email: "ci@rsvp.test" }] }));
    expect(await authenticateFirebaseRequest(request("token"))).toBeNull();
  });
  it.each(["owner-1", "other-owner"])("only the owner may update the plan (caller %s)", async (uid) => {
    const calls: string[] = [];
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const path = String(url); calls.push(`${init?.method ?? "GET"} ${path}`);
      if (path.startsWith("https://identitytoolkit.googleapis.com/")) return Response.json({ users: [{ localId: uid }] });
      if (path.includes("/plans/plan-1") && (!init?.method || init.method === "GET")) return Response.json({ fields: { ownerUid: { stringValue: "owner-1" } } });
      if (path.includes("/plans/plan-1") && init?.method === "PATCH") return Response.json({});
      throw new Error(`Unexpected REST request: ${path}`);
    });
    const result = await PATCH(request("test-token"), { params: Promise.resolve({ planId: "plan-1" }) });
    expect(result.status).toBe(uid === "owner-1" ? 200 : 404);
    expect(calls.filter((call) => call.startsWith("PATCH"))).toHaveLength(uid === "owner-1" ? 1 : 0);
  });
  it("distinguishes a missing document from a permission error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("", { status: 404 })).mockResolvedValueOnce(new Response("", { status: 403 }));
    const options = { idToken: "token", collection: "plans", documentId: "one/two" };
    expect(await getFirestoreDocument(options)).toBeNull();
    await expect(getFirestoreDocument(options)).rejects.toThrow("403");
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("one%2Ftwo");
  });
  it("updates only explicitly named fields and surfaces a failed write", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 503 }));
    await expect(patchFirestoreDocument({ idToken: "token", collection: "plans", documentId: "plan-1", fields: { name: { stringValue: "CI" } } })).rejects.toThrow("503");
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("updateMask.fieldPaths=name");
  });
});

describe("PIN/access-code hashing and nickname identity", () => {
  it("uses distinct salts while recognizing only the correct secret", () => {
    const first = hashSecret("0123"), second = hashSecret("0123");
    expect(first).not.toBe(second); expect(verifySecret("0123", first)).toBe(true);
    expect(verifySecret("0124", first)).toBe(false); expect(verifySecret("0123", "invalid")).toBe(false);
  });
  it("normalizes full-width Latin text, case, and repeated spaces", () => {
    expect(normalizeNickname("  ＣＩ　Guest  ")).toBe("ci guest");
  });
});
