#!/usr/bin/env node
import { createHmac, timingSafeEqual } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import http from "node:http";
import { join } from "node:path";
import process from "node:process";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const STRIPE_API_BASE = "https://api.stripe.com/v1";
const LOG_DIR = join(process.cwd(), ".context", "stripe");
const LOG_FILE = join(LOG_DIR, "events.jsonl");

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(`${JSON.stringify(payload)}\n`);
}

function notFound(res) {
  json(res, 404, { error: "Not found." });
}

function methodNotAllowed(res) {
  json(res, 405, { error: "Method not allowed." });
}

function badRequest(res, message) {
  json(res, 400, { error: message });
}

function internalError(res, message) {
  json(res, 500, { error: message });
}

function unauthorized(res) {
  json(res, 401, { error: "Unauthorized." });
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseJsonBody(rawBody) {
  if (!rawBody || rawBody.length === 0) {
    return {};
  }
  try {
    return JSON.parse(rawBody.toString("utf8"));
  } catch (_error) {
    return null;
  }
}

function isAuthorizedRequest(req) {
  const requiredToken = getEnv("AUTOROUTER_CHECKOUT_SERVER_TOKEN");
  if (!requiredToken) {
    return true;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const providedToken = authHeader.slice("Bearer ".length).trim();
  return providedToken === requiredToken;
}

function getEnv(name, fallback = undefined) {
  const value = process.env[name];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallback;
}

function requireEnv(name) {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required env var ${name}.`);
  }
  return value;
}

function looksLikeAddress(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function toStripeAmountCents(body) {
  const rawAmount = body?.amountUsd ?? body?.amount ?? getEnv("STRIPE_TOPUP_USD_DEFAULT", "20");
  const numeric = Number(rawAmount);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("amountUsd must be a positive number.");
  }
  const cents = Math.round(numeric * 100);
  if (cents < 50) {
    throw new Error("amountUsd is too low. Minimum is $0.50.");
  }
  return cents;
}

function applyTemplate(template, context) {
  return template
    .replaceAll("{address}", encodeURIComponent(context.walletAddress))
    .replaceAll("{address_raw}", context.walletAddress)
    .replaceAll("{session_id}", "{CHECKOUT_SESSION_ID}");
}

function encodeForm(params) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    form.set(key, String(value));
  }
  return form;
}

async function createStripeCheckoutSession({ walletAddress, amountCents }) {
  const stripeSecretKey = requireEnv("STRIPE_SECRET_KEY");
  const currency = getEnv("STRIPE_CURRENCY", "usd");
  const productName = getEnv("STRIPE_TOPUP_PRODUCT_NAME", "AutoRouter Wallet Top-up");
  const successTemplate = getEnv("STRIPE_SUCCESS_URL", "https://wallet.tempo.xyz");
  const cancelTemplate = getEnv("STRIPE_CANCEL_URL", "https://wallet.tempo.xyz");
  const context = { walletAddress };

  const stripePriceId = getEnv("STRIPE_PRICE_ID");
  const params = {
    mode: "payment",
    "client_reference_id": walletAddress,
    "metadata[walletAddress]": walletAddress,
    "payment_intent_data[metadata][walletAddress]": walletAddress,
    success_url: applyTemplate(successTemplate, context),
    cancel_url: applyTemplate(cancelTemplate, context)
  };

  if (stripePriceId) {
    params["line_items[0][price]"] = stripePriceId;
    params["line_items[0][quantity]"] = "1";
  } else {
    params["line_items[0][price_data][currency]"] = currency;
    params["line_items[0][price_data][unit_amount]"] = String(amountCents);
    params["line_items[0][price_data][product_data][name]"] = productName;
    params["line_items[0][quantity]"] = "1";
  }

  const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: encodeForm(params)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Stripe API error (${response.status}): ${text}`);
  }

  const payload = JSON.parse(text);
  if (!payload?.url) {
    throw new Error("Stripe response did not include checkout URL.");
  }

  return {
    id: payload.id,
    url: payload.url
  };
}

function parseStripeSignatureHeader(header) {
  if (!header) {
    return null;
  }
  const pairs = header.split(",").map((part) => part.trim());
  const result = {};
  for (const pair of pairs) {
    const [key, value] = pair.split("=");
    if (key && value) {
      result[key] = value;
    }
  }
  if (!result.t || !result.v1) {
    return null;
  }
  return {
    timestamp: result.t,
    signature: result.v1
  };
}

function verifyStripeWebhookSignature(rawBody, signatureHeader, secret) {
  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed) {
    return false;
  }

  const payload = `${parsed.timestamp}.${rawBody.toString("utf8")}`;
  const digest = createHmac("sha256", secret).update(payload).digest("hex");
  const provided = Buffer.from(parsed.signature, "hex");
  const expected = Buffer.from(digest, "hex");
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(provided, expected);
}

async function logEvent(record) {
  await mkdir(LOG_DIR, { recursive: true });
  await appendFile(LOG_FILE, `${JSON.stringify(record)}\n`, "utf8");
}

async function forwardSettlementEvent(event) {
  const targetUrl = getEnv("AUTOROUTER_TOPUP_SETTLEMENT_URL");
  if (!targetUrl) {
    return;
  }

  const token = getEnv("AUTOROUTER_TOPUP_SETTLEMENT_TOKEN");
  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(event)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Settlement hook failed (${response.status}): ${details}`);
  }
}

async function handleCreateCheckout(req, res, rawBody) {
  if (!isAuthorizedRequest(req)) {
    unauthorized(res);
    return;
  }

  const body = parseJsonBody(rawBody);
  if (!body) {
    badRequest(res, "Invalid JSON body.");
    return;
  }

  const walletAddress = String(body.walletAddress ?? body.address ?? "").trim();
  if (!looksLikeAddress(walletAddress)) {
    badRequest(res, "walletAddress must be a valid 0x address.");
    return;
  }

  let amountCents;
  try {
    amountCents = toStripeAmountCents(body);
  } catch (error) {
    badRequest(res, error.message);
    return;
  }

  try {
    const session = await createStripeCheckoutSession({
      walletAddress,
      amountCents
    });
    await logEvent({
      type: "checkout.session.created",
      at: new Date().toISOString(),
      walletAddress,
      amountCents,
      sessionId: session.id
    });

    json(res, 200, {
      checkoutUrl: session.url,
      sessionId: session.id,
      walletAddress
    });
  } catch (error) {
    internalError(res, error.message);
  }
}

async function handleStripeWebhook(req, res, rawBody) {
  const secret = getEnv("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    internalError(res, "Missing STRIPE_WEBHOOK_SECRET.");
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!verifyStripeWebhookSignature(rawBody, signature, secret)) {
    json(res, 400, { error: "Invalid Stripe webhook signature." });
    return;
  }

  const event = parseJsonBody(rawBody);
  if (!event || !event.type) {
    badRequest(res, "Invalid Stripe webhook payload.");
    return;
  }

  try {
    await logEvent({
      type: event.type,
      at: new Date().toISOString(),
      eventId: event.id
    });

    if (event.type === "checkout.session.completed") {
      const session = event.data?.object ?? {};
      const walletAddress = String(
        session.metadata?.walletAddress || session.client_reference_id || ""
      ).trim();
      const settlementEvent = {
        type: "topup.completed",
        at: new Date().toISOString(),
        walletAddress,
        sessionId: session.id,
        amountTotal: session.amount_total,
        currency: session.currency
      };
      await logEvent(settlementEvent);
      await forwardSettlementEvent(settlementEvent);
    }

    json(res, 200, { ok: true });
  } catch (error) {
    internalError(res, error.message);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      notFound(res);
      return;
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const rawBody = await readRequestBody(req);
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/healthz") {
      json(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/stripe/checkout") {
      if (req.method !== "POST") {
        methodNotAllowed(res);
        return;
      }
      await handleCreateCheckout(req, res, rawBody);
      return;
    }

    if (url.pathname === "/api/stripe/webhook") {
      if (req.method !== "POST") {
        methodNotAllowed(res);
        return;
      }
      await handleStripeWebhook(req, res, rawBody);
      return;
    }

    notFound(res);
  } catch (error) {
    internalError(res, error.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Stripe checkout server listening on http://${HOST}:${PORT}`);
  console.log("POST /api/stripe/checkout -> returns checkout URL for wallet top-up");
  console.log("POST /api/stripe/webhook -> Stripe webhook endpoint");
});
