import { execFile } from "node:child_process";

const TESTNET_RPC_URL = "https://rpc.moderato.tempo.xyz";

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function readErrorMessage(error) {
  const parts = [];
  if (error?.stdout) {
    parts.push(String(error.stdout).trim());
  }
  if (error?.stderr) {
    parts.push(String(error.stderr).trim());
  }
  if (parts.length > 0) {
    return parts.join("\n");
  }
  return error instanceof Error ? error.message : String(error);
}

function parsePathUsdBalance(text) {
  const match = text.match(/Balance\s+([0-9_.,]+)\s+PathUSD/i);
  if (!match) {
    return null;
  }

  const numeric = Number(match[1].replaceAll("_", "").replaceAll(",", ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseNumeric(value) {
  const cleaned = String(value).replaceAll("_", "").replaceAll(",", "");
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

export function parseBalances(text) {
  const balances = [];
  const regex = /^\s*(?:Balance\s+)?([0-9][0-9_,.]*)\s+([A-Za-z][A-Za-z0-9]*)(?:\s+\(([^)]+)\))?/gm;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const amount = parseNumeric(match[1]);
    if (amount === null) {
      continue;
    }
    balances.push({
      amount,
      asset: match[2],
      network: match[3] ?? null
    });
  }
  return balances;
}

export function hasPositiveBalance(text) {
  const balances = parseBalances(text);
  return balances.some((entry) => entry.amount > 0);
}

export function hasPositiveMainnetUsdBalance(text) {
  const balances = parseBalances(text);
  return balances.some((entry) =>
    entry.amount > 0 &&
    !entry.network &&
    (entry.asset.toUpperCase() === "PATHUSD" || entry.asset.toUpperCase() === "USDC")
  );
}

export function buildMppxArgs(baseArgs = {}) {
  const args = [];
  if (hasValue(baseArgs.account)) {
    args.push("--account", baseArgs.account.trim());
  }
  if (hasValue(baseArgs.rpcUrl)) {
    args.push("--rpc-url", baseArgs.rpcUrl.trim());
  }
  return args;
}

export function runMppx(rawArgs, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "npx",
      ["-y", "mppx", ...rawArgs],
      {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024 * 8
      },
      (error, stdout, stderr) => {
        if (error) {
          const wrapped = new Error(readErrorMessage({ ...error, stdout, stderr }));
          wrapped.cause = error;
          reject(wrapped);
          return;
        }

        resolve({
          stdout: String(stdout ?? "").trim(),
          stderr: String(stderr ?? "").trim()
        });
      }
    );
  });
}

export async function accountView(baseArgs = {}) {
  const args = ["account", "view", ...buildMppxArgs(baseArgs)];
  return runMppx(args);
}

export async function ensureAccount(baseArgs = {}) {
  try {
    const result = await accountView(baseArgs);
    return {
      created: false,
      output: result.stdout
    };
  } catch (_error) {
    const args = ["account", "create", ...buildMppxArgs(baseArgs)];
    const createResult = await runMppx(args);
    const viewResult = await accountView(baseArgs);
    return {
      created: true,
      output: `${createResult.stdout}\n${viewResult.stdout}`.trim()
    };
  }
}

export async function maybeFundTestnet(baseArgs = {}) {
  if (baseArgs.rpcUrl !== TESTNET_RPC_URL) {
    return {
      funded: false,
      reason: "not-testnet-rpc"
    };
  }

  const view = await accountView(baseArgs);
  const balance = parsePathUsdBalance(view.stdout);
  if (balance !== null && balance > 0) {
    return {
      funded: false,
      reason: "balance-sufficient",
      balance
    };
  }

  const fundArgs = ["account", "fund", ...buildMppxArgs(baseArgs)];
  const fundResult = await runMppx(fundArgs);
  return {
    funded: true,
    reason: "funded",
    output: fundResult.stdout
  };
}

export { TESTNET_RPC_URL };
