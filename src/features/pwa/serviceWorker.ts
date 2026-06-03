"use client";

const serviceWorkerPath = "/sw.js";

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }

  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register(serviceWorkerPath)
      .then((registration) => registration)
      .catch((error) => {
        console.error("Failed to register service worker.", error);
        return null;
      });
  }

  return registrationPromise;
}
