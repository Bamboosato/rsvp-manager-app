import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { getLineChannelAccessToken, requireLineChannelSecret } from "./config";

type LineProfileResponse = {
  userId?: string;
  displayName?: string;
  pictureUrl?: string;
};

export type LineUserProfile = {
  userId: string;
  displayName: string;
  pictureUrl: string | null;
};

const lineApiBaseUrl = "https://api.line.me/v2/bot";

export function verifyLineSignature({
  body,
  signature
}: {
  body: string;
  signature: string | null;
}) {
  if (!signature) {
    return false;
  }

  const secret = requireLineChannelSecret();
  const expected = createHmac("sha256", secret).update(body).digest("base64");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function getLineUserProfile(userId: string): Promise<LineUserProfile | null> {
  const token = getLineChannelAccessToken();

  if (!token) {
    return null;
  }

  const response = await fetch(
    `${lineApiBaseUrl}/profile/${encodeURIComponent(userId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    return null;
  }

  const profile = (await response.json()) as LineProfileResponse;

  if (!profile.userId) {
    return null;
  }

  return {
    userId: profile.userId,
    displayName: profile.displayName?.trim() || "LINEユーザー",
    pictureUrl: profile.pictureUrl?.trim() || null
  };
}

export async function replyLineText({
  replyToken,
  text
}: {
  replyToken: string;
  text: string;
}) {
  const token = getLineChannelAccessToken();

  if (!token) {
    return false;
  }

  const response = await fetch(`${lineApiBaseUrl}/message/reply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text
        }
      ]
    })
  });

  return response.ok;
}

export async function pushLineText({
  to,
  text
}: {
  to: string;
  text: string;
}) {
  const token = getLineChannelAccessToken();

  if (!token) {
    return {
      ok: false,
      status: 500,
      message: "LINEチャネルアクセストークンが設定されていません。"
    };
  }

  const response = await fetch(`${lineApiBaseUrl}/message/push`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Line-Retry-Key": randomUUID()
    },
    body: JSON.stringify({
      to,
      messages: [
        {
          type: "text",
          text
        }
      ]
    })
  });

  if (response.ok) {
    return {
      ok: true,
      status: response.status,
      message: ""
    };
  }

  const body = (await response.json().catch(() => null)) as { message?: string } | null;

  return {
    ok: false,
    status: response.status,
    message: body?.message ?? "LINE送信に失敗しました。"
  };
}
