import { Bid, PaymentResult, TaskRequest } from "../core/types";

export async function processX402Payment(
  task: TaskRequest,
  bid: Bid,
): Promise<PaymentResult> {
  const challengeTriggered = bid.effectivePriceUsd > 0.0008;

  if (challengeTriggered) {
    return {
      protocolUsed: "x402",
      status: "paid-and-retried",
      detail: `Received 402 challenge for ${task.id}; paid $${bid.effectivePriceUsd.toFixed(6)} and retried.`,
    };
  }

  return {
    protocolUsed: "x402",
    status: "logged",
    detail: `x402 route for ${task.id} executed without challenge.`,
  };
}
