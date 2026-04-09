# Stripe Top-up Server

This server creates Stripe Checkout sessions bound to a specific wallet address.

It is intended for AutoRouter's CLI top-up flow:

- CLI sends `POST /api/stripe/checkout` with `{ walletAddress }`
- Server returns `{ checkoutUrl }`
- User pays in Stripe
- Stripe calls `/api/stripe/webhook`
- Webhook can transfer USDC/PathUSD on-chain directly (or forward to your own settlement hook)

## 1) Configure env vars

```bash
export STRIPE_SECRET_KEY="sk_live_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."

# Either use a fixed Stripe price:
export STRIPE_PRICE_ID="price_..."

# Or dynamic amount (default $20):
export STRIPE_TOPUP_USD_DEFAULT="20"
export STRIPE_CURRENCY="usd"
export STRIPE_TOPUP_PRODUCT_NAME="AutoRouter Wallet Top-up"

# Redirects after checkout:
export STRIPE_SUCCESS_URL="https://yourapp.com/topup/success?wallet={address}&session_id={session_id}"
export STRIPE_CANCEL_URL="https://yourapp.com/topup/cancel?wallet={address}"

# Optional: where to send "topup.completed" so your infra can settle to wallet
export AUTOROUTER_TOPUP_SETTLEMENT_URL="https://yourapp.com/api/settle-topup"
export AUTOROUTER_TOPUP_SETTLEMENT_TOKEN="your-internal-token"

# Optional: protect /api/stripe/checkout with bearer auth
export AUTOROUTER_CHECKOUT_SERVER_TOKEN="your-server-token"

# Optional built-in on-chain settlement (recommended for full automation)
export AUTOROUTER_SETTLEMENT_MODE="erc20_transfer"
export AUTOROUTER_SETTLEMENT_RPC_URL="https://rpc.presto.tempo.xyz"
export AUTOROUTER_SETTLEMENT_CHAIN_ID="4217"
export AUTOROUTER_SETTLEMENT_PRIVATE_KEY="0x..."
export AUTOROUTER_SETTLEMENT_TOKEN_ADDRESS="0x..."   # USDC/PathUSD token on this chain
export AUTOROUTER_SETTLEMENT_TOKEN_DECIMALS="6"
export AUTOROUTER_SETTLEMENT_CONFIRMATIONS="1"
```

## 2) Run server

```bash
npm run stripe:server
```

Default bind:
- `HOST=0.0.0.0`
- `PORT=8787`

## 3) Point AutoRouter CLI at this server

```bash
export AUTOROUTER_STRIPE_CHECKOUT_API_URL="https://your-server.com/api/stripe/checkout"
export AUTOROUTER_STRIPE_CHECKOUT_API_KEY="your-server-token"
```

Then run one-command flow:

```bash
npx -y github:inboxtempcash-bot/bounties#main one --type video --source mpp --auto "make a 6 second teaser" --seconds 6 --yes
```

## API contract

### POST `/api/stripe/checkout`

Request:

```json
{
  "walletAddress": "0x...",
  "amountUsd": 20
}
```

Response:

```json
{
  "checkoutUrl": "https://checkout.stripe.com/...",
  "sessionId": "cs_...",
  "walletAddress": "0x..."
}
```

### POST `/api/stripe/webhook`

Validates `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`.

On `checkout.session.completed`, logs event and forwards:

```json
{
  "type": "topup.completed",
  "walletAddress": "0x...",
  "sessionId": "cs_...",
  "amountTotal": 2000,
  "currency": "usd"
}
```

to `AUTOROUTER_TOPUP_SETTLEMENT_URL` if configured.

If `AUTOROUTER_SETTLEMENT_MODE=erc20_transfer` is set, webhook also performs direct ERC-20 transfer from treasury wallet to the user's wallet address.
