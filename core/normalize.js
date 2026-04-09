function round(value) {
  return Math.round(value * 1000000) / 1000000;
}

export function calculateBasePrice(pricing, usage) {
  switch (pricing.model) {
    case "token":
      return round(
        usage.tokensIn * pricing.inputCostPerToken +
        usage.tokensOut * pricing.outputCostPerToken
      );
    case "request":
      return round(pricing.fixedCost);
    case "compute":
      return round(usage.estimatedSeconds * pricing.costPerSecond);
    default:
      throw new Error(`Unsupported pricing model: ${pricing.model}`);
  }
}

export function deriveEffectivePrice(basePrice, promoCredit = 0) {
  return round(Math.max(0, basePrice - promoCredit));
}

export function normalizeMetric(value, minValue, maxValue) {
  if (maxValue === minValue) {
    return 0;
  }

  return (value - minValue) / (maxValue - minValue);
}
