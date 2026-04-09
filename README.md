# AutoRouter MVP

Derived bidding router that evaluates provider bids, chooses a winner, executes the task, and logs results.

Supports modalities:
- `text`
- `audio`
- `video`

Provider sources:
- `core`: built-in model catalog (default)
- `mpp`: live service catalog from `https://mpp.dev/api/services`
- `all`: combine `core` + `mpp`

One-command mode:
- `one` auto-creates MPP account and routes with cheapest pricing.
- For `--source mpp` or `--source all`, `one` uses real MPP payments by default.
- If wallet has no mainnet PathUSD/USDC balance, it prompts top-up and opens a funding URL automatically.
- If Stripe checkout is configured (URL or API), CLI uses that.
- Testnet faucet fallback is disabled by default. Enable it only for demos with `AUTOROUTER_ENABLE_TESTNET_FAUCET_FALLBACK=1`.
- Use `--real-usd` to force mainnet for real USD funding. If Stripe checkout is not configured, CLI falls back to Tempo hosted wallet funding page.
- Use `--payment simulated` for dry-run/demo mode.

Pricing modes:
- `live` (default): fetches current pricing from OpenRouter `/api/v1/models`
- `static`: uses adapter fallback prices

Payment modes:
- `simulated`
- `x402` (placeholder flow)
- `mpp` (real `mppx` payment request)

## Install

Run globally from any terminal right now (no install):

```bash
npx -y github:inboxtempcash-bot/bounties --help
```

Tweetable agent one-liner (Tempo-style):

```bash
claude "Read https://gist.githubusercontent.com/inboxtempcash-bot/685190444dba6bed71ff4bcb464ccfc2/raw/d660fa574e5fa8e09a8eda962cd8096445b06ae7/SKILL.md and use it to run: build me a 6 second teaser video about why you should join alliance"
```

Permanent global install from npm (after publish):

```bash
npm i -g autorouter-cli
```

From source (local development):

```bash
npm install
npm link
```

## Quick start

One command end-to-end from anywhere (no local clone required):

```bash
npx -y github:inboxtempcash-bot/bounties one --type video --source mpp --auto "make a 6 second teaser" --seconds 6
```

One command end-to-end (after global install):

```bash
autorouter one --type video --source mpp --auto "make a 6 second teaser" --seconds 6 --real-usd
```

Optional Stripe top-up wiring (overrides default hosted Tempo top-up):

```bash
# Static checkout URL that embeds wallet address
export AUTOROUTER_STRIPE_CHECKOUT_URL="https://yourapp.com/topup?wallet={address}"

# Or dynamic checkout session API (returns {"checkoutUrl":"https://checkout.stripe.com/..."})
export AUTOROUTER_STRIPE_CHECKOUT_API_URL="https://yourapp.com/api/stripe/checkout"
export AUTOROUTER_STRIPE_CHECKOUT_API_KEY="your-server-token"
```

Built-in server from this repo:

```bash
export STRIPE_SECRET_KEY="sk_live_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
export AUTOROUTER_CHECKOUT_SERVER_TOKEN="your-server-token"

# Built-in auto settlement (Stripe -> on-chain USDC/PathUSD transfer)
export AUTOROUTER_SETTLEMENT_MODE="erc20_transfer"
export AUTOROUTER_SETTLEMENT_RPC_URL="https://rpc.presto.tempo.xyz"
export AUTOROUTER_SETTLEMENT_CHAIN_ID="4217"
export AUTOROUTER_SETTLEMENT_PRIVATE_KEY="0x..."
export AUTOROUTER_SETTLEMENT_TOKEN_ADDRESS="0x..."
export AUTOROUTER_SETTLEMENT_TOKEN_DECIMALS="6"

npm run stripe:server

export AUTOROUTER_STRIPE_CHECKOUT_API_URL="http://localhost:8787/api/stripe/checkout"
export AUTOROUTER_STRIPE_CHECKOUT_API_KEY="your-server-token"
```

Detailed server setup: `server/README.md`.

Real payment with one command:

```bash
autorouter one --type video --source mpp --auto "make a 6 second teaser" --seconds 6
```

First-time user real-pay flow:
1. CLI previews APIs found for request and auto-selects best-value option (price + rating).
2. CLI says how to list/select alternatives.
3. If mainnet wallet balance is empty, CLI prompts top-up and opens a funding URL.
4. If Stripe checkout is configured, CLI injects the detected wallet address into your checkout URL if it contains `{address}` (or fetches a dynamic checkout URL from your API).
5. If Stripe checkout is not configured, CLI opens Tempo hosted wallet balances (`/balances`) with wallet/amount/chain query hints.
6. If `AUTOROUTER_ENABLE_TESTNET_FAUCET_FALLBACK=1` and you are on testnet RPC, CLI can request faucet funds via `tempo_fundAddress`.
7. After checkout or faucet funding, CLI waits for wallet balance update and then continues request execution.

Optional explicit setup:

```bash
autorouter mpp setup --skills project
```

This creates/uses an `mppx` account and syncs skills into local agent folders (`.agents/`, `.claude/`, `.codex/`).

## Commands

- `autorouter models list [--type text|audio|video] [--mode balanced|cheapest|fastest|best-quality] [--pricing live|static] [--source core|mpp|all] [--auto "sample prompt"] [--seconds n]`
- `autorouter one --type text|audio|video --auto "prompt" [--source core|mpp|all] [--mode balanced|cheapest|fastest|best-quality] [--pricing live|static] [--payment simulated|x402|mpp] [--real-pay] [--real-usd] [--checkout-url https://...] [--seconds n]`
- `autorouter run --type text|audio|video --auto "prompt" [--mode balanced|cheapest|fastest|best-quality] [--payment simulated|x402|mpp] [--pricing live|static] [--source core|mpp|all] [--model key-or-id] [--seconds n]`
- `autorouter text --auto "prompt" ...` (alias for `run --type text`)
- `autorouter audio --auto "prompt" ...` (alias for `run --type audio`)
- `autorouter video --auto "prompt" ...` (alias for `run --type video`)
- `autorouter mpp setup [--account name] [--rpc-url url] [--skills project|global|skip]`
- `autorouter mpp fund [--account name] [--rpc-url https://rpc.moderato.tempo.xyz]`
- `autorouter mpp balance [--account name] [--rpc-url url]`

Optional model-id overrides for live pricing:
- `OPENROUTER_MODEL_TEXT_OPENAI`
- `OPENROUTER_MODEL_TEXT_ANTHROPIC`
- `OPENROUTER_MODEL_TEXT_CHEAP`

MPP configuration:
- `AUTOROUTER_MPP_ACCOUNT`
- `AUTOROUTER_MPP_RPC_URL` (defaults to Tempo testnet RPC)
- `AUTOROUTER_MPP_CHARGE_URL` (defaults to `https://mpp.dev/api/ping/paid` for payment smoke tests)
- `AUTOROUTER_MPP_CHARGE_URL_<PROVIDER_NAME>` (provider name uppercased, non-alphanumeric replaced with `_`)
- `AUTOROUTER_MPP_METHOD_OPTS` (comma-separated `key=value` pairs, passed to `mppx --method-opt`)
- `AUTOROUTER_MPP_AUTO_CREATE_ACCOUNT` (`1` by default)
- `AUTOROUTER_MPP_AUTO_FUND_TESTNET` (`0` by default; set `1` only for faucet-style testnet demos)
- `AUTOROUTER_REQUIRE_MAINNET_BALANCE` (`1` by default for `one` top-up checks)
- `AUTOROUTER_ENABLE_TESTNET_FAUCET_FALLBACK` (`0` by default; set `1` to allow auto-faucet on testnet when Stripe checkout is missing)
- `AUTOROUTER_STRIPE_CHECKOUT_URL` (static checkout URL; supports `{address}` placeholder)
- `AUTOROUTER_STRIPE_CHECKOUT_URL_TEMPLATE` (same behavior as above; useful for template-only setups)
- `AUTOROUTER_STRIPE_CHECKOUT_API_URL` (POST endpoint that returns `{ checkoutUrl }` or `{ url }` for a given wallet address)
- `AUTOROUTER_STRIPE_CHECKOUT_API_KEY` (optional bearer token for the checkout API)
- `AUTOROUTER_DEFAULT_TOPUP_URL` (default: `https://wallet.tempo.xyz/balances`; can also be a custom Stripe URL)
- `AUTOROUTER_DEFAULT_TOPUP_USD` (default: `20`, passed to wallet deposit prompt)
- `AUTOROUTER_TEMPO_TOPUP_CHAIN_ID` (default: `4217`)
- `AUTOROUTER_TEMPO_TOPUP_TOKEN_ADDRESS` (optional token address to preselect in hosted top-up)

Execution configuration:
- `OPENROUTER_API_KEY` enables real model completions from selected provider model IDs.
- Without `OPENROUTER_API_KEY`, adapters return deterministic mock text for demo use.

MPP catalog notes:
- `--source mpp` derives live per-request prices from `mpp.dev` service discovery endpoint data.
- For multi-endpoint services, pricing uses the lowest matching paid endpoint per modality (falls back to lowest paid endpoint).
- For one-command onboarding: use `--yes` to auto-accept top-up prompts; use `--force-topup` to test checkout-open flow.
- Current adapter scope: MPP providers execute as routed payment + selection stubs for audio/video, and do not yet write media files or provide a `download` command.

## Ledger

Each run appends a JSON line to `.context/ledger/requests.jsonl` with bids, selected provider, payment mode, and output.
