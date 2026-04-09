# Release (Production) Steps

Use this checklist to publish `autorouter` so users can install and run it tomorrow.

## 1) Verify package locally

```bash
npm install
npm run release:check
npm pack --dry-run
```

## 2) Publish to npm

```bash
npm login
npm publish
```

After publish, users can install globally:

```bash
npm i -g autorouter-cli
```

## 3) Verify install from clean shell

```bash
autorouter --help
autorouter one --type video --source mpp --auto "make a 6 second teaser" --seconds 6
```

## 4) Real-pay onboarding setup

On first `--real-pay` run, users are prompted for Stripe Checkout URL if not set.
Optional non-interactive setup:

```bash
export AUTOROUTER_STRIPE_CHECKOUT_URL="https://checkout.stripe.com/your_checkout_link"
```

Then:

```bash
autorouter one --type video --source mpp --auto "make a 6 second teaser" --seconds 6 --real-pay
```

