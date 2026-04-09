#!/usr/bin/env node
import { execFile } from "node:child_process";
import { createInterface } from "node:readline/promises";
import process from "node:process";
import { routeTask } from "../core/router.js";
import { CONFIG_FILE, getConfig, setConfig } from "../core/config.js";
import { collectBids } from "../core/bidding.js";
import { resolveLivePricing } from "../core/livePricing.js";
import { getMppServices } from "../core/mppServices.js";
import { scoreBids } from "../core/scoring.js";
import {
  getProvidersForSelection,
  listModalities
} from "../providers/index.js";
import { buildMppServiceProviders } from "../providers/mpp.js";
import {
  TESTNET_RPC_URL,
  accountView,
  buildMppxArgs,
  ensureAccount,
  hasPositiveMainnetUsdBalance,
  hasPositiveBalance,
  runMppx
} from "../payments/mppx.js";

const ROUTE_MODES = new Set(["balanced", "cheapest", "fastest", "best-quality"]);
const PAYMENT_MODES = new Set(["simulated", "x402", "mpp"]);
const PRICING_MODES = new Set(["live", "static"]);
const SOURCE_MODES = new Set(["core", "mpp", "all"]);
const MODALITIES = new Set(listModalities());

const DEFAULT_PROMPTS = {
  text: "write a launch tweet for AutoRouter",
  audio: "transcribe a 30-second support call clip",
  video: "generate an 8-second product teaser video"
};

function printHelp() {
  console.log(`AutoRouter CLI

Usage:
  autorouter run --type text|audio|video --auto "prompt" [--mode balanced|cheapest|fastest|best-quality] [--payment simulated|x402|mpp] [--pricing live|static] [--source core|mpp|all] [--model key-or-id] [--seconds n]
  autorouter one --type text|audio|video --auto "prompt" [--source core|mpp|all] [--mode balanced|cheapest|fastest|best-quality] [--pricing live|static] [--payment simulated|x402|mpp] [--real-pay] [--seconds n] [--yes] [--force-topup]
  autorouter models list [--type text|audio|video] [--mode balanced|cheapest|fastest|best-quality] [--pricing live|static] [--source core|mpp|all] [--auto "sample prompt"] [--seconds n]
  autorouter text --auto "prompt" [--mode ...] [--payment ...] [--pricing ...]
  autorouter audio --auto "prompt" [--mode ...] [--payment ...] [--pricing ...] [--seconds n]
  autorouter video --auto "prompt" [--mode ...] [--payment ...] [--pricing ...] [--seconds n]
  autorouter providers list [--type text|audio|video] [--pricing live|static] [--source core|mpp|all]
  autorouter mpp setup [--account name] [--rpc-url url] [--skills project|global|skip]
  autorouter mpp fund [--account name] [--rpc-url ${TESTNET_RPC_URL}]
  autorouter mpp balance [--account name] [--rpc-url url]
  autorouter demo
`);
}

function readOption(args, name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function parseOptions(args, defaults = {}) {
  const options = {
    mode: "balanced",
    payment: "simulated",
    pricing: "live",
    source: "core",
    ...defaults
  };

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--auto") {
      options.prompt = args[i + 1];
      i += 1;
    } else if (token === "--mode") {
      options.mode = args[i + 1] ?? options.mode;
      i += 1;
    } else if (token === "--payment") {
      options.payment = args[i + 1] ?? options.payment;
      options.paymentExplicit = true;
      i += 1;
    } else if (token === "--pricing") {
      options.pricing = args[i + 1] ?? options.pricing;
      i += 1;
    } else if (token === "--type") {
      options.type = args[i + 1] ?? options.type;
      i += 1;
    } else if (token === "--source") {
      options.source = args[i + 1] ?? options.source;
      i += 1;
    } else if (token === "--model") {
      options.model = args[i + 1] ?? options.model;
      i += 1;
    } else if (token === "--seconds") {
      options.seconds = Number(args[i + 1] ?? options.seconds);
      i += 1;
    } else if (token === "--real-pay") {
      options.realPay = true;
    } else if (token === "--skip-setup") {
      options.skipSetup = true;
    } else if (token === "--skip-fund") {
      options.skipFund = true;
    } else if (token === "--yes") {
      options.yes = true;
    } else if (token === "--force-topup") {
      options.forceTopup = true;
    }
  }

  return options;
}

function formatMoney(value) {
  if (value >= 1) {
    return `$${value.toFixed(4)}`;
  }
  if (value >= 0.01) {
    return `$${value.toFixed(5)}`;
  }
  if (value >= 0.0001) {
    return `$${value.toFixed(6)}`;
  }
  return `$${value.toFixed(8)}`;
}

function extractAccountAddress(accountViewOutput) {
  const match = accountViewOutput.match(/Address\s+([0-9a-zA-Z]+)/);
  return match?.[1] ?? null;
}

function validateMode(mode) {
  if (!ROUTE_MODES.has(mode)) {
    throw new Error(`Invalid --mode '${mode}'. Use balanced, cheapest, fastest, or best-quality.`);
  }
}

function validatePayment(payment) {
  if (!PAYMENT_MODES.has(payment)) {
    throw new Error(`Invalid --payment '${payment}'. Use simulated, x402, or mpp.`);
  }
}

function validatePricing(pricing) {
  if (!PRICING_MODES.has(pricing)) {
    throw new Error(`Invalid --pricing '${pricing}'. Use live or static.`);
  }
}

function validateModality(modality) {
  if (!MODALITIES.has(modality)) {
    throw new Error(`Invalid --type '${modality}'. Use text, audio, or video.`);
  }
}

function validateSource(source) {
  if (!SOURCE_MODES.has(source)) {
    throw new Error(`Invalid --source '${source}'. Use core, mpp, or all.`);
  }
}

function buildTask(modality, options, requirePrompt = true) {
  const prompt = options.prompt ?? DEFAULT_PROMPTS[modality];
  if (requirePrompt && !options.prompt) {
    throw new Error(`Missing --auto \"prompt\" for ${modality} routing.`);
  }

  const task = {
    type: modality,
    prompt
  };

  if (modality === "audio" || modality === "video") {
    if (Number.isFinite(options.seconds) && options.seconds > 0) {
      task.durationSeconds = options.seconds;
    }
  }

  return task;
}

function printRouteResult(result) {
  console.log(`Pricing mode: ${result.pricingStatus.mode}`);
  console.log(`Pricing source: ${result.pricingStatus.source}`);
  if (result.pricingStatus.warning) {
    console.log(`Pricing warning: ${result.pricingStatus.warning}`);
  }
  if (Array.isArray(result.pricingStatus.missingProviders) && result.pricingStatus.missingProviders.length > 0) {
    const missing = result.pricingStatus.missingProviders
      .map((item) => `${item.providerName} (${item.modelId})`)
      .join(", ");
    console.log(`Live pricing missing for: ${missing}`);
  }
  console.log("");
  console.log("Bids:");

  for (const bid of result.bids) {
    const promoInfo = bid.promoCredit > 0
      ? ` (${formatMoney(bid.basePrice)} - ${formatMoney(bid.promoCredit)} promo = ${formatMoney(bid.effectivePrice)})`
      : ` (${formatMoney(bid.effectivePrice)})`;
    console.log(
      `${bid.providerName} [${bid.modelKey}] -> ${formatMoney(bid.effectivePrice)}${promoInfo} | grade ${bid.grade} | latency ${bid.latencyMs}ms | quality ${bid.qualityScore.toFixed(2)} | pricing ${bid.pricingSource} (${bid.pricingModelId})`
    );
  }

  console.log("");
  console.log(`Selected: ${result.selected.providerName} [${result.selected.modelKey}]`);
  console.log(`Reason: ${result.explanation.reason}`);
  console.log(`Saved: ${formatMoney(result.explanation.savedVsNextBest)} vs next best`);
  console.log(`Payment: ${result.payment.protocol} (${result.payment.summary})`);
  console.log("");
  console.log("Output:");
  if (result.output.source || result.output.model) {
    const meta = [
      result.output.source ? `source=${result.output.source}` : null,
      result.output.model ? `model=${result.output.model}` : null
    ].filter(Boolean).join(" | ");
    if (meta) {
      console.log(meta);
    }
  }
  console.log(result.output.text);
}

async function resolveProvidersBySource({ modality, model, source }) {
  const providers = [];
  if (source === "core" || source === "all") {
    providers.push(...getProvidersForSelection({ modality, model }));
  }

  if (source === "mpp" || source === "all") {
    const services = await getMppServices();
    providers.push(...buildMppServiceProviders(services, { modality, model }));
  }

  return providers;
}

async function runRouteCommand(args, forcedModality) {
  const options = parseOptions(args, {
    type: forcedModality ?? "text"
  });
  if (forcedModality) {
    options.type = forcedModality;
  }

  validateMode(options.mode);
  validatePayment(options.payment);
  validatePricing(options.pricing);
  validateModality(options.type);
  validateSource(options.source);

  const task = buildTask(options.type, options, true);
  const selectedProviders = await resolveProvidersBySource({
    modality: options.type,
    model: options.model,
    source: options.source
  });

  if (selectedProviders.length === 0) {
    throw new Error(`No models found for --type ${options.type}${options.model ? ` and --model ${options.model}` : ""}.`);
  }

  const result = await routeTask({
    task,
    mode: options.mode,
    paymentMode: options.payment,
    pricingMode: options.pricing,
    providers: selectedProviders
  });

  printRouteResult(result);
}

function buildPriceInfo(pricing) {
  if (pricing.model === "token") {
    return `in ${pricing.inputCostPerToken.toFixed(8)} / out ${pricing.outputCostPerToken.toFixed(8)}`;
  }
  if (pricing.model === "request") {
    return `request ${pricing.fixedCost.toFixed(8)}`;
  }
  return `compute ${pricing.costPerSecond.toFixed(8)}/sec`;
}

async function runModelsList(args) {
  const options = parseOptions(args, {
    pricing: "live",
    mode: "cheapest",
    source: "core"
  });

  validateMode(options.mode);
  validatePricing(options.pricing);
  validateSource(options.source);

  const modalities = options.type ? [options.type] : Array.from(MODALITIES);
  for (const modality of modalities) {
    validateModality(modality);
  }

  const providerGroups = await Promise.all(
    modalities.map((modality) =>
      resolveProvidersBySource({
        modality,
        model: options.model,
        source: options.source
      })
    )
  );
  const requestedProviders = providerGroups.flat();

  if (requestedProviders.length === 0) {
    throw new Error(`No models found${options.model ? ` for --model ${options.model}` : ""}.`);
  }

  let livePricing = null;
  const hasOpenRouterProviders = requestedProviders.some((provider) => provider.openRouterModelId);
  if (options.pricing === "live" && hasOpenRouterProviders) {
    try {
      livePricing = await resolveLivePricing(requestedProviders);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Live pricing unavailable, using static fallback. Reason: ${message}`);
      console.log("");
    }
  }

  for (const modality of modalities) {
    const providers = requestedProviders.filter((provider) => provider.modality === modality);
    if (providers.length === 0) {
      continue;
    }

    const task = buildTask(modality, options, false);
    const bids = await Promise.all(providers.map((provider) => provider.getBid(task, { livePricing })));
    const ranked = scoreBids(bids, options.mode);

    console.log(`${modality.toUpperCase()} models (sorted by ${options.mode}):`);
    ranked.forEach((item, index) => {
      const bid = item.bid;
      const providerMeta = providers.find((provider) => provider.providerName === bid.providerName);
      const pricing = livePricing?.pricingByProvider?.[bid.providerName]?.pricing ?? providerMeta?.pricing;
      const grade = bid.grade ?? "-";
      const pricingText = pricing ? buildPriceInfo(pricing) : "pricing unavailable";
      console.log(
        `${index + 1}. ${bid.modelKey} | ${bid.providerName} | grade ${grade} | effective ${formatMoney(bid.effectivePrice)} | base ${formatMoney(bid.basePrice)} | promo ${formatMoney(bid.promoCredit)} | latency ${bid.latencyMs}ms | quality ${bid.qualityScore.toFixed(2)} | ${pricingText} | source ${bid.pricingSource}`
      );
    });
    console.log("");
    console.log(`Select one: autorouter run --type ${modality} --source ${options.source} --model "<modelKey>" --auto "${task.prompt}" --pricing ${options.pricing} --payment simulated`);
    console.log("");
  }
}

async function runProvidersList(args) {
  await runModelsList(args);
}

async function runDemo() {
  const prompt = "write a launch tweet for AutoRouter";
  console.log(`> autorouter run --type text --auto \"${prompt}\" --pricing live --mode cheapest`);
  console.log("");

  await runRouteCommand(["--type", "text", "--auto", prompt, "--pricing", "live", "--mode", "cheapest"], "text");
}

function promptUser(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return rl.question(question).finally(() => rl.close());
}

async function confirmYes(question, defaultYes = true) {
  if (!process.stdin.isTTY) {
    return defaultYes;
  }

  const answer = (await promptUser(question)).trim().toLowerCase();
  if (!answer) {
    return defaultYes;
  }

  if (["y", "yes"].includes(answer)) {
    return true;
  }
  if (["n", "no"].includes(answer)) {
    return false;
  }
  return defaultYes;
}

function runCommand(command, commandArgs) {
  return new Promise((resolve, reject) => {
    execFile(command, commandArgs, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function openExternalUrl(url) {
  if (process.platform === "darwin") {
    await runCommand("open", [url]);
    return;
  }
  if (process.platform === "win32") {
    await runCommand("cmd", ["/c", "start", "", url]);
    return;
  }
  await runCommand("xdg-open", [url]);
}

function looksLikeHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function defaultTopupUrl() {
  const candidate = process.env.AUTOROUTER_DEFAULT_TOPUP_URL || "https://wallet.tempo.xyz";
  if (!looksLikeHttpUrl(candidate)) {
    throw new Error("Invalid AUTOROUTER_DEFAULT_TOPUP_URL. Provide a full http(s) URL.");
  }
  return candidate.trim();
}

async function resolveCheckoutUrl(options) {
  const envUrl = process.env.AUTOROUTER_STRIPE_CHECKOUT_URL || process.env.AUTOROUTER_ONRAMP_URL;
  if (looksLikeHttpUrl(envUrl)) {
    return envUrl.trim();
  }

  const config = await getConfig();
  const savedUrl = config.stripeCheckoutUrl;
  if (looksLikeHttpUrl(savedUrl)) {
    return savedUrl.trim();
  }

  const fallbackUrl = defaultTopupUrl();

  if (!process.stdin.isTTY) {
    console.log(`No checkout URL configured. Using default top-up URL: ${fallbackUrl}`);
    return fallbackUrl;
  }

  console.log("No Stripe checkout URL is configured yet.");
  const useFallback = options.yes
    ? true
    : await confirmYes(`Use default top-up URL (${fallbackUrl})? [Y/n] `, true);
  if (useFallback) {
    return fallbackUrl;
  }

  const entered = (await promptUser("Paste your Stripe Checkout URL for wallet top-ups (or press Enter to cancel): ")).trim();
  if (!entered) {
    throw new Error("Wallet funding canceled. No checkout URL configured.");
  }
  if (!looksLikeHttpUrl(entered)) {
    throw new Error("Invalid URL. Please provide a full https:// Stripe Checkout URL.");
  }

  const shouldSave = options.yes
    ? true
    : await confirmYes("Save this checkout URL for future runs? [Y/n] ", true);

  if (shouldSave) {
    await setConfig({ stripeCheckoutUrl: entered });
    console.log(`Saved checkout URL in ${CONFIG_FILE}`);
  }

  return entered;
}

async function runFiatTopupFlow(options) {
  const checkoutUrl = await resolveCheckoutUrl(options);

  const shouldOpen = options.yes
    ? true
    : await confirmYes("Wallet is empty. Open Stripe Checkout to top up now? [Y/n] ", true);

  if (!shouldOpen) {
    throw new Error("Payment required. Re-run with --yes or fund wallet manually.");
  }

  try {
    await openExternalUrl(checkoutUrl);
    console.log(`Opened top-up URL: ${checkoutUrl}`);
  } catch (_error) {
    console.log(`Could not open browser automatically. Open this URL manually: ${checkoutUrl}`);
  }

  if (process.stdin.isTTY) {
    await promptUser("Press Enter after completing checkout...");
  }
}

async function waitForWalletBalanceUpdate(setupArgs, options = {}) {
  const timeoutSec = Number(process.env.AUTOROUTER_TOPUP_TIMEOUT_SEC ?? 180);
  const pollMs = Number(process.env.AUTOROUTER_TOPUP_POLL_MS ?? 3000);
  const requireMainnetBalance = process.env.AUTOROUTER_REQUIRE_MAINNET_BALANCE !== "0";
  const timeoutMs = Math.max(1000, timeoutSec * 1000);
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const current = await accountView(setupArgs);
    const funded = requireMainnetBalance
      ? hasPositiveMainnetUsdBalance(current.stdout)
      : hasPositiveBalance(current.stdout);
    if (funded) {
      return current.stdout;
    }
    await sleep(Math.max(500, pollMs));
  }

  if (options.strict !== false) {
    throw new Error("Top-up not detected in wallet before timeout. Complete checkout, then re-run command.");
  }
  return null;
}

async function previewPlan({ options, providers, task }) {
  let livePricing = null;
  const hasOpenRouterProviders = providers.some((provider) => provider.openRouterModelId);
  if (options.pricing === "live" && hasOpenRouterProviders) {
    try {
      livePricing = await resolveLivePricing(providers);
    } catch (_error) {
      livePricing = null;
    }
  }

  const bids = await collectBids(task, providers, { livePricing });
  const ranked = scoreBids(bids, options.mode);
  const selected = ranked[0]?.bid;
  const alternatives = ranked.slice(1, 4).map((item) => item.bid);

  if (!selected) {
    throw new Error("Could not build a routing preview.");
  }

  console.log(`For your ${options.type} generation app, I found ${bids.length} API options.`);
  console.log(
    `Auto-selected: ${selected.providerName} [${selected.modelKey}] | grade ${selected.grade} | estimated ${formatMoney(selected.effectivePrice)}`
  );
  if (alternatives.length > 0) {
    const altLine = alternatives
      .map((bid) => `${bid.modelKey} (${bid.grade}, ${formatMoney(bid.effectivePrice)})`)
      .join(" | ");
    console.log(`Other options: ${altLine}`);
  }
  console.log("If you want full list or to choose another API, run:");
  console.log(`autorouter models list --type ${options.type} --source ${options.source} --pricing ${options.pricing} --mode ${options.mode}`);
  console.log("");
}

async function runOneCommand(args) {
  const options = parseOptions(args, {
    type: "text",
    source: "mpp",
    pricing: "live",
    mode: "balanced",
    payment: undefined
  });

  validateMode(options.mode);
  validatePricing(options.pricing);
  validateModality(options.type);
  validateSource(options.source);

  if (!options.prompt) {
    throw new Error("Missing --auto \"prompt\".");
  }

  if (options.paymentExplicit) {
    validatePayment(options.payment);
  }

  const paymentMode = options.paymentExplicit
    ? options.payment
    : (options.realPay
      ? "mpp"
      : ((options.source === "mpp" || options.source === "all") ? "mpp" : "simulated"));
  const setupArgs = baseMppArgs(args, TESTNET_RPC_URL);
  const task = buildTask(options.type, options, true);
  const plannedProviders = await resolveProvidersBySource({
    modality: options.type,
    model: options.model,
    source: options.source
  });

  if (plannedProviders.length === 0) {
    throw new Error(`No models found for --type ${options.type}${options.model ? ` and --model ${options.model}` : ""}.`);
  }

  await previewPlan({
    options,
    providers: plannedProviders,
    task
  });

  if (!options.skipSetup) {
    await ensureAccount(setupArgs);
  }

  if (paymentMode !== "mpp" && !options.skipFund && setupArgs.rpcUrl === TESTNET_RPC_URL) {
    try {
      await runMppx(["account", "fund", ...buildMppxArgs(setupArgs)]);
    } catch (_error) {
      // Funding can fail on faucet limits; routing can still proceed.
    }
  }

  if (paymentMode === "mpp") {
    const balanceView = await accountView(setupArgs);
    const accountAddress = extractAccountAddress(balanceView.stdout);
    const requireMainnetBalance = process.env.AUTOROUTER_REQUIRE_MAINNET_BALANCE !== "0";
    const walletHasBalance = requireMainnetBalance
      ? hasPositiveMainnetUsdBalance(balanceView.stdout)
      : hasPositiveBalance(balanceView.stdout);
    if (options.forceTopup || !walletHasBalance) {
      if (accountAddress) {
        console.log(`Fund this MPP wallet address: ${accountAddress}`);
      }
      await runFiatTopupFlow(options);
      const balanceAfter = await waitForWalletBalanceUpdate(setupArgs);
      if (balanceAfter) {
        console.log("Top-up detected. Wallet balance updated.");
        console.log(balanceAfter);
        console.log("");
      }
    }
  }

  const routedArgs = [
    "--type", options.type,
    "--auto", options.prompt,
    "--source", options.source,
    "--pricing", options.pricing,
    "--mode", options.mode,
    "--payment", paymentMode
  ];

  if (options.model) {
    routedArgs.push("--model", options.model);
  }
  if (Number.isFinite(options.seconds) && options.seconds > 0) {
    routedArgs.push("--seconds", String(options.seconds));
  }

  await runRouteCommand(routedArgs);
}

function baseMppArgs(args, defaultRpc = undefined) {
  const account = readOption(args, "--account");
  const rpcUrl =
    readOption(args, "--rpc-url") ||
    process.env.AUTOROUTER_MPP_RPC_URL ||
    process.env.MPPX_RPC_URL ||
    defaultRpc;

  return {
    account,
    rpcUrl
  };
}

async function runMppSetup(args) {
  const setupArgs = baseMppArgs(args, TESTNET_RPC_URL);
  const skillMode = readOption(args, "--skills") || "project";
  if (!new Set(["project", "global", "skip"]).has(skillMode)) {
    throw new Error("Invalid --skills option. Use project, global, or skip.");
  }

  const accountResult = await ensureAccount(setupArgs);
  const balance = await accountView(setupArgs);

  let skillOutput = "Skill sync skipped.";
  if (skillMode === "project") {
    try {
      const result = await runMppx(["skills", "add", "--no-global"]);
      skillOutput = result.stdout || "Project skills synced.";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skillOutput = `Skill sync warning (project): ${message}`;
    }
  } else if (skillMode === "global") {
    try {
      const result = await runMppx(["skills", "add"]);
      skillOutput = result.stdout || "Global skills synced.";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skillOutput = `Skill sync warning (global): ${message}`;
    }
  }

  console.log(accountResult.created ? "MPP account created." : "MPP account already exists.");
  console.log(accountResult.output);
  console.log("");
  console.log("Current balance:");
  console.log(balance.stdout);
  console.log("");
  console.log(skillOutput);
}

async function runMppFund(args) {
  const fundArgs = baseMppArgs(args, TESTNET_RPC_URL);
  await ensureAccount(fundArgs);
  const result = await runMppx(["account", "fund", ...buildMppxArgs(fundArgs)]);
  console.log(result.stdout);
}

async function runMppBalance(args) {
  const balanceArgs = baseMppArgs(args);
  const result = await accountView(balanceArgs);
  console.log(result.stdout);
}

async function main() {
  const [command, subcommand, ...args] = process.argv.slice(2);

  if (!command || command === "-h" || command === "--help" || command === "help") {
    printHelp();
    return;
  }

  if (command === "run") {
    await runRouteCommand([subcommand, ...args].filter(Boolean));
    return;
  }

  if (command === "one") {
    await runOneCommand([subcommand, ...args].filter(Boolean));
    return;
  }

  if (command === "text") {
    await runRouteCommand([subcommand, ...args].filter(Boolean), "text");
    return;
  }

  if (command === "audio") {
    await runRouteCommand([subcommand, ...args].filter(Boolean), "audio");
    return;
  }

  if (command === "video") {
    await runRouteCommand([subcommand, ...args].filter(Boolean), "video");
    return;
  }

  if (command === "models" && subcommand === "list") {
    await runModelsList(args);
    return;
  }

  if (command === "providers" && subcommand === "list") {
    await runProvidersList(args);
    return;
  }

  if (command === "demo") {
    await runDemo();
    return;
  }

  if (command === "mpp") {
    if (subcommand === "setup") {
      await runMppSetup(args);
      return;
    }
    if (subcommand === "fund") {
      await runMppFund(args);
      return;
    }
    if (subcommand === "balance") {
      await runMppBalance(args);
      return;
    }
    throw new Error("Unknown mpp command. Use setup, fund, or balance.");
  }

  throw new Error("Unknown command. Use --help for usage.");
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
