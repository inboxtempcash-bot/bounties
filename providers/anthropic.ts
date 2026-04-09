import { ProviderAdapter, TaskRequest } from "../core/types";
import { buildTokenBid, executeTemplate } from "./shared";

const config = {
  name: "anthropic",
  inputUsdPerMillion: 3,
  outputUsdPerMillion: 15,
  promoUsd: 0.0002,
  baseLatencyMs: 1060,
  qualityScore: 0.91,
  stylePrefix: "Anthropic draft:",
};

export const anthropicAdapter: ProviderAdapter = {
  name: config.name,
  async getBid(task: TaskRequest) {
    return buildTokenBid(task, config);
  },
  async execute(task: TaskRequest) {
    return executeTemplate(task, config.name, config.stylePrefix);
  },
};
