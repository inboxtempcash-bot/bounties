const MPP_SERVICES_URL = "https://mpp.dev/api/services";
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedServices = null;
let cacheExpiresAt = 0;

async function fetchMppServices({ timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(MPP_SERVICES_URL, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`MPP services request failed (${response.status})`);
    }

    const payload = await response.json();
    if (!payload || !Array.isArray(payload.services)) {
      throw new Error("MPP services payload missing services array.");
    }

    return payload.services;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getMppServices({ refresh = false } = {}) {
  const now = Date.now();
  if (!refresh && cachedServices && now < cacheExpiresAt) {
    return cachedServices;
  }

  cachedServices = await fetchMppServices();
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedServices;
}

