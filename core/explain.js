function roundMoney(value) {
  return Math.round(value * 100000000) / 100000000;
}

export function buildExplanation(selected, ranked, mode) {
  const nextBest = ranked[1]?.bid;
  const savedVsNextBest = nextBest
    ? roundMoney(Math.max(0, nextBest.effectivePrice - selected.effectivePrice))
    : 0;

  let reason;
  if (mode === "cheapest") {
    reason = "lowest effective price";
  } else if (mode === "fastest") {
    reason = "lowest latency";
  } else if (mode === "best-quality") {
    reason = "highest quality score";
  } else {
    reason = "best weighted score across price, latency, and quality";
  }

  if (selected.promoCredit > 0) {
    reason += "; promo credit improved competitiveness";
  }

  return {
    reason,
    savedVsNextBest
  };
}
