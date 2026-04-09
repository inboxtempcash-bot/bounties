#!/usr/bin/env node

import { routeTextTask } from "../core/router";
import { PaymentMode, RouteMode } from "../core/types";
import { listProviderNames } from "../providers";
import { printRouteResult } from "./format";

const ROUTE_MODES: RouteMode[] = [
  "balanced",
  "cheapest",
  "fastest",
  "best-quality",
];

const PAYMENT_MODES: PaymentMode[] = ["simulated", "x402", "mpp"];

function readOption(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function printHelp(): void {
  console.log("AutoRouter CLI");
  console.log("");
  console.log("Commands:");
  console.log('autorouter text --auto "prompt" [--mode balanced|cheapest|fastest|best-quality] [--payment simulated|x402|mpp]');
  console.log("autorouter providers list");
  console.log("autorouter demo");
}

async function runTextCommand(args: string[]): Promise<void> {
  const prompt = readOption(args, "--auto");

  if (!prompt) {
    throw new Error("Missing --auto \"prompt\" argument.");
  }

  const modeRaw = readOption(args, "--mode") ?? "balanced";
  const paymentRaw = readOption(args, "--payment") ?? "simulated";

  if (!ROUTE_MODES.includes(modeRaw as RouteMode)) {
    throw new Error(`Invalid --mode value: ${modeRaw}`);
  }

  if (!PAYMENT_MODES.includes(paymentRaw as PaymentMode)) {
    throw new Error(`Invalid --payment value: ${paymentRaw}`);
  }

  const result = await routeTextTask({
    prompt,
    mode: modeRaw as RouteMode,
    paymentMode: paymentRaw as PaymentMode,
  });

  printRouteResult(result);
}

function runProvidersCommand(args: string[]): void {
  if (args[0] !== "list") {
    throw new Error("Usage: autorouter providers list");
  }

  for (const provider of listProviderNames()) {
    console.log(provider);
  }
}

async function runDemo(): Promise<void> {
  const result = await routeTextTask({
    prompt: "write a launch tweet",
    mode: "balanced",
    paymentMode: "simulated",
  });

  printRouteResult(result);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "help") {
    printHelp();
    return;
  }

  if (command === "text") {
    await runTextCommand(args.slice(1));
    return;
  }

  if (command === "providers") {
    runProvidersCommand(args.slice(1));
    return;
  }

  if (command === "demo") {
    await runDemo();
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
