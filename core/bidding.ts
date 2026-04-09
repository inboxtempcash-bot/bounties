import { Bid, ProviderAdapter, TaskRequest } from "./types";

export async function collectBids(
  task: TaskRequest,
  providers: ProviderAdapter[],
): Promise<Bid[]> {
  const settled = await Promise.allSettled(
    providers.map(async (provider) => provider.getBid(task)),
  );

  const bids: Bid[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      bids.push(result.value);
    }
  }

  if (bids.length === 0) {
    throw new Error("No provider produced a bid.");
  }

  return bids;
}
