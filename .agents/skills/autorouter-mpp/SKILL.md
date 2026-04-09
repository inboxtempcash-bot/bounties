# AutoRouter MPP

Use this skill to route text, audio, or video tasks with live pricing and real MPP payments.

## Prerequisites

- `npx mppx` available
- Network access

## Setup

```bash
node cli/index.js mpp setup --skills project
```

## Fund testnet (Tempo)

```bash
node cli/index.js mpp fund --rpc-url https://rpc.moderato.tempo.xyz
```

## View balance

```bash
node cli/index.js mpp balance --rpc-url https://rpc.moderato.tempo.xyz
```

## Discover models with grades + prices

```bash
node cli/index.js models list --type text --source core --pricing live --mode cheapest
node cli/index.js models list --type text --source mpp --pricing live --mode cheapest
node cli/index.js models list --type audio --source mpp --pricing live --mode cheapest
node cli/index.js models list --type video --source mpp --pricing live --mode cheapest
```

## Route with live pricing + MPP settlement

```bash
node cli/index.js run --type text --source core --auto "write a launch tweet" --pricing live --payment mpp --mode cheapest
node cli/index.js run --type text --source mpp --auto "write a launch tweet" --pricing live --payment mpp --mode cheapest
node cli/index.js run --type audio --source mpp --auto "transcribe this call" --pricing live --payment mpp --mode cheapest --seconds 45
node cli/index.js run --type video --source mpp --auto "make a 6 second teaser" --pricing live --payment mpp --mode cheapest --seconds 6
```

## One-command onboarding + run

```bash
node cli/index.js one --type video --source mpp --auto "make a 6 second teaser" --seconds 6 --real-pay
```

If wallet is empty, CLI prompts top-up and opens Stripe checkout automatically.
If no checkout URL is configured yet, CLI asks for it once and saves it for future runs.

To use your own paid endpoint (instead of the default demo charge URL), set:

```bash
export AUTOROUTER_MPP_CHARGE_URL="https://your-mpp-endpoint.example/paid"
```

For per-provider settlement endpoints, use provider-name-based env vars:

```bash
export AUTOROUTER_MPP_CHARGE_URL_OPENAI_GPT_4O_MINI="https://your-mpp-endpoint.example/openai"
export AUTOROUTER_MPP_CHARGE_URL_CLAUDE_3_5_HAIKU="https://your-mpp-endpoint.example/anthropic"
export AUTOROUTER_MPP_CHARGE_URL_VIDEO_PIKA_STANDARD="https://your-mpp-endpoint.example/video"
```

## Optional environment variables

- `AUTOROUTER_MPP_ACCOUNT`
- `AUTOROUTER_MPP_RPC_URL`
- `AUTOROUTER_MPP_CHARGE_URL`
- `AUTOROUTER_MPP_CHARGE_URL_<PROVIDER_NAME>`
- `AUTOROUTER_STRIPE_CHECKOUT_URL`
- `AUTOROUTER_MPP_AUTO_CREATE_ACCOUNT` (`1` default)
- `AUTOROUTER_MPP_AUTO_FUND_TESTNET` (`1` default)
