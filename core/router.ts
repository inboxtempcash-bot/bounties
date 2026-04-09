import { collectBids } from "./bidding";
import { calcSavingsVsNextBest, createExplanation } from "./explain";
import { chooseWinningBid } from "./scoring";
import { createTaskRequest } from "./task";
import { appendLedgerEntry } from "../db/ledger";
import { processPayment } from "../payments";
import { providers } from "../providers";
import { PaymentMode, RouteMode, RouteResult } from "./types";

export async function routeTextTask(params: {
  prompt: string;
  mode: RouteMode;
  paymentMode: PaymentMode;
}): Promise<RouteResult> {
  const task = createTaskRequest(params.prompt, params.mode, params.paymentMode);

  const bids = await collectBids(task, providers);
  const decision = chooseWinningBid(bids, task.mode);

  const selectedProvider = providers.find(
    (provider) => provider.name === decision.selected.bid.providerName,
  );

  if (!selectedProvider) {
    throw new Error("Selected provider could not be found.");
  }

  const payment = await processPayment(task, decision.selected.bid, task.paymentMode);
  const execution = await selectedProvider.execute(task);

  const savingsVsNextBestUsd = calcSavingsVsNextBest(
    bids,
    decision.selected.bid.providerName,
  );

  const explanation = createExplanation(decision);

  await appendLedgerEntry({
    requestId: task.id,
    requestedAt: task.requestedAt,
    taskType: task.type,
    prompt: task.prompt,
    mode: task.mode,
    paymentMode: task.paymentMode,
    bids,
    selectedProvider: decision.selected.bid.providerName,
    selectedScore: Number(decision.selected.score.toFixed(6)),
    basePriceUsd: decision.selected.bid.basePriceUsd,
    promoCreditUsd: decision.selected.bid.promoCreditUsd,
    effectivePriceUsd: decision.selected.bid.effectivePriceUsd,
    protocolUsed: payment.protocolUsed,
    paymentStatus: payment.status,
    output: execution.output,
  });

  return {
    task,
    bids,
    decision,
    payment,
    execution,
    explanation,
    savingsVsNextBestUsd,
  };
}
