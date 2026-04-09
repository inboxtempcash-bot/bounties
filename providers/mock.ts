import { ProviderAdapter, TaskRequest } from "../core/types";
import { buildTokenBid, executeTemplate } from "./shared";

const config = {
  name: "cheap-model",
  inputUsdPerMillion: 0.4,
  outputUsdPerMillion: 2.2,
  promoUsd: 0.0005,
  baseLatencyMs: 1520,
  qualityScore: 0.72,
  stylePrefix: "Budget draft:",
};

export const cheapModelAdapter: ProviderAdapter = {
  name: config.name,
  async getBid(task: TaskRequest) {
    return buildTokenBid(task, config);
  },
  async execute(task: TaskRequest) {
    return executeTemplate(task, config.name, config.stylePrefix);
  },
};
