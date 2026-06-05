"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { clearAppBadge } from "./appBadge";
import { registerServiceWorker, requestServiceWorkerUpdate } from "./serviceWorker";

export function ServiceWorkerRegistration() {
  const pathname = usePathname();

  useEffect(() => {
    clearAppBadgeForAdminPath(pathname);
  }, [pathname]);

  useEffect(() => {
    let registration: Awaited<ReturnType<typeof registerServiceWorker>> = null;

    function checkForUpdates() {
      if (registration) {
        requestServiceWorkerUpdate(registration);
      }
    }

    function clearBadgeForCurrentAdminPage() {
      clearAppBadgeForAdminPath(window.location.pathname);
    }

    function syncVisiblePage() {
      checkForUpdates();
      clearBadgeForCurrentAdminPage();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        syncVisiblePage();
      }
    }

    registerServiceWorker().then((registeredServiceWorker) => {
      registration = registeredServiceWorker;
    });

    window.addEventListener("focus", syncVisiblePage);
    window.addEventListener("online", syncVisiblePage);
    window.addEventListener("pageshow", syncVisiblePage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", syncVisiblePage);
      window.removeEventListener("online", syncVisiblePage);
      window.removeEventListener("pageshow", syncVisiblePage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}

function clearAppBadgeForAdminPath(pathname: string | null) {
  if (!pathname || !isAdminPath(pathname)) {
    return;
  }

  void clearAppBadge();
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
