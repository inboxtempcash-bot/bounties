export type TaskType = "text";

export type RouteMode = "cheapest" | "fastest" | "best-quality" | "balanced";

export type PaymentMode = "simulated" | "x402" | "mpp";

export interface TaskRequest {
  id: string;
  type: TaskType;
  prompt: string;
  mode: RouteMode;
  paymentMode: PaymentMode;
  requestedAt: string;
  estimatedTokensIn: number;
  estimatedTokensOut: number;
}

export interface Bid {
  providerName: string;
  basePriceUsd: number;
  promoCreditUsd: number;
  effectivePriceUsd: number;
  latencyMs: number;
  qualityScore: number;
}

export interface ExecutionResult {
  providerName: string;
  output: string;
  latencyMs: number;
}

export interface PaymentResult {
  protocolUsed: PaymentMode;
  status: "logged" | "paid-and-retried" | "session-opened";
  detail: string;
}

export interface ProviderAdapter {
  name: string;
  getBid(task: TaskRequest): Promise<Bid>;
  execute(task: TaskRequest): Promise<ExecutionResult>;
}

export interface ScoredBid {
  bid: Bid;
  score: number;
  normalizedPrice: number;
  normalizedLatency: number;
  normalizedQuality: number;
}

export interface RouteDecision {
  selected: ScoredBid;
  ranked: ScoredBid[];
}

export interface RouteResult {
  task: TaskRequest;
  bids: Bid[];
  decision: RouteDecision;
  payment: PaymentResult;
  execution: ExecutionResult;
  explanation: string;
  savingsVsNextBestUsd: number;
}
