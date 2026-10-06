import { test as base, expect, type Page } from "@playwright/test";

const test = base.extend<{ networkGuard: string[] }>({
  networkGuard: [async ({ context }, use) => {
    const unexpected: string[] = [];
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== "http://127.0.0.1:3100" || url.pathname.startsWith("/api/")) {
        unexpected.push(`${route.request().method()} ${url.origin}${url.pathname}`);
        await route.abort("blockedbyclient");
      } else await route.continue();
    });
    await use(unexpected);
    expect(unexpected, "Every external/API request must be explicitly mocked.").toEqual([]);
  }, { auto: true }]
});

type Answer = { eventId: string; attendanceStatus: "yes" | "maybe" | "no"; comment: string };
async function mockInvite(page: Page, options: { protected?: boolean; active?: boolean } = {}) {
  // Each test owns fresh state; neither Firebase nor LINE is called.
  const state = { authenticated: false, passwordAccepted: false, closeOnSave: false,
    answers: [] as Answer[], nickname: "", writes: 0 };
  const plan = { name: "CI plan", yearMonth: "2026-10", hasPassword: Boolean(options.protected) };
  await page.route("**/api/i/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const reply = (status: number, data: unknown) => route.fulfill({ status, json: data });
    if (options.active === false) return reply(410, { message: "このプランは現在利用できません。" });
    if (path === "/api/i/ABC234" && method === "GET") return reply(200, { plan });
    if (path === "/api/i/ABC234/password" && method === "POST") {
      state.passwordAccepted = route.request().postDataJSON().accessCode === "123456";
      return reply(state.passwordAccepted ? 200 : 401, state.passwordAccepted ? { ok: true } : { message: "アクセスコードが正しくありません。" });
    }
    if (path === "/api/i/ABC234/entry" && method === "POST") {
      if (plan.hasPassword && !state.passwordAccepted) return reply(401, { message: "アクセスコードを入力してください。" });
      const body = route.request().postDataJSON(); state.nickname = body.nickname;
      state.authenticated = true; return reply(200, { guest: { nickname: state.nickname } });
    }
    if (path === "/api/i/ABC234/responses") {
      if (!state.authenticated) return reply(401, { message: "再度ニックネームとPINを入力してください。" });
      if (method === "GET") return reply(200, { plan, guest: { nickname: state.nickname }, events: [{
        id: "event-1", eventDate: "2026-10-20", timeSlot: "AM", timeDetail: "09:00", name: "CI event", place: "CI room",
        status: "accepting", response: state.answers[0] ? { ...state.answers[0], answeredAt: "2026-10-06T00:00:00Z" } : null
      }] });
      if (method === "POST") {
        if (state.closeOnSave) return reply(409, { message: "一部のイベントが締切済になったため保存できませんでした。内容を確認してください。" });
        state.answers = route.request().postDataJSON().responses; state.writes++;
        return reply(200, { ok: true });
      }
    }
    throw new Error(`Unexpected invitation API: ${method} ${path}`);
  });
  return state;
}
async function enter(page: Page) {
  await page.goto("/i/ABC234/entry");
  await page.getByLabel("ニックネーム", { exact: false }).fill("CI Guest");
  await page.getByLabel("PIN（数字4桁）", { exact: false }).fill("0123");
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await expect(page).toHaveURL(/\/i\/ABC234\/responses$/);
  await expect(page.getByRole("button", { name: "出席", exact: true })).toBeVisible();
}

test("invitation → answer → complete → reload and change answer", async ({ page }) => {
  const state = await mockInvite(page);
  await page.goto("/i/ABC234");
  await page.getByRole("link", { name: "出欠入力へ進む" }).click();
  await page.getByLabel("ニックネーム", { exact: false }).fill("CI Guest");
  await page.getByLabel("PIN（数字4桁）", { exact: false }).fill("0123");
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await page.getByRole("button", { name: "出席", exact: true }).click();
  await page.getByRole("textbox", { name: "コメント", exact: true }).fill("CI first answer");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("heading", { name: "出欠入力が完了しました。" })).toBeVisible();
  await expect(page.getByText("CI first answer", { exact: true })).toBeVisible();
  await page.goto("/i/ABC234/responses");
  await expect(page.getByRole("button", { name: "出席", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await page.getByRole("button", { name: "欠席", exact: true }).click();
  await page.getByRole("textbox", { name: "コメント", exact: true }).fill("CI changed answer");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("heading", { name: "出欠入力が完了しました。" })).toBeVisible();
  expect(state.writes).toBe(2);
  expect(state.answers).toEqual([{ eventId: "event-1", attendanceStatus: "no", comment: "CI changed answer" }]);
});

test("protected invitation rejects the wrong access code and accepts the correct one", async ({ page }) => {
  await mockInvite(page, { protected: true }); await page.goto("/i/ABC234");
  await page.getByLabel("アクセスコード", { exact: false }).fill("999999");
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await expect(page.getByText("アクセスコードが正しくありません。", { exact: true })).toBeVisible();
  await page.getByLabel("アクセスコード", { exact: false }).fill("123456");
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await expect(page).toHaveURL(/\/i\/ABC234\/entry$/);
  await expect(page.getByLabel("ニックネーム", { exact: false })).toBeVisible();
});

test("inactive invitation shows the unavailable message", async ({ page }) => {
  await mockInvite(page, { active: false }); await page.goto("/i/ABC234");
  await expect(page.getByText("このプランは現在利用できません。", { exact: true })).toBeVisible();
});

test("a direct response-page visit without a session offers guest entry", async ({ page }) => {
  await mockInvite(page); await page.goto("/i/ABC234/responses");
  await expect(page.getByText("再度ニックネームとPINを入力してください。", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "ニックネームとPINを入力する" }).click();
  await expect(page).toHaveURL(/\/i\/ABC234\/entry$/);
});

test("session expiry during editing reports failure and does not acknowledge a write", async ({ page }) => {
  const state = await mockInvite(page); await enter(page);
  await page.getByRole("button", { name: "出席", exact: true }).click(); state.authenticated = false;
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("再度ニックネームとPINを入力してください。", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/responses$/); expect(state.writes).toBe(0);
});

test("closing an event during editing preserves input and reports the conflict", async ({ page }) => {
  const state = await mockInvite(page); await enter(page);
  await page.getByRole("button", { name: "未定", exact: true }).click(); state.closeOnSave = true;
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("一部のイベントが締切済になったため保存できませんでした。内容を確認してください。", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "未定", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(state.writes).toBe(0);
});
