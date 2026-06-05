function normalizeBaseUrl(value: string | undefined) {
  return (value ?? "").trim().replace(/\/+$/, "");
}

export function getAppBaseUrl(fallbackOrigin?: string) {
  const configuredBaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_BASE_URL);

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const normalizedFallback = normalizeBaseUrl(fallbackOrigin);

  if (normalizedFallback) {
    return normalizedFallback;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
}

export function buildAppUrl(path: string, fallbackOrigin?: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getAppBaseUrl(fallbackOrigin);

  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}
