const FALLBACK_API_BASE_URL =
  "https://e-livestock.tulongkabataanbicol.com/e-livestock-backend/API";
const FALLBACK_API_ROUTE_MODE = "legacy";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || FALLBACK_API_BASE_URL;
export const API_ROUTE_MODE =
  process.env.EXPO_PUBLIC_API_ROUTE_MODE || FALLBACK_API_ROUTE_MODE;

function resolveApiPath(path) {
  if (path && typeof path === "object") {
    if (API_ROUTE_MODE === "clean") {
      return path.clean || path.legacy || "";
    }

    return path.legacy || path.clean || "";
  }

  return path;
}

export function apiUrl(path) {
  const normalizedBase = API_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = String(resolveApiPath(path) || "").replace(/^\/+/, "");

  return `${normalizedBase}/${normalizedPath}`;
}
