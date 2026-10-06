import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readInviteSession, readInvitePasswordSession, setInviteSession, setInvitePasswordSession } from "@/lib/invite/session";

const session = { kind: "invite" as const, inviteCode: "ABC234", planId: "plan-1", ownerUid: "owner-1", guestId: "guest-1", nickname: "CI Guest" };
const seconds = 1_800_000_000;
function request(cookie: string, name = "rsvp_invite_session") {
  return new NextRequest("http://localhost/i/ABC234", { headers: { cookie: `${name}=${cookie}` } });
}
function signedCookie() {
  vi.spyOn(Date, "now").mockReturnValue(seconds * 1000);
  const response = NextResponse.json({ ok: true }); setInviteSession(response, session);
  return response.cookies.get("rsvp_invite_session")!;
}
afterEach(() => vi.restoreAllMocks());

describe("signed invitation sessions", () => {
  it("keeps guest identity in a signed HttpOnly SameSite cookie with a 24-hour lifetime", () => {
    const cookie = signedCookie();
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 });
    expect(readInviteSession(request(cookie.value), "ABC234")).toMatchObject(session);
  });
  it("rejects reuse for a different invitation", () => {
    expect(readInviteSession(request(signedCookie().value), "XYZ789")).toBeNull();
  });
  it("rejects missing cookies and altered signatures", () => {
    expect(readInviteSession(new NextRequest("http://localhost"), "ABC234")).toBeNull();
    const cookie = signedCookie().value;
    expect(readInviteSession(request(`${cookie.slice(0, -1)}!`), "ABC234")).toBeNull();
    expect(readInviteSession(request("payload.short"), "ABC234")).toBeNull();
  });
  it.each([-1, 0, 1])("expires at the exact boundary (offset %i seconds)", (offset) => {
    const cookie = signedCookie().value;
    vi.spyOn(Date, "now").mockReturnValue((seconds + 86400 + offset) * 1000);
    expect(Boolean(readInviteSession(request(cookie), "ABC234"))).toBe(offset < 0);
  });
  it("does not treat an access-code session as a guest identity", () => {
    const response = NextResponse.json({ ok: true });
    setInvitePasswordSession(response, { kind: "password", inviteCode: "ABC234", planId: "plan-1" });
    const value = response.cookies.get("rsvp_invite_password")!.value;
    expect(readInvitePasswordSession(request(value, "rsvp_invite_password"), "ABC234")).toMatchObject({ planId: "plan-1" });
    expect(readInviteSession(request(value), "ABC234")).toBeNull();
  });
  it("rejects a correctly signed payload that is not JSON", () => {
    const body = Buffer.from("not JSON").toString("base64url");
    const signature = createHmac("sha256", "ci-only-invite-session-secret").update(body).digest("base64url");
    expect(readInviteSession(request(`${body}.${signature}`), "ABC234")).toBeNull();
  });
  it("marks production cookies Secure", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(signedCookie().secure).toBe(true);
  });
});
