export function estimateUsage(task) {
  const modality = task.type ?? "text";
  const promptText = task.prompt ?? "";

  if (modality === "audio") {
    const durationSeconds = Math.max(5, Number(task.durationSeconds ?? 30));
    return {
      tokensIn: 0,
      tokensOut: 0,
      estimatedSeconds: durationSeconds
    };
  }

  if (modality === "video") {
    const durationSeconds = Math.max(4, Number(task.durationSeconds ?? 8));
    return {
      tokensIn: 0,
      tokensOut: 0,
      estimatedSeconds: durationSeconds
    };
  }

  const tokensIn = Math.max(16, Math.ceil(promptText.length / 4) + 24);
  const tokensOut = Math.max(48, Math.ceil(tokensIn * 1.4));
  const estimatedSeconds = Math.max(1, Math.ceil(tokensOut / 120));

  return {
    tokensIn,
    tokensOut,
    estimatedSeconds
  };
}
