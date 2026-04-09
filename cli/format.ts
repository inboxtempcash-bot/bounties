import { Bid, RouteResult } from "../core/types";

function formatUsd(value: number): string {
  return `$${value.toFixed(6)}`;
}

export function formatBidLine(bid: Bid): string {
  return `${bid.providerName} -> ${formatUsd(bid.basePriceUsd)} - ${formatUsd(
    bid.promoCreditUsd,
  )} promo = ${formatUsd(bid.effectivePriceUsd)} | latency ${bid.latencyMs}ms | quality ${bid.qualityScore.toFixed(3)}`;
}

export function printRouteResult(result: RouteResult): void {
  console.log("Bids:");
  for (const bid of result.bids) {
    console.log(formatBidLine(bid));
  }

  console.log("");
  console.log(`Selected: ${result.decision.selected.bid.providerName}`);
  console.log(`Reason: ${result.explanation}`);
  console.log(`Saved: ${formatUsd(result.savingsVsNextBestUsd)}`);
  console.log(`Payment: ${result.payment.detail}`);
  console.log("");
  console.log("Output:");
  console.log(result.execution.output);
}
