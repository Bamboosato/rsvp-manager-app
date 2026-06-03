"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "./serviceWorker";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return null;
}
