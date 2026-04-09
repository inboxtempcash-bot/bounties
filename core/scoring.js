import { normalizeMetric } from "./normalize.js";

const MODES = new Set(["balanced", "cheapest", "fastest", "best-quality"]);

export function validateMode(mode) {
  if (!MODES.has(mode)) {
    throw new Error(`Invalid mode '${mode}'. Supported: balanced, cheapest, fastest, best-quality`);
  }
}

export function scoreBids(bids, mode) {
  validateMode(mode);

  const prices = bids.map((bid) => bid.effectivePrice);
  const latencies = bids.map((bid) => bid.latencyMs);
  const qualities = bids.map((bid) => bid.qualityScore);

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  const minQuality = Math.min(...qualities);
  const maxQuality = Math.max(...qualities);

  const scored = bids.map((bid) => {
    const normalizedPrice = normalizeMetric(bid.effectivePrice, minPrice, maxPrice);
    const normalizedLatency = normalizeMetric(bid.latencyMs, minLatency, maxLatency);
    const normalizedQuality = normalizeMetric(bid.qualityScore, minQuality, maxQuality);

    let score;
    if (mode === "cheapest") {
      score = normalizedPrice;
    } else if (mode === "fastest") {
      score = normalizedLatency;
    } else if (mode === "best-quality") {
      score = 1 - normalizedQuality;
    } else {
      score =
        normalizedPrice * 0.45 +
        normalizedLatency * 0.2 +
        (1 - normalizedQuality) * 0.35;
    }

    return {
      bid,
      score,
      normalized: {
        price: normalizedPrice,
        latency: normalizedLatency,
        quality: normalizedQuality
      }
    };
  });

  scored.sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }

    if (a.bid.effectivePrice !== b.bid.effectivePrice) {
      return a.bid.effectivePrice - b.bid.effectivePrice;
    }

    if (a.bid.latencyMs !== b.bid.latencyMs) {
      return a.bid.latencyMs - b.bid.latencyMs;
    }

    return b.bid.qualityScore - a.bid.qualityScore;
  });

  return scored;
}
