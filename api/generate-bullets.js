/** POST /api/generate-bullets
 *  Generates bullets from scratch based on role title + company.
 */
import { chatJSON } from "../server/aiClient.js";
import { generateBulletsPrompt } from "../server/prompts.js";
import { createHandler } from "../server/respond.js";

export default createHandler(async ({ role = "", company = "", sectionType = "experience", targetRole = "", cvData = {}, count = 4, length = "medium", tone = "formal", customInstructions = "" }) => {
  const { system, user } = generateBulletsPrompt({ role, company, sectionType, targetRole, cvData, count, length, tone, customInstructions });
  const parsed = await chatJSON({ system, user, temperature: 0.6, maxTokens: 700 });
  const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.bullets) ? parsed.bullets : [];
  return { generatedBullets: arr.map((s) => String(s).trim()).filter(Boolean) };
});
