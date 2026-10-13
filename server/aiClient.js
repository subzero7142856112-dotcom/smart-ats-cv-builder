/**
 * server/aiClient.js
 * ------------------------------------------------------------------------------------------
 * Provider-agnostic AI client. Runs ONLY on the backend / serverless side.
 *
 * Reads three environment variables (never exposed to the frontend):
 *   AI_API_KEY   - secret key for the chosen provider
 *   AI_PROVIDER  - one of: openai | claude | gemini | groq | openrouter   (default: openai)
 *   AI_MODEL     - model name for that provider (a sensible default is used if omitted)
 *
 * Public surface:
 *   chat({ system, user, temperature, maxTokens })  -> Promise<string>
 *   chatJSON({ system, user, temperature, maxTokens }) -> Promise<object>   (parsed JSON)
 *   AiConfigError, AiProviderError                  -> typed errors for clean handling
 *
 * Switching providers later = change AI_PROVIDER + AI_MODEL env vars. No code change.
 * ----------------------------------------------------------------------------------------*/

export class AiConfigError extends Error {
  constructor(message) { super(message); this.name = "AiConfigError"; this.code = "AI_CONFIG"; }
}
export class AiProviderError extends Error {
  constructor(message) { super(message); this.name = "AiProviderError"; this.code = "AI_PROVIDER"; }
}

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  claude: "claude-3-5-sonnet-latest",
  gemini: "gemini-1.5-flash",
  groq: "llama-3.3-70b-versatile",
  openrouter: "openai/gpt-4o-mini",
};

// Providers that speak the OpenAI Chat Completions dialect (only the base URL differs).
const OPENAI_COMPATIBLE = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

function getConfig() {
  const apiKey = process.env.AI_API_KEY;
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase().trim();
  const model = (process.env.AI_MODEL || DEFAULT_MODELS[provider] || "").trim();

  if (!apiKey) {
    throw new AiConfigError("AI API key is not configured. Add AI_API_KEY to environment variables.");
  }
  if (!DEFAULT_MODELS[provider]) {
    throw new AiConfigError(
      `Unknown AI_PROVIDER "${provider}". Use one of: ${Object.keys(DEFAULT_MODELS).join(", ")}.`
    );
  }
  return { apiKey, provider, model };
}

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

/* ----------------------------- provider adapters ---------------------------------------- */

async function callOpenAICompatible({ baseURL, apiKey, model, system, user, temperature, maxTokens }) {
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new AiProviderError(err?.error?.message || `Provider responded with ${res.status}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new AiProviderError("Empty response from AI provider.");
  return text;
}

async function callClaude({ apiKey, model, system, user, temperature, maxTokens }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new AiProviderError(err?.error?.message || `Provider responded with ${res.status}`);
  }
  const data = await res.json();
  const text = Array.isArray(data?.content)
    ? data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n")
    : "";
  if (!text) throw new AiProviderError("Empty response from AI provider.");
  return text;
}

async function callGemini({ apiKey, model, system, user, temperature, maxTokens }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new AiProviderError(err?.error?.message || `Provider responded with ${res.status}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!text) throw new AiProviderError("Empty response from AI provider.");
  return text;
}

/* ----------------------------------- public API ----------------------------------------- */

/**
 * Send a single-turn chat request. Returns the model's text.
 * Throws AiConfigError (missing/invalid env) or AiProviderError (upstream failure).
 */
export async function chat({ system, user, temperature = 0.4, maxTokens = 900 }) {
  const { apiKey, provider, model } = getConfig();
  try {
    if (OPENAI_COMPATIBLE[provider]) {
      return await callOpenAICompatible({ baseURL: OPENAI_COMPATIBLE[provider], apiKey, model, system, user, temperature, maxTokens });
    }
    if (provider === "claude") return await callClaude({ apiKey, model, system, user, temperature, maxTokens });
    if (provider === "gemini") return await callGemini({ apiKey, model, system, user, temperature, maxTokens });
    throw new AiConfigError(`Unsupported provider "${provider}".`);
  } catch (e) {
    if (e instanceof AiConfigError || e instanceof AiProviderError) throw e;
    // Network / unexpected failure -> generic, user-safe message.
    throw new AiProviderError("AI service is currently unavailable. Please try again later.");
  }
}

/** Strip ```json fences and parse. Tolerant of leading/trailing prose. */
function parseLooseJson(text) {
  const cleaned = String(text).replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* fall through */ }
  }
  throw new AiProviderError("AI returned an unexpected format. Please try again.");
}

/** Same as chat() but instructs the model to emit JSON and returns the parsed object. */
export async function chatJSON({ system, user, temperature = 0.3, maxTokens = 1100 }) {
  const jsonSystem = `${system}\n\nRespond with ONLY valid minified JSON. No markdown, no code fences, no commentary.`;
  const text = await chat({ system: jsonSystem, user, temperature, maxTokens });
  return parseLooseJson(text);
}

export { getConfig };
