import { estimateUsage } from "../core/usage.js";
import { calculateBasePrice, deriveEffectivePrice } from "../core/normalize.js";
import { executeTextViaOpenRouter } from "./execute.js";

export const cheapModelProvider = {
  providerName: "Cheap Model Adapter",
  openRouterModelId: process.env.OPENROUTER_MODEL_CHEAP || "meta-llama/llama-3.1-8b-instruct",
  latencyMs: 2020,
  qualityScore: 0.6,
  promoCredit: 0.0045,
  livePromoCredit: 0.000001,
  pricing: {
    model: "token",
    inputCostPerToken: 0.0002,
    outputCostPerToken: 0.00015
  },
  async getBid(task, context = {}) {
    const livePricing = context.livePricing?.pricingByProvider?.[this.providerName];
    const pricing = livePricing?.pricing ?? this.pricing;
    const promoCredit = livePricing ? this.livePromoCredit : this.promoCredit;

    const usage = estimateUsage(task);
    const basePrice = calculateBasePrice(pricing, usage);
    const effectivePrice = deriveEffectivePrice(basePrice, promoCredit);

    return {
      providerName: this.providerName,
      latencyMs: this.latencyMs,
      qualityScore: this.qualityScore,
      pricingSource: livePricing ? "openrouter-live" : "static",
      pricingModelId: livePricing?.modelId ?? this.openRouterModelId,
      modelId: livePricing?.modelId ?? this.openRouterModelId,
      basePrice,
      promoCredit,
      effectivePrice,
      usage,
      execute: this.execute
    };
  },
  async execute(task) {
    const prompt = task.prompt.trim();
    const modelId = this.modelId || this.pricingModelId || "meta-llama/llama-3.1-8b-instruct";
    const liveResult = await executeTextViaOpenRouter({ modelId, prompt });
    if (liveResult) {
      return {
        text: liveResult.text,
        model: liveResult.model,
        source: liveResult.source
      };
    }

    if (prompt.toLowerCase().includes("tweet")) {
      return {
        text: "AutoRouter just shipped. It picks lower-cost AI providers automatically and shows what you saved."
      };
    }

    return {
      text: `Cheap model response: ${prompt}`
    };
  }
};
