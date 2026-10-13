/**
 * server/respond.js
 * Small shared helpers for the serverless handlers: CORS, POST-only guard,
 * JSON body parsing, and consistent error -> HTTP mapping.
 *
 * Works with the Vercel/Node (req, res) signature. For other runtimes, the
 * error-mapping helper (toErrorResponse) can be reused directly.
 */
import { AiConfigError, AiProviderError } from "./aiClient.js";

export function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;          // Vercel pre-parses
  if (typeof req.body === "string" && req.body) { try { return JSON.parse(req.body); } catch { return {}; } }
  // Fallback: read the stream (plain Node).
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export function toErrorResponse(err) {
  if (err instanceof AiConfigError) return { status: 500, body: { error: err.message } };
  if (err instanceof AiProviderError) return { status: 502, body: { error: err.message } };
  return { status: 500, body: { error: "AI service is currently unavailable. Please try again later." } };
}

/**
 * Wrap a handler that returns a JSON-serializable object.
 * Usage:  export default createHandler(async (body) => ({ ... }));
 */
export function createHandler(run) {
  return async function handler(req, res) {
    applyCors(res);
    if (req.method === "OPTIONS") { res.status(204).end(); return; }
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed. Use POST." }); return; }
    try {
      const body = await readJsonBody(req);
      const result = await run(body);
      res.status(200).json(result);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      // Log server-side only; never leak stack/keys to the client.
      console.error("[AI handler error]", err?.name, err?.message);
      res.status(status).json(body);
    }
  };
}
