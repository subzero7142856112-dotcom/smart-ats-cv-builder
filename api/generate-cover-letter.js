/** POST /api/generate-cover-letter
 *  in : { cvData, jobDescription, companyName, targetRole }
 *  out: { coverLetter }
 */
import { chat } from "../server/aiClient.js";
import { coverLetterPrompt } from "../server/prompts.js";
import { createHandler } from "../server/respond.js";

export default createHandler(async ({ cvData = {}, jobDescription = "", companyName = "", targetRole = "" }) => {
  const { system, user } = coverLetterPrompt({ cvData, jobDescription, companyName, targetRole });
  const text = await chat({ system, user, temperature: 0.6, maxTokens: 900 });
  return { coverLetter: text.trim() };
});
