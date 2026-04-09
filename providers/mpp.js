import { estimateUsage } from "../core/usage.js";
import { calculateBasePrice, deriveEffectivePrice } from "../core/normalize.js";

const GRADE_QUALITY = {
  "A+": 0.97,
  A: 0.93,
  "A-": 0.88,
  "B+": 0.82,
  B: 0.75,
  "B-": 0.7,
  C: 0.62
};

const GRADE_OVERRIDES = {
  anthropic: "A+",
  openai: "A",
  openrouter: "A-",
  gemini: "A-",
  groq: "A-",
  deepseek: "B+",
  grok: "B+",
  fal: "B+",
  deepgram: "A-",
  stablestudio: "B+"
};

function defaultGradeForModality(modality) {
  if (modality === "video") {
    return "B";
  }
  if (modality === "audio") {
    return "B+";
  }
  return "B";
}

function estimateLatency(modality) {
  if (modality === "video") {
    return 4200;
  }
  if (modality === "audio") {
    return 1600;
  }
  return 1100;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function endpointMatchesModality(endpoint, modality) {
  const text = [
    endpoint?.method,
    endpoint?.path,
    endpoint?.description
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (modality === "video") {
    const hasVideoTerm = /\b(video|veo|sora|movie|clip|animation|animate)\b/.test(text);
    const hasGenerationIntent = /\b(generate|generation|create|render|synthes|produce|convert|transform|edit)\b/.test(text);
    return hasVideoTerm && hasGenerationIntent;
  }

  if (modality === "audio") {
    return /\b(audio|speech|voice|transcrib|tts|whisper)\b/.test(text);
  }

  return /\b(chat|completion|response|message|text|embed|llm|prompt|generate)\b/.test(text);
}

function minRequestPriceUsd(service, modality) {
  const prices = [];
  const fallbackPrices = [];
  let hasDynamicMatch = false;

  for (const endpoint of service.endpoints ?? []) {
    const payment = endpoint?.payment;
    if (!payment) {
      continue;
    }

    const matches = endpointMatchesModality(endpoint, modality);
    if (matches && payment.dynamic === true) {
      hasDynamicMatch = true;
    }

    const amount = toNumber(endpoint?.payment?.amount);
    const decimals = toNumber(endpoint?.payment?.decimals);
    if (amount === null || decimals === null || amount <= 0 || decimals < 0) {
      continue;
    }

    const usd = amount / (10 ** decimals);
    if (!Number.isFinite(usd) || usd <= 0) {
      continue;
    }

    fallbackPrices.push(usd);
    if (matches) {
      prices.push(usd);
    }
  }

  if (prices.length > 0) {
    return Math.min(...prices);
  }

  // Dynamic-priced endpoints often omit fixed amount fields; use lowest fixed
  // endpoint price only when the modality has a matching dynamic endpoint.
  if (hasDynamicMatch && fallbackPrices.length > 0) {
    return Math.min(...fallbackPrices);
  }

  if (fallbackPrices.length === 0 || !hasDynamicMatch) {
    return null;
  }
}

function classifyModalities(service) {
  const categories = (service.categories ?? []).map((item) => String(item).toLowerCase());
  const tags = (service.tags ?? []).map((item) => String(item).toLowerCase());
  const text = [
    service.id,
    service.name,
    service.description,
    categories.join(" "),
    tags.join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const modalities = new Set();

  const endpointCatalog = service.endpoints ?? [];
  if (endpointCatalog.length > 0) {
    let textMatch = false;
    let audioMatch = false;
    let videoMatch = false;
    for (const endpoint of endpointCatalog) {
      if (!endpoint?.payment) {
        continue;
      }
      textMatch ||= endpointMatchesModality(endpoint, "text");
      audioMatch ||= endpointMatchesModality(endpoint, "audio");
      videoMatch ||= endpointMatchesModality(endpoint, "video");
    }

    if (textMatch) {
      modalities.add("text");
    }
    if (audioMatch) {
      modalities.add("audio");
    }
    if (videoMatch) {
      modalities.add("video");
    }
  } else {
    if (/\b(video|veo|sora|runway|pika|luma|movie|clip)\b/.test(text)) {
      modalities.add("video");
    }

    if (/\b(audio|speech|voice|transcrib|tts|podcast|phone|whisper)\b/.test(text)) {
      modalities.add("audio");
    }

    if (/\b(chat|text|completion|llm|model|prompt|reason|claude|gpt|gemini|openai|anthropic|openrouter)\b/.test(text) || categories.includes("ai")) {
      modalities.add("text");
    }
  }

  return Array.from(modalities);
}

function matchesModel(provider, selection) {
  if (!selection) {
    return true;
  }

  const needle = selection.trim().toLowerCase();
  return [
    provider.modelKey,
    provider.providerName,
    provider.pricingModelId,
    provider.serviceId
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase() === needle);
}

function isAiVideoService(service) {
  const categories = (service.categories ?? []).map((item) => String(item).toLowerCase());
  const tags = (service.tags ?? []).map((item) => String(item).toLowerCase());
  const text = [
    service.id,
    service.name,
    service.description,
    tags.join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const aiSignal = categories.includes("ai") || /\b(ai|model|inference|generation|generative|diffusion|llm)\b/.test(text);
  const videoSignal = /\b(video|veo|sora|runway|pika|luma|animate|render|fal|replicate|stability)\b/.test(text);
  return aiSignal && videoSignal;
}

function buildProvider(service, modality, minPriceUsd) {
  const grade = GRADE_OVERRIDES[service.id] ?? defaultGradeForModality(modality);
  const qualityScore = GRADE_QUALITY[grade] ?? 0.75;
  const modelKey = `mpp-${service.id}-${modality}`;

  return {
    modelKey,
    modality,
    providerName: `${service.name} (MPP)`,
    serviceId: service.id,
    serviceUrl: service.serviceUrl ?? service.url,
    grade,
    latencyMs: estimateLatency(modality),
    qualityScore,
    promoCredit: 0,
    livePromoCredit: 0,
    pricing: {
      model: "request",
      fixedCost: minPriceUsd
    },
    async getBid(task) {
      const usage = estimateUsage(task);
      const basePrice = calculateBasePrice(this.pricing, usage);
      const effectivePrice = deriveEffectivePrice(basePrice, 0);

      return {
        providerName: this.providerName,
        modelKey: this.modelKey,
        modality: this.modality,
        grade: this.grade,
        latencyMs: this.latencyMs,
        qualityScore: this.qualityScore,
        pricingSource: "mpp-services-live",
        pricingModelId: this.modelKey,
        modelId: this.modelKey,
        basePrice,
        promoCredit: 0,
        effectivePrice,
        usage,
        execute: async (nextTask) => {
          return {
            text: `${this.modality.toUpperCase()} route selected ${this.providerName} (${this.serviceUrl}) for prompt "${nextTask.prompt}". No file artifact is produced by this CLI adapter yet.`,
            source: "mpp-service",
            model: this.modelKey,
            serviceUrl: this.serviceUrl
          };
        }
      };
    }
  };
}

export function buildMppServiceProviders(services, { modality, model } = {}) {
  const selected = [];

  for (const service of services) {
    if (service.status && service.status !== "active") {
      continue;
    }

    const modalities = classifyModalities(service);
    for (const nextModality of modalities) {
      if (modality && nextModality !== modality) {
        continue;
      }
      if (nextModality === "video" && !isAiVideoService(service)) {
        continue;
      }
      const minPriceUsd = minRequestPriceUsd(service, nextModality);
      if (minPriceUsd === null) {
        continue;
      }
      selected.push(buildProvider(service, nextModality, minPriceUsd));
    }
  }

  return selected.filter((provider) => matchesModel(provider, model));
}
