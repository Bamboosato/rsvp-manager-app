"use client";

type NavigatorWithAppBadge = Navigator & {
  clearAppBadge?: () => Promise<void>;
  setAppBadge?: (contents?: number) => Promise<void>;
};

export async function clearAppBadge() {
  if (typeof navigator === "undefined") {
    return;
  }

  const appBadgeNavigator = navigator as NavigatorWithAppBadge;

  if (typeof appBadgeNavigator.clearAppBadge !== "function") {
    return;
  }

  try {
    await appBadgeNavigator.clearAppBadge();
  } catch (error) {
    console.error("Failed to clear app badge.", error);
  }
}
