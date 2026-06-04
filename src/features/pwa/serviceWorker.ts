"use client";

const serviceWorkerPath = "/sw.js";
const updateCheckIntervalMs = 60 * 1000;

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let hasAttachedUpdateHandlers = false;
let hasReloadedForServiceWorker = false;
let lastUpdateCheckAt = 0;

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }

  if (process.env.NODE_ENV !== "production") {
    return unregisterServiceWorkersForDevelopment();
  }

  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register(serviceWorkerPath, {
        updateViaCache: "none"
      })
      .then((registration) => {
        attachServiceWorkerUpdateHandlers(registration);
        requestServiceWorkerUpdate(registration);

        return registration;
      })
      .catch((error) => {
        console.error("Failed to register service worker.", error);
        return null;
      });
  }

  return registrationPromise;
}

async function unregisterServiceWorkersForDevelopment() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ("caches" in window) {
      const cacheNames = await window.caches.keys();

      await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
    }
  } catch (error) {
    console.error("Failed to unregister development service workers.", error);
  }

  return null;
}

export function requestServiceWorkerUpdate(registration: ServiceWorkerRegistration) {
  if (typeof window === "undefined" || document.visibilityState === "hidden") {
    return;
  }

  const now = Date.now();

  if (now - lastUpdateCheckAt < updateCheckIntervalMs) {
    return;
  }

  lastUpdateCheckAt = now;
  registration.update().catch((error) => {
    console.error("Failed to update service worker.", error);
  });
}

function attachServiceWorkerUpdateHandlers(registration: ServiceWorkerRegistration) {
  if (hasAttachedUpdateHandlers) {
    return;
  }

  hasAttachedUpdateHandlers = true;
  let shouldReloadOnControllerChange = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!shouldReloadOnControllerChange) {
      shouldReloadOnControllerChange = true;
      return;
    }

    if (hasReloadedForServiceWorker) {
      return;
    }

    hasReloadedForServiceWorker = true;
    window.location.reload();
  });

  registration.addEventListener("updatefound", () => {
    const installingWorker = registration.installing;

    if (!installingWorker) {
      return;
    }

    installingWorker.addEventListener("statechange", () => {
      if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
        installingWorker.postMessage({ type: "SKIP_WAITING" });
      }
    });
  });
}
