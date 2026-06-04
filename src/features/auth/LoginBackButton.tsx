"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function LoginBackButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo =
    requestedReturnTo?.startsWith("/") &&
    !requestedReturnTo.startsWith("//") &&
    !requestedReturnTo.startsWith("/admin")
      ? requestedReturnTo
      : "/";

  return (
    <button
      className="secondary-button auth-back-button"
      data-tooltip="前の画面へ戻る"
      onClick={() => router.replace(returnTo)}
      type="button"
    >
      ← 戻る
    </button>
  );
}
