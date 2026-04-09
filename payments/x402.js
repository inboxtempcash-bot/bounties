function formatMoney(value) {
  if (value >= 1) {
    return value.toFixed(4);
  }
  if (value >= 0.01) {
    return value.toFixed(5);
  }
  if (value >= 0.0001) {
    return value.toFixed(6);
  }
  return value.toFixed(8);
}

export async function handleX402Payment({ amountUsd }) {
  return {
    protocol: "x402",
    summary: `402 challenge handled, paid ${formatMoney(amountUsd)} USD, retried request`
  };
}
