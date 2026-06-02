import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export type InviteSession = {
  kind: "invite";
  publicToken: string;
  planId: string;
  ownerUid: string;
  guestId: string;
  nickname: string;
  exp: number;
};

export type InvitePasswordSession = {
  kind: "password";
  publicToken: string;
  planId: string;
  exp: number;
};

const inviteSessionCookieName = "rsvp_invite_session";
const invitePasswordCookieName = "rsvp_invite_password";
const inviteSessionMaxAgeSeconds = 60 * 60 * 24;

export function readInviteSession(request: NextRequest, publicToken: string) {
  return readSignedCookie<InviteSession>({
    request,
    cookieName: inviteSessionCookieName,
    expectedKind: "invite",
    publicToken
  });
}

export function readInvitePasswordSession(request: NextRequest, publicToken: string) {
  return readSignedCookie<InvitePasswordSession>({
    request,
    cookieName: invitePasswordCookieName,
    expectedKind: "password",
    publicToken
  });
}

export function setInviteSession(response: NextResponse, session: Omit<InviteSession, "exp">) {
  setSignedCookie(response, inviteSessionCookieName, {
    ...session,
    exp: getExpiresAt()
  });
}

export function setInvitePasswordSession(
  response: NextResponse,
  session: Omit<InvitePasswordSession, "exp">
) {
  setSignedCookie(response, invitePasswordCookieName, {
    ...session,
    exp: getExpiresAt()
  });
}

function readSignedCookie<T extends InviteSession | InvitePasswordSession>({
  request,
  cookieName,
  expectedKind,
  publicToken
}: {
  request: NextRequest;
  cookieName: string;
  expectedKind: T["kind"];
  publicToken: string;
}) {
  const rawCookie = request.cookies.get(cookieName)?.value;

  if (!rawCookie) {
    return null;
  }

  const [payloadText, signature] = rawCookie.split(".");

  if (!payloadText || !signature || !verifySignature(payloadText, signature)) {
    return null;
  }

  const payload = parsePayload<T>(payloadText);

  if (
    !payload ||
    payload.kind !== expectedKind ||
    payload.publicToken !== publicToken ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  return payload;
}

function setSignedCookie<T extends InviteSession | InvitePasswordSession>(
  response: NextResponse,
  cookieName: string,
  payload: T
) {
  const payloadText = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(payloadText);

  response.cookies.set(cookieName, `${payloadText}.${signature}`, {
    httpOnly: true,
    maxAge: inviteSessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

function parsePayload<T>(payloadText: string): T | null {
  try {
    return JSON.parse(Buffer.from(payloadText, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function verifySignature(payloadText: string, signature: string) {
  const expectedSignature = signPayload(payloadText);
  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signature);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function signPayload(payloadText: string) {
  return createHmac("sha256", getInviteSessionSecret()).update(payloadText).digest("base64url");
}

function getInviteSessionSecret() {
  const secret = process.env.INVITE_SESSION_SECRET ?? process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!secret) {
    throw new Error("Missing INVITE_SESSION_SECRET.");
  }

  return secret;
}

function getExpiresAt() {
  return Math.floor(Date.now() / 1000) + inviteSessionMaxAgeSeconds;
}
