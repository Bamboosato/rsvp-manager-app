import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { authenticateFirebaseRequest } from "@/lib/firebase/serverApi";
import {
  buildLineRegistrationText,
  buildLineRegistrationUrl,
  getLineBasicId,
  normalizeLineAccountId
} from "@/lib/line/config";
import { ensureLineRegistrationCode } from "@/lib/line/registrationCodes";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authUser = await authenticateFirebaseRequest(request);

  if (!authUser) {
    return NextResponse.json({ message: "認証情報がありません。" }, { status: 401 });
  }

  try {
    const lineAccountId = normalizeLineAccountId(
      request.nextUrl.searchParams.get("lineAccountId") ?? undefined
    );
    const code = await ensureLineRegistrationCode({
      ownerUid: authUser.uid,
      lineAccountId
    });
    const registrationText = buildLineRegistrationText(code);
    const lineBasicId = getLineBasicId();
    const registrationUrl = buildLineRegistrationUrl({
      basicId: lineBasicId,
      text: registrationText
    });
    const qrCodeSvg = registrationUrl
      ? await QRCode.toString(registrationUrl, {
          type: "svg",
          margin: 1,
          width: 220
        })
      : "";

    return NextResponse.json({
      code,
      lineAccountId,
      registrationText,
      registrationUrl,
      qrCodeSvg,
      missingLineBasicId: !lineBasicId
    });
  } catch (error) {
    console.error("Failed to load LINE registration settings.", error);
    return NextResponse.json(
      { message: "LINE連携情報の取得に失敗しました。" },
      { status: 500 }
    );
  }
}
