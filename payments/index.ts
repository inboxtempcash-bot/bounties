import { Bid, PaymentMode, PaymentResult, TaskRequest } from "../core/types";
import { processMppPayment } from "./mpp";
import { processSimulatedPayment } from "./simulated";
import { processX402Payment } from "./x402";

export async function processPayment(
  task: TaskRequest,
  bid: Bid,
  mode: PaymentMode,
): Promise<PaymentResult> {
  if (mode === "x402") {
    return processX402Payment(task, bid);
  }

  if (mode === "mpp") {
    return processMppPayment(task, bid);
  }

  return processSimulatedPayment(task, bid);
}
