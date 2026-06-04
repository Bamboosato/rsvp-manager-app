"use client";

import { useEffect } from "react";
import { registerServiceWorker, requestServiceWorkerUpdate } from "./serviceWorker";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    let registration: Awaited<ReturnType<typeof registerServiceWorker>> = null;

    function checkForUpdates() {
      if (registration) {
        requestServiceWorkerUpdate(registration);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkForUpdates();
      }
    }

    registerServiceWorker().then((registeredServiceWorker) => {
      registration = registeredServiceWorker;
    });

    window.addEventListener("focus", checkForUpdates);
    window.addEventListener("online", checkForUpdates);
    window.addEventListener("pageshow", checkForUpdates);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", checkForUpdates);
      window.removeEventListener("online", checkForUpdates);
      window.removeEventListener("pageshow", checkForUpdates);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
