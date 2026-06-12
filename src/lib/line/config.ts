export const defaultLineAccountId =
  process.env.LINE_DEFAULT_ACCOUNT_ID?.trim() || "default";

export function getLineBasicId() {
  return (
    process.env.LINE_BASIC_ID ??
    process.env.LINE_OFFICIAL_ACCOUNT_BASIC_ID ??
    process.env.NEXT_PUBLIC_LINE_BASIC_ID ??
    ""
  ).trim();
}

export function getLineChannelAccessToken() {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim() ?? "";
}

export function getLineChannelSecret() {
  return process.env.LINE_CHANNEL_SECRET?.trim() ?? "";
}

export function requireLineChannelAccessToken() {
  const token = getLineChannelAccessToken();

  if (!token) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN.");
  }

  return token;
}

export function requireLineChannelSecret() {
  const secret = getLineChannelSecret();

  if (!secret) {
    throw new Error("Missing LINE_CHANNEL_SECRET.");
  }

  return secret;
}

export function normalizeLineAccountId(value: string | undefined) {
  const accountId = value?.trim() || defaultLineAccountId;

  return accountId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80) || "default";
}

export function buildLineRegistrationText(code: string) {
  return code;
}

export function buildLineRegistrationUrl({
  basicId,
  text
}: {
  basicId: string;
  text: string;
}) {
  const normalizedBasicId = basicId.trim();

  if (!normalizedBasicId) {
    return null;
  }

  return `https://line.me/R/oaMessage/${encodeURIComponent(
    normalizedBasicId
  )}/?${encodeURIComponent(text)}`;
}
