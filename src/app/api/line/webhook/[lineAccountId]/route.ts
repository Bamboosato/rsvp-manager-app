import { NextRequest, NextResponse } from "next/server";
import { normalizeLineAccountId } from "@/lib/line/config";
import { markLineUserUnfollowed, registerLineFriendByCode } from "@/lib/line/friends";
import { replyLineText, verifyLineSignature } from "@/lib/line/client";
import { parseLineRegistrationCode } from "@/lib/line/registrationCodes";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ lineAccountId: string }>;
};

type LineWebhookEvent = {
  type?: string;
  replyToken?: string;
  source?: {
    type?: string;
    userId?: string;
  };
  message?: {
    type?: string;
    text?: string;
  };
};

type LineWebhookPayload = {
  events?: LineWebhookEvent[];
};

export async function POST(request: NextRequest, context: RouteContext) {
  const body = await request.text();

  try {
    if (
      !verifyLineSignature({
        body,
        signature: request.headers.get("x-line-signature")
      })
    ) {
      return NextResponse.json({ message: "Invalid signature." }, { status: 401 });
    }
  } catch (error) {
    console.error("Failed to verify LINE signature.", error);
    return NextResponse.json({ message: "Invalid LINE configuration." }, { status: 500 });
  }

  const payload = parseLineWebhookPayload(body);

  if (!payload) {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 });
  }
  const events = Array.isArray(payload.events) ? payload.events : [];
  const { lineAccountId: rawLineAccountId } = await context.params;
  const lineAccountId = normalizeLineAccountId(rawLineAccountId);

  for (const event of events) {
    await handleLineWebhookEvent({
      lineAccountId,
      event
    }).catch((error) => {
      console.error("Failed to handle LINE webhook event.", error);
    });
  }

  return NextResponse.json({ ok: true });
}

function parseLineWebhookPayload(body: string) {
  try {
    return JSON.parse(body || "{}") as LineWebhookPayload;
  } catch {
    return null;
  }
}

async function handleLineWebhookEvent({
  lineAccountId,
  event
}: {
  lineAccountId: string;
  event: LineWebhookEvent;
}) {
  const lineUserId = event.source?.type === "user" ? event.source.userId : "";

  if (!lineUserId) {
    return;
  }

  if (event.type === "unfollow") {
    await markLineUserUnfollowed({
      lineAccountId,
      lineUserId
    });
    return;
  }

  if (event.type !== "message" || event.message?.type !== "text") {
    return;
  }

  const registrationCode = parseLineRegistrationCode(event.message.text ?? "");

  if (!registrationCode) {
    await replyIfPossible({
      replyToken: event.replyToken,
      text: "登録コードを確認できませんでした。案内URLから開き、入力欄に入った登録コードをそのまま送信してください。"
    });
    return;
  }

  const result = await registerLineFriendByCode({
    lineAccountId,
    lineUserId,
    code: registrationCode
  });

  if (!result.ok) {
    await replyIfPossible({
      replyToken: event.replyToken,
      text: "登録コードを確認できませんでした。案内元の幹事さんに、最新のLINE登録用URLを確認してください。"
    });
    return;
  }

  await replyIfPossible({
    replyToken: event.replyToken,
    text: "登録しました。今後このLINEに出欠URLをお送りします。"
  });
}

async function replyIfPossible({
  replyToken,
  text
}: {
  replyToken: string | undefined;
  text: string;
}) {
  if (!replyToken) {
    return;
  }

  await replyLineText({
    replyToken,
    text
  }).catch((error) => {
    console.error("Failed to reply LINE message.", error);
  });
}
