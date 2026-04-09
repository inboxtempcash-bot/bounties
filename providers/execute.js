function extractText(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

export async function executeTextViaOpenRouter({ modelId, prompt }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }

  const baseUrl = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "https://autorouter.local",
      "X-Title": process.env.OPENROUTER_APP_TITLE || "AutoRouter"
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenRouter completion failed (${response.status}): ${details}`);
  }

  const payload = await response.json();
  const choice = payload?.choices?.[0];
  const text = extractText(choice?.message?.content);
  const fallbackText = typeof choice?.text === "string" ? choice.text : "";

  return {
    text: text || fallbackText || "",
    source: "openrouter",
    model: payload?.model || modelId
  };
}

