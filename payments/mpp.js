import {
  TESTNET_RPC_URL,
  buildMppxArgs,
  ensureAccount,
  maybeFundTestnet,
  runMppx
} from "./mppx.js";

function formatMoney(value) {
  if (value >= 1) {
    return value.toFixed(4);
  }
  if (value >= 0.01) {
    return value.toFixed(5);
  }
  if (value >= 0.0001) {
    return value.toFixed(6);
  }
  return value.toFixed(8);
}

function parseReceiptReference(text) {
  const match = text.match(/reference\s+([0-9a-zx]+)/i);
  return match?.[1] ?? null;
}

function parseReceiptStatus(text) {
  const match = text.match(/status\s+([a-z]+)/i);
  return match?.[1] ?? null;
}

function parseChallengeAmount(text) {
  const match = text.match(/amount\s+[0-9_.,]+\s+\(([^)]+)\)/i);
  return match?.[1] ?? null;
}

function providerChargeUrl(providerName) {
  const normalized = providerName
    .replaceAll(/[^a-z0-9]+/gi, "_")
    .replaceAll(/^_+|_+$/g, "")
    .toUpperCase();
  const perProvider = process.env[`AUTOROUTER_MPP_CHARGE_URL_${normalized}`];
  if (perProvider) {
    return perProvider;
  }

  return process.env.AUTOROUTER_MPP_CHARGE_URL || "https://mpp.dev/api/ping/paid";
}

function buildBaseArgs() {
  return {
    account: process.env.AUTOROUTER_MPP_ACCOUNT || process.env.MPPX_ACCOUNT,
    rpcUrl: process.env.AUTOROUTER_MPP_RPC_URL || process.env.MPPX_RPC_URL || TESTNET_RPC_URL
  };
}

function readMethodOptArgs() {
  const raw = process.env.AUTOROUTER_MPP_METHOD_OPTS;
  if (!raw) {
    return [];
  }

  const entries = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const args = [];
  for (const entry of entries) {
    args.push("--method-opt", entry);
  }

  return args;
}

export async function handleMppPayment({ amountUsd, requestId, providerName }) {
  const baseArgs = buildBaseArgs();
  const autoCreate = process.env.AUTOROUTER_MPP_AUTO_CREATE_ACCOUNT !== "0";
  const autoFundTestnet = process.env.AUTOROUTER_MPP_AUTO_FUND_TESTNET !== "0";
  const chargeUrl = providerChargeUrl(providerName);

  if (autoCreate) {
    await ensureAccount(baseArgs);
  }

  if (autoFundTestnet) {
    await maybeFundTestnet(baseArgs);
  }

  const baseMppxArgs = buildMppxArgs(baseArgs);
  const methodOptArgs = readMethodOptArgs();
  const requestArgs = [
    chargeUrl,
    ...baseMppxArgs,
    "--header", `x-autorouter-request-id: ${requestId}`,
    "--header", `x-autorouter-provider: ${providerName}`,
    ...methodOptArgs,
    "-v"
  ];

  const output = await runMppx(requestArgs);
  const raw = [output.stdout, output.stderr].filter(Boolean).join("\n");
  const reference = parseReceiptReference(raw);
  const status = parseReceiptStatus(raw) ?? "unknown";
  const challengeAmount = parseChallengeAmount(raw);
  const usingDemoEndpoint = chargeUrl === "https://mpp.dev/api/ping/paid";

  return {
    protocol: "mpp",
    summary: `mppx payment success (${status}${reference ? `, receipt ${reference.slice(0, 14)}...` : ""}${challengeAmount ? `, challenge ${challengeAmount}` : ""}; routed estimate ${formatMoney(amountUsd)} USD${usingDemoEndpoint ? ", demo endpoint (payment smoke test)" : ""})`,
    receiptReference: reference,
    chargeUrl,
    rpcUrl: baseArgs.rpcUrl
  };
}
