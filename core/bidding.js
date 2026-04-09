export async function collectBids(task, providerList, context = {}) {
  const settled = await Promise.allSettled(
    providerList.map((provider) => provider.getBid(task, context))
  );

  const bids = [];
  const failures = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      bids.push(result.value);
    } else {
      failures.push(result.reason?.message ?? String(result.reason));
    }
  }

  if (bids.length === 0) {
    const details = failures.length > 0 ? ` Failures: ${failures.join(" | ")}` : "";
    throw new Error(`No providers returned a bid.${details}`);
  }

  return bids;
}
