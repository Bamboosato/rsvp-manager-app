"use client";

import type { User } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  getNotificationButtonLabel,
  useAdminPushNotifications
} from "@/features/notifications/useAdminPushNotifications";
import { LOGOUT_REDIRECT_STORAGE_KEY } from "@/features/auth/logoutRedirect";

type AdminAccountMenuProps = {
  user: User | null;
  onSignOut: () => Promise<void>;
};

export function AdminAccountMenu({ user, onSignOut }: AdminAccountMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pushNotifications = useAdminPushNotifications(user);
  const email = user?.email ?? "メールアドレス未設定";
  const accountName = formatAccountName(email);
  const initial = accountName.slice(0, 1).toUpperCase() || "A";
  const isNotificationButtonDisabled =
    pushNotifications.status === "requesting" ||
    pushNotifications.status === "enabled" ||
    pushNotifications.status === "unsupported" ||
    pushNotifications.status === "missing-key" ||
    pushNotifications.status === "denied";

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function handleSignOut() {
    setIsOpen(false);
    window.sessionStorage.setItem(LOGOUT_REDIRECT_STORAGE_KEY, "1");
    await onSignOut();
    router.replace("/");
  }

  return (
    <div className="account-menu" ref={menuRef}>
      <span className="account-name" title={email}>
        {accountName}
      </span>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="アカウントメニューを開く"
        className="account-avatar-button"
        data-tooltip="アカウントメニューを開く"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        {initial}
      </button>

      {isOpen ? (
        <section
          aria-label="アカウントメニュー"
          aria-modal="false"
          className="account-popover"
          role="dialog"
        >
          <div className="account-popover-header">
            <div>
              <p className="eyebrow">Account</p>
              <h2>アカウント</h2>
            </div>
            <button
              aria-label="アカウントメニューを閉じる"
              className="account-close-button"
              data-tooltip="メニューを閉じる"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>

          <div className="account-info-list">
            <div className="account-info-row">
              <span>メールアドレス</span>
              <strong>{email}</strong>
            </div>
            <div className="account-info-row">
              <span>通知の有効/無効</span>
              <div>
                <button
                  className="secondary-button compact-button"
                  data-tooltip="この端末でブラウザ通知を有効にする"
                  disabled={isNotificationButtonDisabled}
                  onClick={() => pushNotifications.enableNotifications()}
                  type="button"
                >
                  {getNotificationButtonLabel(pushNotifications.status)}
                </button>
                {pushNotifications.message ? (
                  <p className="account-status-text">{pushNotifications.message}</p>
                ) : null}
              </div>
            </div>
          </div>

          <Link
            className="secondary-button button-link account-help-link"
            data-tooltip="ヘルプ/操作説明を開く"
            href="/help"
            onClick={() => setIsOpen(false)}
          >
            ヘルプ/操作説明
          </Link>

          <button
            className="secondary-button account-logout-button"
            data-tooltip="管理画面からログアウト"
            onClick={handleSignOut}
            type="button"
          >
            ログアウト
          </button>
        </section>
      ) : null}
    </div>
  );
}

function formatAccountName(email: string) {
  const [name] = email.split("@");

  return name || email;
}
