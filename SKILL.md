# AutoRouter Skill

Use this skill to route AI tasks to the best-priced API with MPP payments and Stripe top-up.

## Goal

When asked, run AutoRouter in one command mode:

```bash
npx -y github:inboxtempcash-bot/bounties#main one --type video --source mpp --auto "make a 6 second teaser" --seconds 6 --yes
```

## Payment and top-up behavior

- If wallet has balance, continue.
- If wallet is empty, open Stripe checkout and wait for balance update.
- Wallet address is printed by CLI and must be used as the funding destination.

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
