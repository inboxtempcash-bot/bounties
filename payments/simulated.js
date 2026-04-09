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

export async function handleSimulatedPayment({ amountUsd }) {
  return {
    protocol: "simulated",
    summary: `logged ${formatMoney(amountUsd)} USD (no transfer)`
  };
}
