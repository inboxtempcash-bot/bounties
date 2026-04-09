import { Bid, ExecutionResult, TaskRequest } from "../core/types";

export interface ProviderConfig {
  name: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  promoUsd: number;
  baseLatencyMs: number;
  qualityScore: number;
  stylePrefix: string;
}

function hashPrompt(prompt: string): number {
  let hash = 0;
  for (let i = 0; i < prompt.length; i += 1) {
    hash = (hash * 31 + prompt.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function jitter(prompt: string, min: number, max: number): number {
  const seed = hashPrompt(prompt) % 1000;
  const normalized = seed / 1000;
  return min + (max - min) * normalized;
}

export function buildTokenBid(task: TaskRequest, config: ProviderConfig): Bid {
  const inputUsd =
    (task.estimatedTokensIn / 1_000_000) * config.inputUsdPerMillion;
  const outputUsd =
    (task.estimatedTokensOut / 1_000_000) * config.outputUsdPerMillion;

  const basePriceUsd = Number((inputUsd + outputUsd).toFixed(6));
  const dynamicPromo = Number(jitter(task.prompt + config.name, 0, config.promoUsd).toFixed(6));
  const promoCreditUsd = Math.min(dynamicPromo, basePriceUsd);

  return {
    providerName: config.name,
    basePriceUsd,
    promoCreditUsd,
    effectivePriceUsd: Number((basePriceUsd - promoCreditUsd).toFixed(6)),
    latencyMs: Math.round(
      config.baseLatencyMs + jitter(task.prompt + task.mode, -80, 220),
    ),
    qualityScore: Number(
      Math.min(0.99, config.qualityScore + jitter(task.prompt, -0.04, 0.02)).toFixed(4),
    ),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function executeTemplate(
  task: TaskRequest,
  providerName: string,
  stylePrefix: string,
): Promise<ExecutionResult> {
  const simulatedLatency = Math.round(jitter(task.prompt + providerName, 220, 680));
  await sleep(simulatedLatency);

  return {
    providerName,
    latencyMs: simulatedLatency,
    output: `${stylePrefix} ${task.prompt}`,
  };
}
