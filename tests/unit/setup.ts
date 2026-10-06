import { beforeEach, vi } from "vitest";

beforeEach(() => {
  // Every test must explicitly describe its external responses. No real Firebase/LINE access.
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected external fetch in unit test."); }));
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "ci-dummy-key");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "demo-rsvp-ci");
  vi.stubEnv("INVITE_SESSION_SECRET", "ci-only-invite-session-secret");
  vi.stubEnv("LINE_CHANNEL_SECRET", "ci-only-line-secret");
  vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "ci-only-line-token");
});
