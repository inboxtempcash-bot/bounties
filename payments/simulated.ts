import { Bid, PaymentResult, TaskRequest } from "../core/types";

export async function processSimulatedPayment(
  task: TaskRequest,
  bid: Bid,
): Promise<PaymentResult> {
  return {
    protocolUsed: "simulated",
    status: "logged",
    detail: `Simulated payment logged for ${task.id} at $${bid.effectivePriceUsd.toFixed(6)}.`,
  };
}
