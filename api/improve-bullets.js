/** POST /api/improve-bullets */
import { chatJSON } from "../server/aiClient.js";
import { bulletsPrompt } from "../server/prompts.js";
import { createHandler } from "../server/respond.js";

export default createHandler(async ({ bullets = [], sectionType = "experience", targetRole = "", cvData = {}, length = "medium", tone = "formal", customInstructions = "" }) => {
  const clean = (Array.isArray(bullets) ? bullets : []).filter((b) => b && b.trim());
  if (!clean.length) return { improvedBullets: [] };
  const { system, user } = bulletsPrompt({ bullets: clean, sectionType, targetRole, cvData, length, tone, customInstructions });
  const parsed = await chatJSON({ system, user, temperature: 0.5, maxTokens: 700 });
  const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.improvedBullets) ? parsed.improvedBullets : [];
  return { improvedBullets: arr.map((s) => String(s).trim()).filter(Boolean) };
});
