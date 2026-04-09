import { randomUUID } from "node:crypto";
import { collectBids } from "./bidding.js";
import { scoreBids } from "./scoring.js";
import { buildExplanation } from "./explain.js";
import { resolveLivePricing } from "./livePricing.js";
import { processPayment } from "../payments/index.js";
import { appendLedgerRecord } from "../db/ledger.js";

export async function routeTask({
  task,
  mode = "balanced",
  paymentMode = "simulated",
  pricingMode = "live",
  providers
}) {
  if (!Array.isArray(providers) || providers.length === 0) {
    throw new Error("No providers configured.");
  }
  if (pricingMode !== "live" && pricingMode !== "static") {
    throw new Error(`Invalid pricing mode '${pricingMode}'. Supported: live, static`);
  }

  const requestId = randomUUID();
  let livePricing = null;
  const hasOpenRouterProviders = providers.some((provider) => provider.openRouterModelId);
  let pricingStatus = {
    mode: pricingMode,
    source: "static"
  };

  if (pricingMode === "live" && hasOpenRouterProviders) {
    try {
      livePricing = await resolveLivePricing(providers);
      pricingStatus = {
        mode: pricingMode,
        source: "openrouter",
        missingProviders: livePricing.missingProviders
      };
    } catch (error) {
      pricingStatus = {
        mode: pricingMode,
        source: "static-fallback",
        warning: error instanceof Error ? error.message : String(error)
      };
    }
  } else if (pricingMode === "live") {
    pricingStatus = {
      mode: pricingMode,
      source: "provider-catalog"
    };
  }

  const bids = await collectBids(task, providers, { livePricing });
  const ranked = scoreBids(bids, mode);
  const selected = ranked[0].bid;

  if (typeof selected.execute !== "function") {
    throw new Error(`Selected provider '${selected.providerName}' is missing execute(task).`);
  }

  const payment = await processPayment({
    mode: paymentMode,
    requestId,
    providerName: selected.providerName,
    amountUsd: selected.effectivePrice
  });

  const output = await selected.execute(task, {
    requestId,
    payment
  });

  const explanation = buildExplanation(selected, ranked, mode);

  await appendLedgerRecord({
    request_id: requestId,
    task,
    bids: bids.map((bid) => ({
      provider_name: bid.providerName,
      base_price: bid.basePrice,
      promo_credit: bid.promoCredit,
      effective_price: bid.effectivePrice,
      latency_ms: bid.latencyMs,
      quality_score: bid.qualityScore,
      pricing_source: bid.pricingSource ?? "static",
      pricing_model_id: bid.pricingModelId ?? null
    })),
    selected_provider: selected.providerName,
    base_price: selected.basePrice,
    promo_credit: selected.promoCredit,
    effective_price: selected.effectivePrice,
    protocol_used: payment.protocol,
    pricing_mode: pricingMode,
    pricing_source: pricingStatus.source,
    output
  });

  return {
    requestId,
    bids,
    selected,
    payment,
    pricingStatus,
    explanation,
    output,
    mode
  };
}
