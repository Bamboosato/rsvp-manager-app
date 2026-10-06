import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findActiveInviteByCode } from "@/lib/invite/codeLookup";
import { createInviteGuest, findGuestByNickname, verifyGuestPin, listInviteEvents, listGuestResponses, saveInviteResponses } from "@/lib/invite/server";
import { hashSecret } from "@/lib/firebase/serverApi";
import { setInviteSession } from "@/lib/invite/session";
import { sendInviteResponseNotification } from "@/lib/notifications/server";
import { POST as entry } from "@/app/api/i/[inviteCode]/entry/route";
import { POST as password } from "@/app/api/i/[inviteCode]/password/route";
import { GET as load, POST as save } from "@/app/api/i/[inviteCode]/responses/route";
import { planFixture, shareFixture, guestFixture, eventFixture } from "./fixtures";

vi.mock("@/lib/invite/codeLookup", () => ({ findActiveInviteByCode: vi.fn() }));
vi.mock("@/lib/invite/server", async (original) => ({
  ...await original<typeof import("@/lib/invite/server")>(),
  createInviteGuest: vi.fn(), findGuestByNickname: vi.fn(), verifyGuestPin: vi.fn(),
  listInviteEvents: vi.fn(), listGuestResponses: vi.fn(), saveInviteResponses: vi.fn()
}));
vi.mock("@/lib/notifications/server", () => ({ sendInviteResponseNotification: vi.fn() }));
const context = () => ({ params: Promise.resolve({ inviteCode: "ABC234" }) });
function request(body?: unknown, signed = false, method = "POST") {
  const response = NextResponse.json({});
  if (signed) setInviteSession(response, { kind: "invite", inviteCode: "ABC234", planId: "plan-1", ownerUid: "owner-1", guestId: "guest-1", nickname: "CI Guest" });
  return new NextRequest("http://localhost/api/i/ABC234/responses", { method, headers: {
    "content-type": "application/json", ...(signed ? { cookie: `rsvp_invite_session=${response.cookies.get("rsvp_invite_session")!.value}` } : {})
  }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
beforeEach(() => {
  vi.mocked(findActiveInviteByCode).mockReset().mockResolvedValue({ ok: true, plan: planFixture(), shareToken: shareFixture() });
  vi.mocked(findGuestByNickname).mockReset().mockResolvedValue(null);
  vi.mocked(createInviteGuest).mockReset().mockResolvedValue({ ...guestFixture(),
    id: "00000000-0000-4000-8000-000000000001", guestId: "00000000-0000-4000-8000-000000000001" });
  vi.mocked(verifyGuestPin).mockReset().mockReturnValue(true);
  vi.mocked(listInviteEvents).mockReset().mockResolvedValue([eventFixture()]);
  vi.mocked(listGuestResponses).mockReset().mockResolvedValue([]);
  vi.mocked(saveInviteResponses).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(sendInviteResponseNotification).mockReset().mockResolvedValue(undefined);
});

describe("invitation entry", () => {
  it("creates a new guest and issues a guest session", async () => {
    const response = await entry(request({ nickname: " CI Guest ", pin: "0123" }), context());
    expect(response.status).toBe(200); expect(response.cookies.get("rsvp_invite_session")).toBeDefined();
    expect(createInviteGuest).toHaveBeenCalledWith({ ownerUid: "owner-1", planId: "plan-1", nickname: "CI Guest", pin: "0123" });
  });
  it("requires an access-code session before protected-plan entry", async () => {
    vi.mocked(findActiveInviteByCode).mockResolvedValue({ ok: true, plan: { ...planFixture(), passwordHash: hashSecret("123456") }, shareToken: shareFixture() });
    expect((await entry(request({ nickname: "CI", pin: "0123" }), context())).status).toBe(401);
    expect(createInviteGuest).not.toHaveBeenCalled();
  });
  it("requires the existing guest PIN and never creates a duplicate guest", async () => {
    vi.mocked(findGuestByNickname).mockResolvedValue(guestFixture()); vi.mocked(verifyGuestPin).mockReturnValue(false);
    const result = await entry(request({ nickname: "CI Guest", pin: "9999" }), context());
    expect(result.status).toBe(409); expect(result.cookies.get("rsvp_invite_session")).toBeUndefined();
    expect(createInviteGuest).not.toHaveBeenCalled();
  });
  it.each([{ nickname: "", pin: "1234" }, { nickname: "a".repeat(41), pin: "1234" }, { nickname: "CI", pin: "123" }, { nickname: "CI", pin: "１２３４" }, null])("rejects invalid nickname/PIN input %#", async (body) => {
    expect((await entry(request(body), context())).status).toBe(400); expect(createInviteGuest).not.toHaveBeenCalled();
  });
  it("accepts the 40-character nickname boundary", async () => {
    expect((await entry(request({ nickname: "a".repeat(40), pin: "0000" }), context())).status).toBe(200);
  });
  it.each([404, 410] as const)("preserves rejected invitation status %i without creating a guest", async (status) => {
    vi.mocked(findActiveInviteByCode).mockResolvedValue({ ok: false, status, message: "Unavailable" });
    expect((await entry(request({ nickname: "CI", pin: "0123" }), context())).status).toBe(status);
    expect(createInviteGuest).not.toHaveBeenCalled();
  });
  it.each(["12345", "123456", "123456789012", "1234567890123"])("checks access-code length and secret together: %s", async (code) => {
    vi.mocked(findActiveInviteByCode).mockResolvedValue({ ok: true, plan: { ...planFixture(), passwordHash: hashSecret(code) }, shareToken: shareFixture() });
    const response = await password(request({ accessCode: code }), context());
    expect(response.status).toBe(code.length >= 6 && code.length <= 12 ? 200 : 401);
    expect(Boolean(response.cookies.get("rsvp_invite_password"))).toBe(response.status === 200);
  });
  it("does not issue a password session for a wrong but well-formed access code", async () => {
    vi.mocked(findActiveInviteByCode).mockResolvedValue({ ok: true, plan: { ...planFixture(), passwordHash: hashSecret("123456") }, shareToken: shareFixture() });
    const response = await password(request({ accessCode: "654321" }), context());
    expect(response.status).toBe(401); expect(response.cookies.get("rsvp_invite_password")).toBeUndefined();
  });
});

describe("RSVP API contracts", () => {
  const answer = { eventId: "event-1", attendanceStatus: "yes", comment: "" };
  it("requires a signed guest session before reads and writes", async () => {
    expect((await load(request(undefined, false, "GET"), context())).status).toBe(401);
    expect((await save(request({ responses: [answer] }), context())).status).toBe(401);
    expect(findActiveInviteByCode).not.toHaveBeenCalled(); expect(saveInviteResponses).not.toHaveBeenCalled();
  });
  it.each(["plan", "owner", "token-owner"])("rejects a session/invitation %s mismatch", async (field) => {
    const plan = planFixture(), shareToken = shareFixture();
    if (field === "plan") plan.id = "other-plan";
    if (field === "owner") plan.ownerUid = "other-owner";
    if (field === "token-owner") shareToken.ownerUid = "other-owner";
    vi.mocked(findActiveInviteByCode).mockResolvedValue({ ok: true, plan, shareToken });
    expect((await save(request({ responses: [answer] }, true), context())).status).toBe(404);
    expect(saveInviteResponses).not.toHaveBeenCalled();
  });
  it("shows only shared events and queries only the session guest", async () => {
    vi.mocked(listInviteEvents).mockResolvedValue([eventFixture(), { ...eventFixture(), id: "private-event" }]);
    const response = await load(request(undefined, true, "GET"), context());
    expect((await response.json()).events.map((event: { id: string }) => event.id)).toEqual(["event-1"]);
    expect(listGuestResponses).toHaveBeenCalledWith({ ownerUid: "owner-1", planId: "plan-1", guestId: "guest-1" });
  });
  it.each([0, 1, 100, 101])("enforces answer count boundary %i", async (count) => {
    const responses = Array.from({ length: count }, (_, i) => ({ ...answer, eventId: `event-${i}` }));
    expect((await save(request({ responses }, true), context())).status).toBe(count > 0 && count <= 100 ? 200 : 400);
  });
  it.each([500, 501])("enforces comment length boundary %i", async (length) => {
    expect((await save(request({ responses: [{ ...answer, comment: "a".repeat(length) }] }, true), context())).status).toBe(length <= 500 ? 200 : 400);
  });
  it.each([null, { responses: [null] }, { responses: [{ ...answer, attendanceStatus: "invalid" }] }])("rejects malformed response input %#", async (body) => {
    expect((await save(request(body, true), context())).status).toBe(400); expect(saveInviteResponses).not.toHaveBeenCalled();
  });
  it("uses signed identity instead of identity fields supplied in the body", async () => {
    expect((await save(request({ responses: [answer], guestId: "other-guest", ownerUid: "other-owner" }, true), context())).status).toBe(200);
    expect(saveInviteResponses).toHaveBeenCalledWith(expect.objectContaining({ guestId: "guest-1", allowedEventIds: ["event-1"] }));
  });
  it("reports a state change that closes the event without sending a notification", async () => {
    vi.mocked(saveInviteResponses).mockResolvedValue({ ok: false, message: "Closed" });
    expect((await save(request({ responses: [answer] }, true), context())).status).toBe(409);
    expect(sendInviteResponseNotification).not.toHaveBeenCalled();
  });
  it("acknowledges a persisted answer even if its notification fails", async () => {
    vi.mocked(sendInviteResponseNotification).mockRejectedValue(new Error("FCM unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await save(request({ responses: [answer] }, true), context())).status).toBe(200);
  });
});
