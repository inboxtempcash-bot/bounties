import { Bid, PaymentMode, RouteMode, TaskType } from "../core/types";

export interface LedgerEntry {
  requestId: string;
  requestedAt: string;
  taskType: TaskType;
  prompt: string;
  mode: RouteMode;
  paymentMode: PaymentMode;
  bids: Bid[];
  selectedProvider: string;
  selectedScore: number;
  basePriceUsd: number;
  promoCreditUsd: number;
  effectivePriceUsd: number;
  protocolUsed: PaymentMode;
  paymentStatus: string;
  output: string;
}
