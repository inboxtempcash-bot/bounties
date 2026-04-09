import { ProviderAdapter, TaskRequest } from "../core/types";
import { buildTokenBid, executeTemplate } from "./shared";

const config = {
  name: "openai",
  inputUsdPerMillion: 5,
  outputUsdPerMillion: 15,
  promoUsd: 0.00035,
  baseLatencyMs: 820,
  qualityScore: 0.93,
  stylePrefix: "OpenAI draft:",
};

export const openAiAdapter: ProviderAdapter = {
  name: config.name,
  async getBid(task: TaskRequest) {
    return buildTokenBid(task, config);
  },
  async execute(task: TaskRequest) {
    return executeTemplate(task, config.name, config.stylePrefix);
  },
};
