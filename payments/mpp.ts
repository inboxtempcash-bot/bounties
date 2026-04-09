import { Bid, PaymentResult, TaskRequest } from "../core/types";

function buildSessionId(taskId: string): string {
  return `mpp_${taskId.slice(-10)}`;
}

export async function processMppPayment(
  task: TaskRequest,
  bid: Bid,
): Promise<PaymentResult> {
  const sessionId = buildSessionId(task.id);
  return {
    protocolUsed: "mpp",
    status: "session-opened",
    detail: `Opened MPP session ${sessionId} with stream budget $${bid.effectivePriceUsd.toFixed(6)}.`,
  };
}
