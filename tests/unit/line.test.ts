import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyLineSignature, pushLineText } from "@/lib/line/client";
import { markLineUserUnfollowed, registerLineFriendByCode } from "@/lib/line/friends";
import { POST } from "@/app/api/line/webhook/[lineAccountId]/route";

vi.mock("@/lib/line/friends", () => ({ markLineUserUnfollowed: vi.fn(), registerLineFriendByCode: vi.fn() }));
const sign = (body: string) => createHmac("sha256", "ci-only-line-secret").update(body).digest("base64");
function webhook(body: string, signature: string | null = sign(body)) {
  return new NextRequest("http://localhost/api/line/webhook/default", { method: "POST", body,
    headers: signature ? { "x-line-signature": signature } : {} });
}
beforeEach(() => {
  vi.mocked(markLineUserUnfollowed).mockReset().mockResolvedValue(undefined);
  vi.mocked(registerLineFriendByCode).mockReset();
});

describe("LINE signature and delivery", () => {
  it("validates the original raw body and rejects missing, short or altered signatures", () => {
    const body = '{"events":[]}';
    expect(verifyLineSignature({ body, signature: sign(body) })).toBe(true);
    for (const signature of [null, "short", sign(`${body} `)]) expect(verifyLineSignature({ body, signature })).toBe(false);
  });
  it("never processes an unsigned webhook", async () => {
    expect((await POST(webhook('{"events":[]}', null), { params: Promise.resolve({ lineAccountId: "default" }) })).status).toBe(401);
    expect(markLineUserUnfollowed).not.toHaveBeenCalled(); expect(registerLineFriendByCode).not.toHaveBeenCalled();
  });
  it("rejects signed malformed JSON", async () => {
    expect((await POST(webhook("{"), { params: Promise.resolve({ lineAccountId: "default" }) })).status).toBe(400);
  });
  it("continues other webhook events after one event fails", async () => {
    vi.mocked(markLineUserUnfollowed).mockRejectedValueOnce(new Error("Temporary DB failure"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const body = JSON.stringify({ events: ["user-1", "user-2"].map((userId) => ({ type: "unfollow", source: { type: "user", userId } })) });
    expect((await POST(webhook(body), { params: Promise.resolve({ lineAccountId: "default" }) })).status).toBe(200);
    expect(markLineUserUnfollowed).toHaveBeenCalledTimes(2);
    expect(markLineUserUnfollowed).toHaveBeenLastCalledWith(expect.objectContaining({ lineUserId: "user-2" }));
  });
  it("does not send a message without a configured token", async () => {
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "");
    expect((await pushLineText({ to: "user-1", text: "CI" })).ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("preserves each delivery outcome and includes a retry key", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ message: "Rate limited" }, { status: 429 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    const failed = await pushLineText({ to: "user-1", text: "CI" });
    const successful = await pushLineText({ to: "user-2", text: "CI" });
    expect(failed).toMatchObject({ ok: false, status: 429, message: "Rate limited" });
    expect(successful.ok).toBe(true);
    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["X-Line-Retry-Key"]).toMatch(/^[a-f0-9-]{36}$/);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)).to).toBe("user-1");
  });
});
