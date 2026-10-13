/**
 * server/cvContext.js
 * Turns the app's cvData object into a compact, factual text block used to ground prompts.
 * This is what stops the model inventing employers, dates, degrees, or numbers: it can only
 * rephrase what is actually present here.
 */

function line(label, value) {
  return value ? `${label}: ${value}` : "";
}

export function cvToContext(cvData = {}) {
  const d = cvData.data || cvData || {};
  const p = d.personalInfo || {};
  const out = [];

  out.push("=== CANDIDATE FACTS (do not add anything not listed here) ===");
  out.push(line("Name", p.fullName));
  out.push(line("Current/target title", p.jobTitle));
  out.push(line("Location", p.location));

  if (d.summary) out.push(`\nExisting summary:\n${d.summary}`);

  if (Array.isArray(d.skills) && d.skills.length) {
    out.push("\nSkills:");
    d.skills.forEach((s) => {
      const items = (s.items || []).join(", ");
      if (s.category || items) out.push(`- ${s.category || "Skills"}: ${items}`);
    });
  }

  if (Array.isArray(d.experience) && d.experience.length) {
    out.push("\nExperience:");
    d.experience.forEach((e) => {
      const head = [e.role, e.company].filter(Boolean).join(" @ ");
      const when = [e.start, e.current ? "Present" : e.end].filter(Boolean).join(" - ");
      out.push(`- ${head}${when ? ` (${when})` : ""}`);
      (e.bullets || []).filter(Boolean).forEach((b) => out.push(`    • ${b}`));
    });
  }

  if (Array.isArray(d.projects) && d.projects.length) {
    out.push("\nProjects:");
    d.projects.forEach((pr) => {
      out.push(`- ${pr.name || "Project"}${pr.tech ? ` [${pr.tech}]` : ""}`);
      (pr.bullets || []).filter(Boolean).forEach((b) => out.push(`    • ${b}`));
    });
  }

  if (Array.isArray(d.education) && d.education.length) {
    out.push("\nEducation:");
    d.education.forEach((ed) => {
      out.push(`- ${[ed.degree, ed.school].filter(Boolean).join(", ")}`);
    });
  }

  if (Array.isArray(d.certifications) && d.certifications.length) {
    out.push("\nCertifications: " + d.certifications.map((c) => c.name).filter(Boolean).join(", "));
  }

  return out.filter(Boolean).join("\n");
}
