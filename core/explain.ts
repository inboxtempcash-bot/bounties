import { Bid, RouteDecision } from "./types";

export function calcSavingsVsNextBest(rankedBids: Bid[], selectedProvider: string): number {
  const sorted = [...rankedBids].sort(
    (left, right) => left.effectivePriceUsd - right.effectivePriceUsd,
  );

  const selectedIndex = sorted.findIndex(
    (bid) => bid.providerName === selectedProvider,
  );

  if (selectedIndex === -1 || sorted.length < 2) {
    return 0;
  }

  const selected = sorted[selectedIndex];
  const next = sorted.find(
    (candidate) => candidate.providerName !== selected.providerName,
  );

  if (!next) {
    return 0;
  }

  return Number((next.effectivePriceUsd - selected.effectivePriceUsd).toFixed(6));
}

export function createExplanation(decision: RouteDecision): string {
  const selected = decision.selected.bid;
  const nextBest = decision.ranked[1]?.bid;

  if (!nextBest) {
    return `Selected ${selected.providerName} because it is the only available provider.`;
  }

  const priceGap = nextBest.effectivePriceUsd - selected.effectivePriceUsd;
  const qualityDelta = selected.qualityScore - nextBest.qualityScore;

  if (priceGap > 0.0001 && qualityDelta >= -0.05) {
    return `Selected ${selected.providerName} for lower effective price while preserving acceptable quality.`;
  }

  if (selected.latencyMs < nextBest.latencyMs) {
    return `Selected ${selected.providerName} due to stronger score on latency with competitive price.`;
  }

  return `Selected ${selected.providerName} based on composite score across price, latency, and quality.`;
}
