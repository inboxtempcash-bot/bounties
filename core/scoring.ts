import { Bid, RouteDecision, RouteMode, ScoredBid } from "./types";

function normalize(value: number, min: number, max: number): number {
  if (max === min) {
    return 0.5;
  }
  return (value - min) / (max - min);
}

function scoreBid(bid: Bid, mode: RouteMode, ranges: {
  minPrice: number;
  maxPrice: number;
  minLatency: number;
  maxLatency: number;
  minQuality: number;
  maxQuality: number;
}): ScoredBid {
  const normalizedPrice = normalize(
    bid.effectivePriceUsd,
    ranges.minPrice,
    ranges.maxPrice,
  );

  const normalizedLatency = normalize(
    bid.latencyMs,
    ranges.minLatency,
    ranges.maxLatency,
  );

  const normalizedQuality = normalize(
    bid.qualityScore,
    ranges.minQuality,
    ranges.maxQuality,
  );

  let score = 0;
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
    normalizedPrice,
    normalizedLatency,
    normalizedQuality,
  };
}

export function chooseWinningBid(bids: Bid[], mode: RouteMode): RouteDecision {
  const prices = bids.map((bid) => bid.effectivePriceUsd);
  const latencies = bids.map((bid) => bid.latencyMs);
  const quality = bids.map((bid) => bid.qualityScore);

  const ranges = {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    minLatency: Math.min(...latencies),
    maxLatency: Math.max(...latencies),
    minQuality: Math.min(...quality),
    maxQuality: Math.max(...quality),
  };

  const ranked = bids
    .map((bid) => scoreBid(bid, mode, ranges))
    .sort((left, right) => left.score - right.score);

  return {
    selected: ranked[0],
    ranked,
  };
}
