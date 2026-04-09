import { estimateUsage } from "../core/usage.js";
import { calculateBasePrice, deriveEffectivePrice } from "../core/normalize.js";
import { executeTextViaOpenRouter } from "./execute.js";

const MODEL_CATALOG = [
  {
    modelKey: "text-openai-gpt-4o-mini",
    modality: "text",
    providerName: "OpenAI GPT-4o Mini",
    openRouterModelId: process.env.OPENROUTER_MODEL_TEXT_OPENAI || "openai/gpt-4o-mini",
    latencyMs: 820,
    qualityScore: 0.93,
    grade: "A",
    promoCredit: 0,
    livePromoCredit: 0,
    pricing: {
      model: "token",
      inputCostPerToken: 0.00025,
      outputCostPerToken: 0.00021
    }
  },
  {
    modelKey: "text-claude-3.5-haiku",
    modality: "text",
    providerName: "Claude 3.5 Haiku",
    openRouterModelId: process.env.OPENROUTER_MODEL_TEXT_ANTHROPIC || "anthropic/claude-3.5-haiku",
    latencyMs: 1180,
    qualityScore: 0.86,
    grade: "A-",
    promoCredit: 0.0039,
    livePromoCredit: 0.00008,
    pricing: {
      model: "token",
      inputCostPerToken: 0.00023,
      outputCostPerToken: 0.00018
    }
  },
  {
    modelKey: "text-llama-3.1-8b",
    modality: "text",
    providerName: "Llama 3.1 8B Instruct",
    openRouterModelId: process.env.OPENROUTER_MODEL_TEXT_CHEAP || "meta-llama/llama-3.1-8b-instruct",
    latencyMs: 2020,
    qualityScore: 0.6,
    grade: "B",
    promoCredit: 0.0045,
    livePromoCredit: 0.000001,
    pricing: {
      model: "token",
      inputCostPerToken: 0.0002,
      outputCostPerToken: 0.00015
    }
  },
  {
    modelKey: "audio-whisper-v3",
    modality: "audio",
    providerName: "Whisper V3",
    openRouterModelId: null,
    latencyMs: 900,
    qualityScore: 0.9,
    grade: "A-",
    promoCredit: 0.001,
    livePromoCredit: 0.0002,
    pricing: {
      model: "compute",
      costPerSecond: 0.0007
    }
  },
  {
    modelKey: "audio-eleven-flash",
    modality: "audio",
    providerName: "Eleven Flash",
    openRouterModelId: null,
    latencyMs: 680,
    qualityScore: 0.82,
    grade: "B+",
    promoCredit: 0.0004,
    livePromoCredit: 0.0001,
    pricing: {
      model: "compute",
      costPerSecond: 0.00095
    }
  },
  {
    modelKey: "audio-budget-lite",
    modality: "audio",
    providerName: "Budget Audio Lite",
    openRouterModelId: null,
    latencyMs: 1100,
    qualityScore: 0.7,
    grade: "B",
    promoCredit: 0.0016,
    livePromoCredit: 0.0005,
    pricing: {
      model: "compute",
      costPerSecond: 0.00045
    }
  },
  {
    modelKey: "video-runway-turbo",
    modality: "video",
    providerName: "Runway Turbo",
    openRouterModelId: null,
    latencyMs: 4200,
    qualityScore: 0.88,
    grade: "A-",
    promoCredit: 0.12,
    livePromoCredit: 0.02,
    pricing: {
      model: "compute",
      costPerSecond: 0.09
    }
  },
  {
    modelKey: "video-luma-ray2-fast",
    modality: "video",
    providerName: "Luma Ray2 Fast",
    openRouterModelId: null,
    latencyMs: 3600,
    qualityScore: 0.83,
    grade: "B+",
    promoCredit: 0.08,
    livePromoCredit: 0.01,
    pricing: {
      model: "compute",
      costPerSecond: 0.075
    }
  },
  {
    modelKey: "video-pika-standard",
    modality: "video",
    providerName: "Pika Standard",
    openRouterModelId: null,
    latencyMs: 3200,
    qualityScore: 0.74,
    grade: "B",
    promoCredit: 0.05,
    livePromoCredit: 0.01,
    pricing: {
      model: "compute",
      costPerSecond: 0.06
    }
  }
];

function matchesModel(provider, selection) {
  if (!selection) {
    return true;
  }

  const needle = selection.trim().toLowerCase();
  return [
    provider.modelKey,
    provider.providerName,
    provider.openRouterModelId
  ]
    .filter(Boolean)
    .some((candidate) => candidate.toLowerCase() === needle);
}

function buildFallbackOutput(provider, task) {
  if (provider.modality === "audio") {
    return {
      text: `Audio job queued with ${provider.providerName}: "${task.prompt}"`,
      source: "mock",
      model: provider.modelKey
    };
  }

  if (provider.modality === "video") {
    return {
      text: `Video job queued with ${provider.providerName}: "${task.prompt}"`,
      source: "mock",
      model: provider.modelKey
    };
  }

  if (task.prompt.toLowerCase().includes("tweet")) {
    return {
      text: "AutoRouter just shipped. It picks lower-cost models automatically and shows exactly what you saved.",
      source: "mock",
      model: provider.modelKey
    };
  }

  return {
    text: `${provider.providerName} response: ${task.prompt}`,
    source: "mock",
    model: provider.modelKey
  };
}

function buildProvider(entry) {
  return {
    ...entry,
    async getBid(task, context = {}) {
      const livePricing = context.livePricing?.pricingByProvider?.[this.providerName];
      const pricing = livePricing?.pricing ?? this.pricing;
      const promoCredit = livePricing ? this.livePromoCredit : this.promoCredit;
      const usage = estimateUsage(task);
      const basePrice = calculateBasePrice(pricing, usage);
      const effectivePrice = deriveEffectivePrice(basePrice, promoCredit);
      const resolvedModelId = livePricing?.modelId ?? this.openRouterModelId ?? this.modelKey;

      return {
        providerName: this.providerName,
        modelKey: this.modelKey,
        modality: this.modality,
        grade: this.grade,
        latencyMs: this.latencyMs,
        qualityScore: this.qualityScore,
        pricingSource: livePricing ? "openrouter-live" : "static",
        pricingModelId: resolvedModelId,
        modelId: resolvedModelId,
        basePrice,
        promoCredit,
        effectivePrice,
        usage,
        execute: async (nextTask) => {
          if (this.modality === "text" && this.openRouterModelId) {
            const liveResult = await executeTextViaOpenRouter({
              modelId: resolvedModelId,
              prompt: nextTask.prompt.trim()
            });
            if (liveResult) {
              return {
                text: liveResult.text,
                source: liveResult.source,
                model: liveResult.model
              };
            }
          }

          return buildFallbackOutput(this, nextTask);
        }
      };
    }
  };
}

export const providers = MODEL_CATALOG.map(buildProvider);
export const modelCatalog = MODEL_CATALOG.map((entry) => ({ ...entry }));

export function listModalities() {
  return ["text", "audio", "video"];
}

export function getProvidersForModality(modality) {
  return providers.filter((provider) => provider.modality === modality);
}

export function getProvidersForSelection({ modality, model }) {
  const byModality = getProvidersForModality(modality);
  return byModality.filter((provider) => matchesModel(provider, model));
}

