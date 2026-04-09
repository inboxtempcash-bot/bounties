import { estimateUsage } from "../core/usage.js";
import { calculateBasePrice, deriveEffectivePrice } from "../core/normalize.js";
import { executeTextViaOpenRouter } from "./execute.js";

export const openaiProvider = {
  providerName: "OpenAI Adapter",
  openRouterModelId: process.env.OPENROUTER_MODEL_OPENAI || "openai/gpt-4o-mini",
  latencyMs: 820,
  qualityScore: 0.93,
  promoCredit: 0,
  livePromoCredit: 0,
  pricing: {
    model: "token",
    inputCostPerToken: 0.00025,
    outputCostPerToken: 0.00021
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
    const modelId = this.modelId || this.pricingModelId || "openai/gpt-4o-mini";
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
        text: "We just launched AutoRouter: one command, smarter provider routing, lower costs. Build faster with derived bidding."
      };
    }

    return {
      text: `OpenAI response: ${prompt}`
    };
  }
};
