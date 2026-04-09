const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedModelMap = null;
let cacheExpiresAt = 0;

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function derivePricingFromOpenRouterModel(model) {
  const prompt = toNumber(model?.pricing?.prompt);
  const completion = toNumber(model?.pricing?.completion);
  const request = toNumber(model?.pricing?.request);

  if (prompt !== null || completion !== null) {
    return {
      model: "token",
      inputCostPerToken: Math.max(0, prompt ?? 0),
      outputCostPerToken: Math.max(0, completion ?? 0)
    };
  }

  if (request !== null && request > 0) {
    return {
      model: "request",
      fixedCost: request
    };
  }

  return null;
}

async function fetchOpenRouterModels({ timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`OpenRouter pricing request failed with ${response.status}`);
    }

    const body = await response.json();
    if (!body || !Array.isArray(body.data)) {
      throw new Error("OpenRouter pricing payload missing data array.");
    }

    const map = new Map();
    for (const model of body.data) {
      if (model?.id) {
        map.set(model.id, model);
      }
    }
    return map;
  } finally {
    clearTimeout(timeout);
  }
}

async function getOpenRouterModelMap(options = {}) {
  const now = Date.now();
  if (!options.refresh && cachedModelMap && now < cacheExpiresAt) {
    return cachedModelMap;
  }

  cachedModelMap = await fetchOpenRouterModels(options);
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedModelMap;
}

export async function resolveLivePricing(providerList, options = {}) {
  const modelMap = await getOpenRouterModelMap(options);
  const pricingByProvider = {};
  const missingProviders = [];

  for (const provider of providerList) {
    if (!provider.openRouterModelId) {
      continue;
    }

    const model = modelMap.get(provider.openRouterModelId);
    const pricing = derivePricingFromOpenRouterModel(model);

    if (!model || !pricing) {
      missingProviders.push({
        providerName: provider.providerName,
        modelId: provider.openRouterModelId
      });
      continue;
    }

    pricingByProvider[provider.providerName] = {
      pricing,
      modelId: provider.openRouterModelId
    };
  }

  return {
    provider: "openrouter",
    pricingByProvider,
    missingProviders
  };
}

