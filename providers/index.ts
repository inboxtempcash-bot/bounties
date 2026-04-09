import { ProviderAdapter } from "../core/types";
import { anthropicAdapter } from "./anthropic";
import { cheapModelAdapter } from "./mock";
import { openAiAdapter } from "./openai";

export const providers: ProviderAdapter[] = [
  openAiAdapter,
  anthropicAdapter,
  cheapModelAdapter,
];

export function listProviderNames(): string[] {
  return providers.map((provider) => provider.name);
}
