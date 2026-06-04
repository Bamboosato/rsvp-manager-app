"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function LoginCloseButton() {
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
      aria-label="ログイン画面を閉じる"
      className="account-close-button auth-close-button"
      data-tooltip="ログイン画面を閉じる"
      onClick={() => router.replace(returnTo)}
      type="button"
    >
      ×
    </button>
  );
}
