import { beforeEach, expect, it, vi } from "vitest";
import { findActiveInviteByCode } from "@/lib/invite/codeLookup";
import { findActiveInviteShareTokenByCode } from "@/lib/invite/shareTokens";
import { findPlanByPublicToken } from "@/lib/invite/server";
import { planFixture, shareFixture } from "./fixtures";

vi.mock("@/lib/invite/shareTokens", () => ({ findActiveInviteShareTokenByCode: vi.fn() }));
vi.mock("@/lib/invite/server", () => ({ findPlanByPublicToken: vi.fn() }));
beforeEach(() => {
  vi.mocked(findActiveInviteShareTokenByCode).mockReset().mockResolvedValue(shareFixture());
  vi.mocked(findPlanByPublicToken).mockReset().mockResolvedValue(planFixture());
});
it("accepts a matching active owner and plan", async () => {
  expect((await findActiveInviteByCode("ABC234")).ok).toBe(true);
});
it("rejects missing or revoked share tokens before looking up a plan", async () => {
  vi.mocked(findActiveInviteShareTokenByCode).mockResolvedValue(null);
  expect(await findActiveInviteByCode("ABC234")).toMatchObject({ ok: false, status: 404 });
  expect(findPlanByPublicToken).not.toHaveBeenCalled();
});
it.each(["missing", "plan", "owner", "inactive"])("rejects a %s plan/token relationship", async (state) => {
  const plan = planFixture();
  if (state === "plan") plan.id = "other-plan";
  if (state === "owner") plan.ownerUid = "other-owner";
  if (state === "inactive") plan.isActive = false;
  vi.mocked(findPlanByPublicToken).mockResolvedValue(state === "missing" ? null : plan);
  expect(await findActiveInviteByCode("ABC234")).toMatchObject({ ok: false, status: state === "inactive" ? 410 : 404 });
});
