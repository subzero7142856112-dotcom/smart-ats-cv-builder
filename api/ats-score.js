/** POST /api/ats-score
 *  in : { cvData, jobDescription? }
 *  out: { score, strengths, weaknesses, suggestions }
 */
import { chatJSON } from "../server/aiClient.js";
import { atsScorePrompt } from "../server/prompts.js";
import { createHandler } from "../server/respond.js";

const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export default createHandler(async ({ cvData = {}, jobDescription = "" }) => {
  const { system, user } = atsScorePrompt({ cvData, jobDescription });
  const r = await chatJSON({ system, user, temperature: 0.25, maxTokens: 900 });
  return {
    score: clamp(r.score),
    strengths: arr(r.strengths),
    weaknesses: arr(r.weaknesses),
    suggestions: arr(r.suggestions),
  };
});
