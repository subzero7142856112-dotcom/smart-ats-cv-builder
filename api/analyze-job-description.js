/** POST /api/analyze-job-description
 *  in : { jobDescription, cvData }
 *  out: { matchScore, matchedKeywords, missingKeywords, recommendedSkills, summarySuggestions, bulletSuggestions }
 */
import { chatJSON } from "../server/aiClient.js";
import { jobMatchPrompt } from "../server/prompts.js";
import { createHandler } from "../server/respond.js";

const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export default createHandler(async ({ jobDescription = "", cvData = {} }) => {
  const { system, user } = jobMatchPrompt({ jobDescription, cvData });
  const r = await chatJSON({ system, user, temperature: 0.3, maxTokens: 1100 });
  return {
    matchScore: clamp(r.matchScore),
    matchedKeywords: arr(r.matchedKeywords),
    missingKeywords: arr(r.missingKeywords),
    recommendedSkills: arr(r.recommendedSkills),
    summarySuggestions: arr(r.summarySuggestions),
    bulletSuggestions: arr(r.bulletSuggestions),
  };
});
