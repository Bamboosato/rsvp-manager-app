import { NextRequest, NextResponse } from "next/server";
import { readInviteSession } from "@/lib/invite/session";
import {
  findPlanByPublicToken,
  listGuestResponses,
  listInviteEvents,
  saveInviteResponses,
  toPublicPlan,
  type AttendanceStatus
} from "@/lib/invite/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ publicToken: string }>;
};

type SaveResponsesRequest = {
  responses?: unknown;
};

const attendanceStatuses = ["yes", "maybe", "no"] as const;

export async function GET(request: NextRequest, context: RouteContext) {
  const { publicToken } = await context.params;
  const session = readInviteSession(request, publicToken);

  if (!session) {
    return NextResponse.json(
      { message: "再度ニックネームとPINを入力してください。" },
      { status: 401 }
    );
  }

  try {
    const plan = await findPlanByPublicToken(publicToken);

    if (!plan || plan.id !== session.planId || plan.ownerUid !== session.ownerUid) {
      return NextResponse.json(
        { message: "URLが正しくないか、利用できません。" },
        { status: 404 }
      );
    }

    if (!plan.isActive) {
      return NextResponse.json(
        { message: "このプランは現在利用できません。" },
        { status: 410 }
      );
    }

    const [events, responses] = await Promise.all([
      listInviteEvents(plan),
      listGuestResponses({
        ownerUid: session.ownerUid,
        planId: session.planId,
        guestId: session.guestId
      })
    ]);
    const responseMap = new Map(responses.map((response) => [response.eventId, response]));

    return NextResponse.json({
      plan: toPublicPlan(plan),
      guest: {
        nickname: session.nickname
      },
      events: events.map((event) => {
        const response = responseMap.get(event.id);

        return {
          id: event.id,
          eventDate: event.eventDate,
          timeSlot: event.timeSlot,
          name: event.name,
          place: event.place,
          status: event.status,
          response: response
            ? {
                attendanceStatus: response.attendanceStatus,
                comment: response.comment,
                answeredAt: response.answeredAt
              }
            : null
        };
      })
    });
  } catch (error) {
    console.error("Failed to load invite responses.", error);
    return NextResponse.json(
      { message: "通信に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { publicToken } = await context.params;
  const session = readInviteSession(request, publicToken);

  if (!session) {
    return NextResponse.json(
      { message: "再度ニックネームとPINを入力してください。" },
      { status: 401 }
    );
  }

  try {
    const plan = await findPlanByPublicToken(publicToken);

    if (!plan || plan.id !== session.planId || plan.ownerUid !== session.ownerUid) {
      return NextResponse.json(
        { message: "URLが正しくないか、利用できません。" },
        { status: 404 }
      );
    }

    if (!plan.isActive) {
      return NextResponse.json(
        { message: "このプランは現在利用できません。" },
        { status: 410 }
      );
    }

    const body = (await request.json().catch(() => null)) as SaveResponsesRequest | null;
    const validation = validateSaveResponsesRequest(body);

    if (!validation.ok) {
      return NextResponse.json({ message: validation.message }, { status: 400 });
    }

    const result = await saveInviteResponses({
      plan,
      guestId: session.guestId,
      responses: validation.responses
    });

    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to save invite responses.", error);
    return NextResponse.json(
      { message: "保存に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 }
    );
  }
}

function validateSaveResponsesRequest(body: SaveResponsesRequest | null):
  | {
      ok: true;
      responses: Array<{
        eventId: string;
        attendanceStatus: AttendanceStatus;
        comment: string;
      }>;
    }
  | { ok: false; message: string } {
  if (!body || !Array.isArray(body.responses)) {
    return { ok: false, message: "入力内容が正しくありません。" };
  }

  if (body.responses.length === 0) {
    return { ok: false, message: "出欠を選択してください。" };
  }

  if (body.responses.length > 100) {
    return { ok: false, message: "一度に保存できるイベント数を超えています。" };
  }

  const responses = body.responses.map((rawResponse) => {
    if (!isRecord(rawResponse)) {
      return null;
    }

    const eventId =
      typeof rawResponse.eventId === "string" ? rawResponse.eventId.trim() : "";
    const attendanceStatus =
      typeof rawResponse.attendanceStatus === "string" ? rawResponse.attendanceStatus : "";
    const comment = typeof rawResponse.comment === "string" ? rawResponse.comment.trim() : "";

    if (
      !eventId ||
      !attendanceStatuses.includes(attendanceStatus as AttendanceStatus) ||
      comment.length > 500
    ) {
      return null;
    }

    return {
      eventId,
      attendanceStatus: attendanceStatus as AttendanceStatus,
      comment
    };
  });

  if (responses.some((response) => response === null)) {
    return { ok: false, message: "入力内容が正しくありません。" };
  }

  return {
    ok: true,
    responses: responses as Array<{
      eventId: string;
      attendanceStatus: AttendanceStatus;
      comment: string;
    }>
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
