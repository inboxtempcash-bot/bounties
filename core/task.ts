import { PaymentMode, RouteMode, TaskRequest } from "./types";

function randomSuffix(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function estimateTokenUsage(prompt: string): {
  inputTokens: number;
  outputTokens: number;
} {
  const inputTokens = Math.max(32, Math.ceil(prompt.length / 4));
  const outputTokens = Math.max(96, Math.ceil(prompt.length * 0.45));
  return { inputTokens, outputTokens };
}

export function createTaskRequest(
  prompt: string,
  mode: RouteMode,
  paymentMode: PaymentMode,
): TaskRequest {
  const usage = estimateTokenUsage(prompt);
  return {
    id: `req_${Date.now()}_${randomSuffix(6)}`,
    type: "text",
    prompt,
    mode,
    paymentMode,
    requestedAt: new Date().toISOString(),
    estimatedTokensIn: usage.inputTokens,
    estimatedTokensOut: usage.outputTokens,
  };
}
