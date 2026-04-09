import { estimateUsage } from "../core/usage.js";
import { calculateBasePrice, deriveEffectivePrice } from "../core/normalize.js";
import { executeTextViaOpenRouter } from "./execute.js";

export const anthropicProvider = {
  providerName: "Anthropic Adapter",
  openRouterModelId: process.env.OPENROUTER_MODEL_ANTHROPIC || "anthropic/claude-3.5-haiku",
  latencyMs: 1180,
  qualityScore: 0.86,
  promoCredit: 0.0039,
  livePromoCredit: 0.00008,
  pricing: {
    model: "token",
    inputCostPerToken: 0.00023,
    outputCostPerToken: 0.00018
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
    const modelId = this.modelId || this.pricingModelId || "anthropic/claude-3.5-haiku";
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
        text: "AutoRouter is live: it compares providers in real time, routes to the best bid, and cuts spend automatically."
      };
    }

    return {
      text: `Anthropic response: ${prompt}`
    };
  }
};
