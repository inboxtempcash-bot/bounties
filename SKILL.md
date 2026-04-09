# AutoRouter Skill

Use this skill to route AI tasks to the best-priced API with MPP payments and automatic wallet top-up.

## Goal

When asked, run AutoRouter in one command mode:

```bash
npx -y github:inboxtempcash-bot/bounties#main one --type video --source mpp --auto "make a 6 second teaser" --seconds 6 --yes
```

## Payment and top-up behavior

- If wallet has balance, continue.
- If wallet is empty, open top-up and wait for balance update.
- CLI uses Stripe checkout only if configured.
- If Stripe is not configured and on testnet RPC, CLI uses Tempo faucet funding (`tempo_fundAddress`) only when `AUTOROUTER_ENABLE_TESTNET_FAUCET_FALLBACK=1`.
- If Stripe is not configured and not on testnet RPC, CLI falls back to Tempo wallet balances (`wallet.tempo.xyz/balances`).
- Wallet address is printed by CLI and must be used as the funding destination.
- For real USD, run with `--real-usd` and configure Stripe checkout.

## Stripe config

Prefer dynamic checkout API:

```bash
export AUTOROUTER_STRIPE_CHECKOUT_API_URL="https://yourapp.com/api/stripe/checkout"
export AUTOROUTER_STRIPE_CHECKOUT_API_KEY="your-server-token"
```

Quick local server from this repo:

```bash
export STRIPE_SECRET_KEY="sk_live_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
export AUTOROUTER_CHECKOUT_SERVER_TOKEN="your-server-token"

# Optional auto settlement from Stripe payment to user's wallet balance
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

Your checkout API must:
- accept `{ "walletAddress": "0x..." }`
- return `{ "checkoutUrl": "https://checkout.stripe.com/..." }`

Or use static URL template:

```bash
export AUTOROUTER_STRIPE_CHECKOUT_URL="https://yourapp.com/topup?wallet={address}"
```

Optional hosted top-up defaults:

```bash
export AUTOROUTER_DEFAULT_TOPUP_USD="20"
export AUTOROUTER_TEMPO_TOPUP_CHAIN_ID="4217"
```

## Common tasks

Text:

```bash
npx -y github:inboxtempcash-bot/bounties#main one --type text --source mpp --auto "write a launch tweet" --yes
```

Audio:

```bash
npx -y github:inboxtempcash-bot/bounties#main one --type audio --source mpp --auto "transcribe this call" --seconds 45 --yes
```

Video:

```bash
npx -y github:inboxtempcash-bot/bounties#main one --type video --source mpp --auto "make a 6 second teaser" --seconds 6 --yes
```
