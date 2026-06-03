"use client";

import { getToken, onMessage } from "firebase/messaging";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MessagePayload } from "firebase/messaging";
import type { User } from "firebase/auth";
import { getFirebaseClientMessaging } from "@/lib/firebase/client";
import { registerServiceWorker } from "@/features/pwa/serviceWorker";

type NotificationStatus =
  | "checking"
  | "unsupported"
  | "missing-key"
  | "default"
  | "requesting"
  | "enabled"
  | "denied"
  | "error";

const autoRequestStoragePrefix = "rsvp-hub:auto-notification-requested:";
const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export function useAdminPushNotifications(user: User | null) {
  const [status, setStatus] = useState<NotificationStatus>("checking");
  const [message, setMessage] = useState("");
  const isSupported = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return (
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      window.isSecureContext
    );
  }, []);

  const enableNotifications = useCallback(
    async ({ auto = false }: { auto?: boolean } = {}) => {
      if (!user) {
        return;
      }

      if (!isSupported) {
        setStatus("unsupported");
        setMessage("このブラウザでは通知を利用できません。");
        return;
      }

      if (!vapidKey) {
        setStatus("missing-key");
        setMessage("通知用のVAPIDキーが未設定です。");
        return;
      }

      if (auto && Notification.permission !== "default") {
        return;
      }

      setStatus("requesting");
      setMessage("");

      try {
        const permission =
          Notification.permission === "granted"
            ? "granted"
            : await Notification.requestPermission();

        if (permission === "denied") {
          setStatus("denied");
          setMessage("ブラウザで通知が拒否されています。");
          return;
        }

        if (permission !== "granted") {
          setStatus("default");
          setMessage("通知許可が完了していません。");
          return;
        }

        const [registration, messaging] = await Promise.all([
          registerServiceWorker(),
          getFirebaseClientMessaging()
        ]);

        if (!registration || !messaging) {
          setStatus("unsupported");
          setMessage("このブラウザでは通知を利用できません。");
          return;
        }

        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: registration
        });

        if (!token) {
          setStatus("error");
          setMessage("通知トークンを取得できませんでした。");
          return;
        }

        const idToken = await user.getIdToken();
        const response = await fetch("/api/admin/notification-tokens", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            token,
            userAgent: navigator.userAgent
          })
        });

        if (!response.ok) {
          setStatus("error");
          setMessage("通知設定の保存に失敗しました。");
          return;
        }

        setStatus("enabled");
        setMessage("通知が有効です。");
      } catch (error) {
        console.error("Failed to enable push notifications.", error);
        setStatus("error");
        setMessage("通知設定に失敗しました。");
      }
    },
    [isSupported, user]
  );

  useEffect(() => {
    let isCancelled = false;

    async function syncPermissionState() {
      await Promise.resolve();

      if (isCancelled) {
        return;
      }

      if (!user) {
        setStatus("checking");
        setMessage("");
        return;
      }

      if (!isSupported) {
        setStatus("unsupported");
        setMessage("このブラウザでは通知を利用できません。");
        return;
      }

      if (!vapidKey) {
        setStatus("missing-key");
        setMessage("通知用のVAPIDキーが未設定です。");
        return;
      }

      if (Notification.permission === "granted") {
        enableNotifications();
        return;
      }

      if (Notification.permission === "denied") {
        setStatus("denied");
        setMessage("ブラウザで通知が拒否されています。");
        return;
      }

      setStatus("default");
      setMessage("通知を有効にできます。");

      const storageKey = `${autoRequestStoragePrefix}${user.uid}`;

      if (!localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, "1");
        enableNotifications({ auto: true });
      }
    }

    syncPermissionState();

    return () => {
      isCancelled = true;
    };
  }, [enableNotifications, isSupported, user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    if (status !== "enabled") {
      return undefined;
    }

    let unsubscribe: (() => void) | undefined;
    let isMounted = true;

    getFirebaseClientMessaging()
      .then((messaging) => {
        if (!messaging || !isMounted) {
          return;
        }

        unsubscribe = onMessage(messaging, (payload) => {
          showForegroundNotification(payload);
        });
      })
      .catch((error) => {
        console.error("Failed to listen for foreground messages.", error);
      });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [status, user]);

  return {
    status,
    message,
    enableNotifications
  };
}

export function getNotificationButtonLabel(status: NotificationStatus) {
  switch (status) {
    case "enabled":
      return "通知有効";
    case "requesting":
      return "通知設定中";
    case "denied":
      return "通知拒否中";
    case "missing-key":
      return "通知未設定";
    case "unsupported":
      return "通知非対応";
    default:
      return "通知を有効にする";
  }
}

function showForegroundNotification(payload: MessagePayload) {
  if (Notification.permission !== "granted") {
    return;
  }

  const title = payload.notification?.title ?? "RSVP Hub";
  const body = payload.notification?.body ?? "";
  const url = payload.data?.url;

  navigator.serviceWorker.ready
    .then((registration) =>
      registration.showNotification(title, {
        body,
        icon: "/icons/rsvp-hub-icon-192.png",
        badge: "/icons/rsvp-hub-icon-192.png",
        data: {
          url
        },
        tag: payload.data?.planId ? `invite-response-${payload.data.planId}` : undefined
      })
    )
    .catch((error) => {
      console.error("Failed to show foreground notification.", error);
    });
}
