/** POST /api/improve-summary */
import { chat } from "../server/aiClient.js";
import { summaryPrompt } from "../server/prompts.js";
import { createHandler } from "../server/respond.js";

export default createHandler(async ({ summary = "", targetRole = "", cvData = {}, length = "medium", tone = "formal", customInstructions = "" }) => {
  const { system, user } = summaryPrompt({ summary, targetRole, cvData, length, tone, customInstructions });
  const text = await chat({ system, user, temperature: 0.5, maxTokens: 500 });
  return { improvedSummary: text.trim() };
});
