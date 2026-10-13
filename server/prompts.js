/**
 * server/prompts.js
 * All prompt construction lives here so the content rules are enforced in ONE place.
 *
 * Hard rules applied to every prompt:
 *  - Never invent companies, certifications, degrees, numbers, or achievements.
 *  - Only rephrase / sharpen what the candidate actually provided.
 *  - Professional, ATS-friendly, concise. Strong action verbs. No empty buzzwords.
 *  - Measurable impact only when the user already supplied the numbers.
 */
import { cvToContext } from "./cvContext.js";

const GROUND_RULES = `You are an expert resume writer and ATS optimization specialist.
Strict rules you must never break:
- Do NOT invent or assume employers, job titles, dates, degrees, certifications, metrics, or achievements.
- Only rewrite, tighten, or reorganize information the candidate actually provided.
- If information is missing, improve wording with what exists — never fabricate to fill gaps.
- Write professional, concise, ATS-friendly content using strong action verbs.
- Avoid exaggerated claims and meaningless buzzwords.
- Include measurable impact ONLY when the candidate already provided the numbers.`;

const LENGTH_GUIDE = {
  summary: {
    short:    "Write exactly 2 lines. Be extremely concise.",
    medium:   "Write 3 to 5 lines, single paragraph.",
    detailed: "Write 5 to 7 lines with more depth and detail.",
  },
  bullets: {
    short:    "Each bullet must be under 12 words. Ultra-concise.",
    medium:   "Each bullet should be one line, 15-20 words.",
    detailed: "Each bullet can be 1-2 lines (20-30 words), with more context and specifics.",
  },
};

const TONE_GUIDE = {
  formal:    "Use formal, corporate business language.",
  technical: "Use precise technical terminology; reference specific tools, methods, and frameworks.",
  creative:  "Use dynamic, engaging language while remaining professional and ATS-friendly.",
};

function styleBlock(length = "medium", tone = "formal", customInstructions = "", type = "bullets") {
  const parts = [];
  const lg = LENGTH_GUIDE[type] || LENGTH_GUIDE.bullets;
  if (lg[length]) parts.push(lg[length]);
  if (TONE_GUIDE[tone]) parts.push(TONE_GUIDE[tone]);
  if (customInstructions && customInstructions.trim()) parts.push(`Additional user instructions: ${customInstructions.trim()}`);
  return parts.length ? "\n\nStyle requirements:\n" + parts.map((p) => `- ${p}`).join("\n") : "";
}

export function summaryPrompt({ summary, targetRole, cvData, length, tone, customInstructions }) {
  const ctx = cvToContext(cvData);
  const style = styleBlock(length, tone, customInstructions, "summary");
  return {
    system: GROUND_RULES,
    user: `${ctx}

TASK: Rewrite the professional summary${targetRole ? ` for a "${targetRole}" role` : ""}.
Requirements:
- Role-focused; lead with the candidate's strongest, real selling points.
- Naturally include relevant skills/keywords already present in the facts above.
- Professional and ATS-friendly. No first-person pronouns ("I", "my").${style}

Current summary (may be empty):
"""${summary || "(none provided)"}"""

Return ONLY the rewritten summary text — no preamble, no quotes, no labels.`,
  };
}

export function bulletsPrompt({ bullets, sectionType, targetRole, cvData, length, tone, customInstructions }) {
  const ctx = cvToContext(cvData);
  const kind = sectionType === "project" ? "project" : "work experience";
  const style = styleBlock(length, tone, customInstructions, "bullets");
  return {
    system: GROUND_RULES,
    user: `${ctx}

TASK: Improve the following ${kind} bullet points${targetRole ? ` for a "${targetRole}" role` : ""}.
Requirements:
- Start each bullet with a strong action verb.
- Preserve the candidate's real tools, scope, and any numbers they already gave.
- Do not add metrics, technologies, or outcomes that are not implied by the originals.
- Return the SAME number of bullets, improved one-for-one.${style}

Original bullets (JSON array):
${JSON.stringify((bullets || []).filter((b) => b && b.trim()), null, 0)}

Return ONLY a JSON array of strings, same length and order. No other text.`,
  };
}

export function generateBulletsPrompt({ role, company, sectionType, targetRole, cvData, count, length, tone, customInstructions }) {
  const ctx = cvToContext(cvData);
  const kind = sectionType === "project" ? "project" : "work experience";
  const n = count || 4;
  const style = styleBlock(length, tone, customInstructions, "bullets");
  return {
    system: GROUND_RULES + `

SPECIAL RULE FOR GENERATION: You are generating bullet points for a specific role.
Write realistic, role-appropriate bullets that describe typical responsibilities and contributions
for this position. Do NOT invent specific metrics, percentages, or numbers.
Use strong action verbs. Make bullets plausible and professional for this exact role.`,
    user: `${ctx}

TASK: Generate ${n} new ${kind} bullet points for this role:
- Role/Name: ${role || "Not specified"}
- Company/Tech: ${company || "Not specified"}${targetRole ? `\n- Target role: ${targetRole}` : ""}${style}

Return ONLY a JSON array of ${n} strings. No other text.`,
  };
}

export function jobMatchPrompt({ jobDescription, cvData }) {
  const ctx = cvToContext(cvData);
  return {
    system: GROUND_RULES,
    user: `${ctx}

JOB DESCRIPTION:
"""${jobDescription || ""}"""

TASK: Compare the candidate facts against the job description.
- Extract the most important keywords/skills from the job description.
- matchedKeywords: terms clearly present in the candidate facts.
- missingKeywords: important job terms NOT found in the candidate facts.
- recommendedSkills: realistic skills to add ONLY if they plausibly fit this candidate's background — never fabricated experience.
- summarySuggestions: 1-3 short, concrete ways to better target the summary (no fabricated claims).
- bulletSuggestions: 1-3 example bullet rewrites grounded in the candidate's real experience.
- matchScore: integer 0-100 reflecting overall alignment.

Return JSON exactly in this shape:
{"matchScore":0,"matchedKeywords":[],"missingKeywords":[],"recommendedSkills":[],"summarySuggestions":[],"bulletSuggestions":[]}`,
  };
}

export function atsScorePrompt({ cvData, jobDescription }) {
  const ctx = cvToContext(cvData);
  return {
    system: GROUND_RULES,
    user: `${ctx}
${jobDescription ? `\nTARGET JOB DESCRIPTION:\n"""${jobDescription}"""` : ""}

TASK: Evaluate this resume for ATS readiness and quality.
Assess: contact completeness, summary quality, skills coverage, quantified achievements,
action-verb usage, section completeness, and (if a job description is given) keyword alignment.
- strengths: what already works (short phrases).
- weaknesses: concrete problems holding the resume back.
- suggestions: prioritized, actionable fixes (no fabricated content).
- score: integer 0-100.

Return JSON exactly in this shape:
{"score":0,"strengths":[],"weaknesses":[],"suggestions":[]}`,
  };
}

export function coverLetterPrompt({ cvData, jobDescription, companyName, targetRole }) {
  const ctx = cvToContext(cvData);
  return {
    system: GROUND_RULES,
    user: `${ctx}

JOB DESCRIPTION:
"""${jobDescription || ""}"""

TASK: Write a professional cover letter${companyName ? ` for ${companyName}` : ""}${targetRole ? ` for the "${targetRole}" role` : ""}.
Requirements:
- 3 to 4 short paragraphs, confident but not exaggerated.
- Draw ONLY on the candidate's real experience, skills, and projects above.
- Connect the candidate's genuine strengths to the job's needs.
- Do not invent metrics, employers, or achievements.
- Professional business tone. No placeholder brackets like [Your Name] — use the real name if provided, otherwise omit the signature line.

Return ONLY the cover letter text.`,
  };
}
