import { handleSimulatedPayment } from "./simulated.js";
import { handleX402Payment } from "./x402.js";
import { handleMppPayment } from "./mpp.js";

export async function processPayment({ mode, requestId, providerName, amountUsd }) {
  if (mode === "simulated") {
    return handleSimulatedPayment({ requestId, providerName, amountUsd });
  }

  if (mode === "x402") {
    return handleX402Payment({ requestId, providerName, amountUsd });
  }

  if (mode === "mpp") {
    return handleMppPayment({ requestId, providerName, amountUsd });
  }

  throw new Error(`Unsupported payment mode '${mode}'. Use simulated, x402, or mpp.`);
}
