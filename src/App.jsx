import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Menu, X, Sun, Moon, FileText, Plus, Trash2, Download, Eye, EyeOff,
  GripVertical, ChevronUp, ChevronDown, ChevronRight, ArrowRight, Check,
  CheckCircle2, AlertTriangle, AlertCircle, XCircle, Sparkles, Search, Target,
  LayoutDashboard, Settings, LogOut, Copy, Star, Github, Linkedin, Globe, Mail,
  Phone, MapPin, Briefcase, GraduationCap, FolderGit2, Award, Languages as LangIcon,
  Heart, BadgeCheck, Wand2, Printer, Maximize2, Save, Lightbulb, Layers, Zap,
  ShieldCheck, PenLine, Quote, Pencil, RefreshCw, Loader2, FileSignature, Palette, Upload
} from "lucide-react";
import { supabase } from "./lib/supabase.js";

/* =========================================================================================
   Smart ATS CV Builder — single-file React application
   Architecture:
     - Pure engines:  computeAts(), analyzeJobMatch(), suggestion library
     - ResumeDocument: ATS-safe renderer with 5 template skins (selectable text, no tables/images)
     - Pages:          Landing / Auth / Dashboard / Builder / Templates / ATS / JobMatch / Settings
     - App shell:      view routing, theme+accent tokens (CSS vars), persistence via window.storage
   ========================================================================================= */

/* ----------------------------------- utilities ----------------------------------------- */
const uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); });
const cx = (...a) => a.filter(Boolean).join(" ");
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());
const isPhone = (v) => /[\d][\d\s()+\-.]{6,}/.test((v || "").trim());
const todayISO = () => new Date().toISOString();
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
const wordCount = (s) => (s || "").trim().split(/\s+/).filter(Boolean).length;

/* ----------------------------------- language data ------------------------------------- */
const STOPWORDS = new Set(("a an the and or but if then else for to of in on at by with from as is are was were be been being " +
  "this that these those you your we our they their it its will would should can could may might must shall do does did " +
  "have has had not no yes who whom which what when where why how all any both each few more most other some such only own " +
  "same so than too very s t just don now also etc into out up down over under again further once about above below between " +
  "i me my you he she him her us them work working experience role responsible responsibilities ability skills strong good " +
  "team teams using use used including include includes well across within plus per via able preferred required requirement " +
  "requirements years year company role position candidate candidates looking seeking join help build building").split(" "));

const SKILL_LEXICON = [
  "javascript", "typescript", "python", "java", "c++", "c#", "go", "golang", "rust", "php", "ruby", "kotlin", "swift",
  "react", "react native", "next.js", "nextjs", "vue", "angular", "svelte", "redux", "tailwind", "tailwind css", "html", "css",
  "sass", "node.js", "nodejs", "express", "nestjs", "fastapi", "django", "flask", "spring", "spring boot", "laravel", ".net",
  "rest", "rest api", "graphql", "grpc", "websocket", "microservices", "api", "apis",
  "sql", "mysql", "postgresql", "postgres", "mongodb", "redis", "sqlite", "supabase", "firebase", "elasticsearch",
  "aws", "azure", "gcp", "docker", "kubernetes", "k8s", "terraform", "ci/cd", "jenkins", "github actions", "nginx", "linux",
  "git", "github", "gitlab", "agile", "scrum", "jira", "testing", "jest", "cypress", "playwright", "unit testing", "tdd",
  "machine learning", "deep learning", "tensorflow", "pytorch", "pandas", "numpy", "data analysis", "nlp", "opencv",
  "embedded", "arduino", "raspberry pi", "verilog", "vhdl", "fpga", "matlab", "autocad", "solidworks", "simulink", "plc",
  "figma", "ui/ux", "accessibility", "responsive design", "seo", "performance", "websockets", "oauth", "jwt", "stripe"
];
const LEXICON_SET = new Set(SKILL_LEXICON);

const ACTION_VERBS = new Set(("developed built designed implemented engineered architected created led managed launched " +
  "optimized improved reduced increased automated delivered deployed integrated migrated refactored shipped scaled " +
  "spearheaded coordinated mentored analyzed researched maintained tested debugged streamlined established drove owned " +
  "founded redesigned modernized accelerated boosted resolved orchestrated").split(" "));

const SUGGESTIONS = {
  summary: [
    "Computer Engineer and full-stack developer with hands-on experience building responsive, production-grade web applications using React, Node.js, and modern cloud tooling.",
    "Detail-oriented software engineer focused on writing clean, maintainable code and delivering measurable improvements in performance, reliability, and user experience.",
    "Results-driven developer who turns complex requirements into scalable solutions, with a strong foundation in data structures, algorithms, and system design."
  ],
  experience: [
    "Developed and shipped a responsive web application using React and FastAPI, serving 5,000+ monthly active users.",
    "Implemented REST APIs to manage user data and core workflows, reducing average response time by 38%.",
    "Optimized database queries and added caching, cutting page load time from 4.1s to 1.3s.",
    "Led migration to a CI/CD pipeline with automated testing, reducing deployment failures by 60%.",
    "Collaborated with a 5-person agile team to deliver features across two-week sprints, consistently meeting deadlines."
  ],
  projects: [
    "Built a real-time dashboard with React, WebSockets, and Chart.js to visualize live metrics for 1,200+ devices.",
    "Designed and implemented a clean, responsive UI that improved task-completion rate by 27% in usability testing.",
    "Engineered a REST API with JWT authentication and role-based access control using Node.js and PostgreSQL.",
    "Created an automated ETL pipeline in Python that processed 2M+ records daily with 99.9% reliability."
  ]
};

/* ----------------------------------- templates ----------------------------------------- */
const TEMPLATES = [
  { id: "classic", name: "Classic ATS", blurb: "Timeless, plain-text-safe layout trusted by every parser.", font: "Georgia, 'Times New Roman', serif", align: "center", caps: true, accent: false, rule: "solid", nameSize: 26, tags: ["simple", "ats", "one-column"] },
  { id: "modern", name: "Modern Clean", blurb: "Crisp sans-serif with subtle accent headings.", font: "Arial, Helvetica, sans-serif", align: "left", caps: true, accent: true, rule: "accent", nameSize: 27, tags: ["modern", "ats", "one-column"] },
  { id: "developer", name: "Developer", blurb: "Engineered for tech roles — skills and stack up front.", font: "'Segoe UI', Arial, sans-serif", align: "left", caps: false, accent: true, rule: "thin", nameSize: 26, mono: true, tags: ["modern", "professional", "one-column"] },
  { id: "engineering", name: "Engineering", blurb: "Structured and conservative for technical disciplines.", font: "Calibri, 'Segoe UI', Arial, sans-serif", align: "left", caps: true, accent: false, rule: "double", nameSize: 25, tags: ["professional", "ats", "one-column"] },
  { id: "executive", name: "Executive", blurb: "Refined serif with elegant spacing for senior roles.", font: "Georgia, 'Times New Roman', serif", align: "left", caps: false, smallcaps: true, accent: true, rule: "thin", nameSize: 30, tags: ["professional", "simple", "one-column"] },
  { id: "sidebar", name: "Sidebar Pro", blurb: "Two-column layout with a striking dark sidebar for contact and skills.", font: "Arial, Helvetica, sans-serif", align: "left", caps: true, accent: true, rule: "accent", nameSize: 24, layout: "sidebar", photo: true, tags: ["modern", "with-photo", "professional"] },
  { id: "bold", name: "Bold Impact", blurb: "Eye-catching colored section bands and skill chips that pop.", font: "'Segoe UI', Arial, sans-serif", align: "left", caps: true, accent: true, rule: "none", nameSize: 28, layout: "single", tags: ["modern", "professional", "one-column"] },
  { id: "minimal", name: "Minimal", blurb: "Ultra-clean design with generous whitespace — content speaks for itself.", font: "'Helvetica Neue', Arial, sans-serif", align: "left", caps: false, accent: false, rule: "none", nameSize: 26, layout: "single", tags: ["simple", "one-column", "ats"] },
  { id: "timeline", name: "Timeline", blurb: "Accent timeline line connects your career story from top to bottom.", font: "'Segoe UI', Arial, sans-serif", align: "left", caps: true, accent: true, rule: "accent", nameSize: 26, layout: "single", tags: ["modern", "one-column"] },
  { id: "accentbar", name: "Accent Bar", blurb: "Bold colored banner header that makes your name unforgettable.", font: "Arial, Helvetica, sans-serif", align: "center", caps: true, accent: true, rule: "none", nameSize: 28, layout: "single", photo: true, tags: ["modern", "with-photo", "one-column"] },
  { id: "photo", name: "Photo Card", blurb: "Includes your profile photo — great for creative and client-facing roles.", font: "'Segoe UI', Arial, sans-serif", align: "left", caps: false, accent: true, rule: "thin", nameSize: 26, layout: "single", photo: true, tags: ["with-photo", "modern", "one-column"] },
  { id: "elegant", name: "Elegant", blurb: "Thin border frame with refined serif typography for a luxury feel.", font: "Georgia, 'Times New Roman', serif", align: "center", caps: false, smallcaps: true, accent: false, rule: "thin", nameSize: 28, layout: "single", tags: ["simple", "professional", "one-column"] },
  { id: "split", name: "Split View", blurb: "Two-column body — details on the left, experience on the right.", font: "Arial, Helvetica, sans-serif", align: "left", caps: true, accent: true, rule: "accent", nameSize: 25, layout: "split", tags: ["professional", "modern"] },
];

const CV_COLORS = [
  { hex: "#059669", label: "Emerald" },
  { hex: "#2563eb", label: "Blue" },
  { hex: "#7c3aed", label: "Purple" },
  { hex: "#dc2626", label: "Red" },
  { hex: "#ea580c", label: "Orange" },
  { hex: "#ca8a04", label: "Gold" },
  { hex: "#0891b2", label: "Teal" },
  { hex: "#4f46e5", label: "Indigo" },
  { hex: "#1f2937", label: "Charcoal" },
  { hex: "#be185d", label: "Pink" },
];

const CV_FONTS = [
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia" },
  { value: "Calibri, 'Segoe UI', sans-serif", label: "Calibri" },
  { value: "'Helvetica Neue', Arial, sans-serif", label: "Helvetica Neue" },
  { value: "'Segoe UI', Arial, sans-serif", label: "Segoe UI" },
  { value: "'SF Mono', Consolas, monospace", label: "Monospace" },
];

/* ----------------------------------- sections ------------------------------------------ */
const SECTION_META = {
  summary: { label: "Professional Summary", icon: PenLine },
  skills: { label: "Technical Skills", icon: Zap },
  experience: { label: "Work Experience", icon: Briefcase },
  projects: { label: "Projects", icon: FolderGit2 },
  education: { label: "Education", icon: GraduationCap },
  certifications: { label: "Certifications", icon: BadgeCheck },
  languages: { label: "Languages", icon: LangIcon },
  achievements: { label: "Awards & Achievements", icon: Award },
  volunteer: { label: "Volunteer Experience", icon: Heart },
  custom: { label: "Custom Sections", icon: Layers }
};
const DEFAULT_ORDER = ["summary", "skills", "experience", "projects", "education", "certifications", "languages", "achievements", "volunteer", "custom"];

/* ----------------------------------- sample data --------------------------------------- */
const sampleData = () => ({
  personalInfo: {
    fullName: "Ahmad Alzawahrah",
    jobTitle: "Computer Engineer · Full-Stack Web Developer",
    phone: "+962 79 123 4567",
    email: "ahmad.alzawahrah@email.com",
    location: "Amman, Jordan",
    linkedin: "linkedin.com/in/ahmadalzawahrah",
    github: "github.com/ahmadalzawahrah",
    portfolio: "ahmadalzawahrah.dev",
    photo: ""
  },
  summary: "Computer Engineer and full-stack developer with 3+ years building responsive, production-grade web applications using React, Node.js, and FastAPI. Passionate about clean architecture, measurable performance gains, and shipping accessible interfaces that users love.",
  skills: [
    { id: uid(), category: "Languages", items: ["JavaScript", "TypeScript", "Python", "C++", "SQL"] },
    { id: uid(), category: "Frontend", items: ["React", "Next.js", "Tailwind CSS", "Redux", "HTML5", "CSS3"] },
    { id: uid(), category: "Backend & Data", items: ["Node.js", "FastAPI", "Express", "PostgreSQL", "MongoDB", "REST", "GraphQL"] },
    { id: uid(), category: "DevOps & Tools", items: ["Docker", "AWS", "CI/CD", "Git", "Linux", "Jest"] }
  ],
  experience: [
    { id: uid(), role: "Full-Stack Developer", company: "Nimbus Labs", location: "Amman, JO", start: "2023", end: "Present", current: true, bullets: [
      "Developed and shipped a responsive web platform with React and FastAPI, serving 8,000+ monthly active users.",
      "Implemented REST APIs and JWT authentication, reducing average response time by 38%.",
      "Led the migration to a CI/CD pipeline with automated testing, cutting deployment failures by 60%."
    ] },
    { id: uid(), role: "Software Engineering Intern", company: "BrightByte", location: "Remote", start: "2022", end: "2023", current: false, bullets: [
      "Built reusable React components adopted across 4 internal products.",
      "Optimized PostgreSQL queries and added Redis caching, improving load time from 4.1s to 1.3s."
    ] }
  ],
  projects: [
    { id: uid(), name: "DevBoard", tech: "React · WebSockets · Chart.js", link: "github.com/omarkhalid/devboard", bullets: [
      "Built a real-time analytics dashboard visualizing live metrics for 1,200+ devices.",
      "Designed a clean, responsive UI that improved task completion by 27% in testing."
    ] },
    { id: uid(), name: "API Forge", tech: "Node.js · PostgreSQL · Docker", link: "github.com/omarkhalid/api-forge", bullets: [
      "Engineered a REST API with role-based access control and 95% test coverage."
    ] }
  ],
  education: [
    { id: uid(), degree: "B.Sc. in Computer Engineering", school: "Jordan University of Science & Technology", location: "Irbid, JO", start: "2018", end: "2022", details: "GPA 3.8/4.0 · Dean's List (4 semesters)" }
  ],
  certifications: [
    { id: uid(), name: "AWS Certified Cloud Practitioner", issuer: "Amazon Web Services", date: "2023" },
    { id: uid(), name: "Meta Front-End Developer", issuer: "Coursera", date: "2022" }
  ],
  languages: [
    { id: uid(), name: "Arabic", level: "Native" },
    { id: uid(), name: "English", level: "Fluent (C1)" }
  ],
  achievements: [
    { id: uid(), text: "1st place — National Collegiate Hackathon (2022), 60+ teams." },
    { id: uid(), text: "Open-source maintainer with 400+ GitHub stars across projects." }
  ],
  volunteer: [
    { id: uid(), role: "Coding Mentor", org: "Code for Jordan", period: "2021 – Present", description: "Mentor 20+ students in web development fundamentals and career prep." }
  ],
  customSections: []
});

const blankData = () => ({
  personalInfo: { fullName: "", jobTitle: "", phone: "", email: "", location: "", linkedin: "", github: "", portfolio: "", photo: "" },
  summary: "", skills: [], experience: [], projects: [], education: [],
  certifications: [], languages: [], achievements: [], volunteer: [], customSections: []
});

const newCv = (name, withSample = true) => ({
  id: uid(),
  name: name || "Untitled CV",
  template: "modern",
  created: todayISO(),
  lastEdited: todayISO(),
  exports: 0,
  config: { order: [...DEFAULT_ORDER], visible: Object.fromEntries(DEFAULT_ORDER.map((k) => [k, true])), accentColor: null, fontOverride: null, spacing: "normal" },
  data: withSample ? sampleData() : blankData()
});

/* ----------------------------------- ATS engine ---------------------------------------- */
function cvPlainText(d) {
  const parts = [];
  const p = d.personalInfo || {};
  parts.push(p.jobTitle, d.summary);
  (d.skills || []).forEach((s) => parts.push(s.category, (s.items || []).join(" ")));
  (d.experience || []).forEach((e) => parts.push(e.role, e.company, (e.bullets || []).join(" ")));
  (d.projects || []).forEach((pr) => parts.push(pr.name, pr.tech, (pr.bullets || []).join(" ")));
  (d.education || []).forEach((ed) => parts.push(ed.degree, ed.school, ed.details));
  (d.certifications || []).forEach((c) => parts.push(c.name, c.issuer));
  (d.achievements || []).forEach((a) => parts.push(a.text));
  (d.customSections || []).forEach((cs) => { parts.push(cs.title); (cs.items || []).forEach((it) => parts.push(it.text)); });
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function computeAts(cv, jobKeywords = []) {
  const d = cv.data;
  const p = d.personalInfo || {};
  let score = 0;
  const strengths = [], weaknesses = [], tips = [];
  const add = (n) => (score += n);

  // Contact completeness (24)
  if (isEmail(p.email)) { add(8); strengths.push("Valid email address included"); }
  else { weaknesses.push("Missing or invalid email address"); tips.push("Add a professional email so recruiters can reach you."); }
  if (isPhone(p.phone)) { add(6); strengths.push("Phone number present"); }
  else { weaknesses.push("Missing phone number"); tips.push("Add a phone number to your header."); }
  if ((p.location || "").trim()) add(4); else tips.push("Add your city/country — many ATS filters use location.");
  if ((p.linkedin || "").trim()) { add(4); strengths.push("LinkedIn profile linked"); }
  else { weaknesses.push("Missing LinkedIn URL"); tips.push("Include your LinkedIn — most recruiters expect it."); }
  if ((p.github || "").trim() || (p.portfolio || "").trim()) add(2);

  // Summary (12)
  const sw = wordCount(d.summary);
  if (sw > 0) { add(6); } else { weaknesses.push("Professional summary is missing"); tips.push("Write a 2–3 sentence summary highlighting your strengths."); }
  if (sw >= 30 && sw <= 90) { add(6); strengths.push("Summary is a strong, scannable length"); }
  else if (sw > 0 && sw < 30) { tips.push("Your summary is short — aim for 30–80 words."); }
  else if (sw > 90) { tips.push("Summary is long — tighten it to under ~80 words."); }

  // Skills (12)
  const allSkills = (d.skills || []).flatMap((s) => s.items || []);
  if (allSkills.length > 0) { add(8); } else { weaknesses.push("Skills section is empty"); tips.push("List concrete, keyword-rich technical skills."); }
  if (allSkills.length >= 8) { add(4); strengths.push("Rich, keyword-dense skills section"); }
  else if (allSkills.length > 0) tips.push("Add more relevant skills (aim for 8+ keywords).");

  // Experience (18)
  const exps = d.experience || [];
  const allExpBullets = exps.flatMap((e) => e.bullets || []).filter((b) => b.trim());
  if (exps.length > 0) { add(8); } else { weaknesses.push("No work experience listed"); tips.push("Add roles, internships, or freelance work."); }
  const measurable = allExpBullets.some((b) => /\d/.test(b) || /%/.test(b));
  if (measurable) { add(6); strengths.push("Includes measurable, quantified achievements"); }
  else if (allExpBullets.length) { weaknesses.push("No measurable achievements found"); tips.push("Quantify impact (%, $, time saved, users)."); }
  const verbStart = allExpBullets.filter((b) => ACTION_VERBS.has(b.trim().split(/\s+/)[0]?.toLowerCase())).length;
  if (allExpBullets.length && verbStart / allExpBullets.length >= 0.5) { add(4); strengths.push("Bullets lead with strong action verbs"); }
  else if (allExpBullets.length) tips.push("Start bullets with action verbs (Developed, Led, Optimized).");

  // Projects (12)
  const projs = d.projects || [];
  if (projs.length > 0) { add(8); } else { weaknesses.push("Projects section is missing"); tips.push("Add 1–3 projects — vital for students and developers."); }
  if (projs.some((pr) => (pr.bullets || []).some((b) => b.trim()))) add(4);

  // Education (8)
  if ((d.education || []).length > 0) add(8); else { weaknesses.push("Education is missing"); tips.push("Add your degree and institution."); }

  // Formatting (10) — long paragraphs / standard headings
  const longBullets = allExpBullets.filter((b) => wordCount(b) > 40).length;
  if (longBullets === 0) { add(6); strengths.push("Concise bullet points (parser-friendly)"); }
  else { weaknesses.push(`${longBullets} bullet point(s) are too long`); tips.push("Keep bullets under ~30 words; split long paragraphs."); }
  add(4); // standard section names are guaranteed by our templates
  strengths.push("Single-column, table-free layout (ATS-safe)");

  // Extras (4)
  let extras = 0;
  if ((d.certifications || []).length) extras += 2;
  if ((d.languages || []).length) extras += 1;
  if ((d.achievements || []).length) extras += 1;
  add(Math.min(4, extras));

  // Job keyword coverage (informational, capped adjustment)
  if (jobKeywords.length) {
    const text = cvPlainText(d);
    const missing = jobKeywords.filter((k) => !text.includes(k.toLowerCase()));
    if (missing.length) { weaknesses.push(`${missing.length} target job keyword(s) not found`); tips.push("Mirror key terms from the job description where truthful."); }
    else strengths.push("Covers the target job's key keywords");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, strengths, weaknesses, tips };
}

/* ----------------------------------- Job match engine ---------------------------------- */
function extractKeywords(text) {
  const lower = (text || "").toLowerCase();
  const found = new Map();
  // multi-word lexicon hits first
  SKILL_LEXICON.forEach((term) => {
    if (term.includes(" ") && lower.includes(term)) found.set(term, (found.get(term) || 0) + 3);
  });
  // single tokens
  const tokens = lower.replace(/[^a-z0-9+#.\s/]/g, " ").split(/\s+/).filter(Boolean);
  tokens.forEach((t) => {
    const w = t.replace(/^[.+#/]+|[.+#/]+$/g, "");
    if (w.length < 2 || STOPWORDS.has(w) || /^\d+$/.test(w)) return;
    const weight = LEXICON_SET.has(w) ? 3 : 1;
    found.set(w, (found.get(w) || 0) + weight);
  });
  return [...found.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 26)
    .map(([term]) => term);
}

function analyzeJobMatch(cv, jobText) {
  const keywords = extractKeywords(jobText);
  const text = cvPlainText(cv.data);
  const matched = keywords.filter((k) => text.includes(k));
  const missing = keywords.filter((k) => !text.includes(k));
  const pct = keywords.length ? Math.round((matched.length / keywords.length) * 100) : 0;
  return { keywords, matched, missing, pct };
}

/* =========================================================================================
   STYLES (CSS variables drive theming; Tailwind handles layout/spacing)
   ========================================================================================= */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap');

.sa-root{
  --bg:#f5f7f8; --surface:#ffffff; --surface-2:#eef1f3; --elevated:#ffffff;
  --fg:#0e1726; --muted:#51606f; --faint:#8a98a6; --border:#e4e9ed; --border-strong:#cfd7dd;
  --accent:#059669; --accent-2:#10b981; --accent-soft:rgba(16,185,129,.12); --accent-fg:#ffffff;
  --ring:rgba(16,185,129,.32); --danger:#e11d48; --warn:#d97706; --good:#059669;
  --good-soft:rgba(5,150,105,.12); --danger-soft:rgba(225,29,72,.10);
  --shadow:0 1px 2px rgba(14,23,38,.05), 0 14px 30px -18px rgba(14,23,38,.16);
  --shadow-lg:0 1px 2px rgba(14,23,38,.06), 0 30px 60px -28px rgba(14,23,38,.30);
  color-scheme:light;
}
.sa-root.dark{
  --bg:#0a0e13; --surface:#10151c; --surface-2:#151c24; --elevated:#19212b;
  --fg:#e8edf2; --muted:#9aa8b6; --faint:#5c6976; --border:#222b35; --border-strong:#2d3743;
  --accent-soft:rgba(16,185,129,.16); --ring:rgba(16,185,129,.4);
  --good-soft:rgba(5,150,105,.18); --danger-soft:rgba(225,29,72,.16);
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 18px 40px -22px rgba(0,0,0,.7);
  --shadow-lg:0 1px 2px rgba(0,0,0,.5), 0 36px 70px -30px rgba(0,0,0,.8);
  color-scheme:dark;
}
.sa-root[data-accent="blue"]{ --accent:#2563eb; --accent-2:#3b82f6; --accent-soft:rgba(59,130,246,.14); --ring:rgba(59,130,246,.36); --good:#2563eb; --good-soft:rgba(59,130,246,.14); }
.sa-root[data-accent="gold"]{ --accent:#b58a16; --accent-2:#d4af37; --accent-soft:rgba(212,175,55,.16); --ring:rgba(212,175,55,.4); --good:#b58a16; --good-soft:rgba(212,175,55,.16); }

.sa-root{ background:var(--bg); color:var(--fg); font-family:Inter,system-ui,sans-serif; min-height:100vh; }
.sa-root *{ box-sizing:border-box; }
.sa-root h1,.sa-root h2,.sa-root h3,.sa-root h4,.sa-display{ font-family:Manrope,Inter,sans-serif; letter-spacing:-.02em; }

.surface{ background:var(--surface); }
.surface-2{ background:var(--surface-2); }
.elevated{ background:var(--elevated); }
.text-fg{ color:var(--fg); }
.text-muted{ color:var(--muted); }
.text-faint{ color:var(--faint); }
.text-accent{ color:var(--accent); }
.bg-accent{ background:var(--accent); color:var(--accent-fg); }
.bg-accent-soft{ background:var(--accent-soft); }
.border-base{ border-color:var(--border); }
.border-strong{ border-color:var(--border-strong); }
.shadow-soft{ box-shadow:var(--shadow); }
.shadow-deep{ box-shadow:var(--shadow-lg); }
.divide-base > * + *{ border-top:1px solid var(--border); }

.sa-input{ width:100%; background:var(--surface); border:1px solid var(--border); color:var(--fg);
  border-radius:10px; padding:9px 12px; font-size:14px; outline:none; transition:border-color .15s, box-shadow .15s; }
.sa-input::placeholder{ color:var(--faint); }
.sa-input:focus{ border-color:var(--accent); box-shadow:0 0 0 3px var(--ring); }
.sa-input.invalid{ border-color:var(--danger); box-shadow:0 0 0 3px rgba(225,29,72,.18); }
textarea.sa-input{ resize:vertical; line-height:1.55; }

.btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; border-radius:10px;
  font-weight:600; font-size:14px; padding:9px 16px; cursor:pointer; transition:transform .08s, background .15s, border-color .15s, opacity .15s; border:1px solid transparent; white-space:nowrap; }
.btn:active{ transform:translateY(1px); }
.btn-primary{ background:var(--accent); color:var(--accent-fg); box-shadow:var(--shadow); }
.btn-primary:hover{ filter:brightness(1.06); }
.btn-ghost{ background:transparent; color:var(--fg); border-color:var(--border); }
.btn-ghost:hover{ background:var(--surface-2); }
.btn-subtle{ background:var(--surface-2); color:var(--fg); }
.btn-subtle:hover{ filter:brightness(.98); border-color:var(--border); }
.btn-danger{ background:transparent; color:var(--danger); border-color:transparent; }
.btn-danger:hover{ background:rgba(225,29,72,.1); }
.btn-sm{ padding:6px 11px; font-size:13px; border-radius:8px; }
.btn-icon{ padding:8px; border-radius:9px; }

.card{ background:var(--surface); border:1px solid var(--border); border-radius:16px; }
.chip{ display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:12.5px; font-weight:600;
  background:var(--surface-2); color:var(--muted); border:1px solid var(--border); }
.chip-accent{ background:var(--accent-soft); color:var(--accent); border-color:transparent; }

.sa-root ::-webkit-scrollbar{ width:10px; height:10px; }
.sa-root ::-webkit-scrollbar-thumb{ background:var(--border-strong); border-radius:8px; border:2px solid var(--bg); }

@keyframes fadeUp{ from{ opacity:0; transform:translateY(14px);} to{ opacity:1; transform:none; } }
@keyframes fadeIn{ from{ opacity:0;} to{ opacity:1; } }
@keyframes pop{ from{ opacity:0; transform:scale(.96);} to{ opacity:1; transform:scale(1);} }
.anim-up{ animation:fadeUp .5s cubic-bezier(.2,.7,.2,1) both; }
.anim-in{ animation:fadeIn .4s ease both; }
.anim-pop{ animation:pop .22s cubic-bezier(.2,.8,.2,1) both; }
@keyframes spin{ to{ transform:rotate(360deg); } }
.hover-rise{ transition:transform .18s ease, box-shadow .18s ease; }
.hover-rise:hover{ transform:translateY(-3px); box-shadow:var(--shadow-lg); }

.grid-bg{ background-image:radial-gradient(var(--border) 1px, transparent 1px); background-size:22px 22px; }
.glow{ position:absolute; border-radius:50%; filter:blur(80px); opacity:.5; pointer-events:none; }

.drag-over{ outline:2px dashed var(--accent); outline-offset:2px; border-radius:10px; }
.dragging{ opacity:.45; }

/* progress ring */
.ring-track{ stroke:var(--border); }
.ring-fill{ stroke:var(--accent); transition:stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1); }

/* ---------------- Resume document (theme-independent, print-ready) ---------------- */
.cv-doc{ background:#ffffff; color:#16202b; width:794px; min-height:1123px; padding:48px 54px; line-height:1.5; }
.cv-doc *{ box-sizing:border-box; }
.cv-name{ font-weight:700; line-height:1.1; margin:0; color:#0b1118; }
.cv-title{ color:#3a4654; font-size:14px; margin-top:4px; }
.cv-contact{ font-size:12.5px; color:#3a4654; margin-top:10px; display:flex; flex-wrap:wrap; gap:4px 14px; }
.cv-contact a{ color:inherit; text-decoration:none; }
.cv-section{ margin-top:18px; }
.cv-h{ font-weight:700; font-size:13px; color:#0b1118; margin:0 0 8px; }
.cv-h.caps{ text-transform:uppercase; letter-spacing:.08em; }
.cv-h.smallcaps{ font-variant:small-caps; letter-spacing:.04em; font-size:15px; }
.cv-rule-solid{ border-bottom:1.5px solid #1f2a36; padding-bottom:3px; }
.cv-rule-thin{ border-bottom:1px solid #c7d0d8; padding-bottom:3px; }
.cv-rule-double{ border-bottom:3px double #1f2a36; padding-bottom:3px; }
.cv-rule-accent{ border-bottom:2px solid var(--cv-accent,#059669); padding-bottom:3px; color:var(--cv-accent,#059669); }
.cv-row{ display:flex; justify-content:space-between; gap:14px; }
.cv-strong{ font-weight:700; color:#16202b; font-size:13.5px; }
.cv-sub{ color:#3a4654; font-size:12.5px; }
.cv-meta{ color:#566270; font-size:12px; white-space:nowrap; }
.cv-ul{ margin:5px 0 0; padding-left:18px; }
.cv-ul li{ font-size:12.7px; color:#26313d; margin-bottom:3px; }
.cv-p{ font-size:12.8px; color:#26313d; margin:0; }
.cv-tags{ font-size:12.7px; color:#26313d; }
.cv-mono{ font-family:'SF Mono',Consolas,Menlo,monospace; font-size:12px; }

/* nav sidebar */
.nav-item{ display:flex; align-items:center; gap:10px; width:100%; padding:9px 12px; border-radius:10px; font-size:13.5px; font-weight:500; color:var(--text-2); background:none; border:none; cursor:pointer; transition:all .15s; text-align:left; }
.nav-item:hover{ background:var(--soft); color:var(--fg); }
.nav-active{ background:var(--accent-soft) !important; color:var(--accent) !important; font-weight:600; }

/* ========== TEMPLATE-SPECIFIC STYLES — each must look COMPLETELY different ========== */

/* CLASSIC: centered, conservative, solid lines */
.cv-tpl-classic .cv-header{ text-align:center !important; padding-bottom:14px; border-bottom:2px solid #2d3748; margin-bottom:14px; }
.cv-tpl-classic .cv-contact{ justify-content:center !important; }
.cv-tpl-classic .cv-h{ border-bottom:1.5px solid #2d3748; padding-bottom:4px; }

/* MODERN: left accent bar on header, accent-colored headings */
.cv-tpl-modern .cv-header{ border-left:4px solid var(--cv-accent,#059669); padding-left:18px; }
.cv-tpl-modern .cv-h{ color:var(--cv-accent,#059669) !important; border-bottom:1px solid #e2e8f0; padding-bottom:3px; }

/* DEVELOPER: dark header block, monospace headings, code vibe */
.cv-tpl-developer .cv-header{ background:#0f172a !important; color:#e2e8f0 !important; padding:22px !important; border-radius:6px; margin:-4px -4px 14px; }
.cv-tpl-developer .cv-header .cv-name{ color:#f8fafc !important; }
.cv-tpl-developer .cv-header .cv-title{ color:#64748b !important; font-family:'SF Mono',Consolas,monospace; }
.cv-tpl-developer .cv-header .cv-contact{ color:#94a3b8 !important; }
.cv-tpl-developer .cv-h{ font-family:'SF Mono',Consolas,monospace !important; font-size:12px; letter-spacing:.08em; color:var(--cv-accent,#059669) !important; border-bottom:2px dashed var(--cv-accent,#059669); padding-bottom:3px; }

/* ENGINEERING: structured, double border header, left-line sections */
.cv-tpl-engineering .cv-header{ padding-bottom:12px; border-bottom:3px double #1e293b; }
.cv-tpl-engineering .cv-section{ padding-left:14px; border-left:3px solid #cbd5e1; margin-left:4px; }
.cv-tpl-engineering .cv-h{ background:#f1f5f9; padding:4px 10px; border-left:3px solid var(--cv-accent,#059669); font-size:12px; }

/* EXECUTIVE: elegant, large spacing, centered, thin rule */
.cv-tpl-executive .cv-header{ text-align:center !important; margin-bottom:16px; }
.cv-tpl-executive .cv-contact{ justify-content:center !important; }
.cv-tpl-executive .cv-name{ font-size:32px !important; letter-spacing:.04em; font-weight:300; }
.cv-tpl-executive .cv-section{ margin-top:24px; }
.cv-tpl-executive .cv-h{ font-variant:small-caps; letter-spacing:.1em; font-size:15px; border-bottom:1px solid #c8cdd4; padding-bottom:4px; }

/* SIDEBAR: two-column, colored sidebar, white text */
.cv-sidebar-wrap{ display:flex; gap:0; min-height:100%; }
.cv-sidebar{ width:218px; color:#d9e4ee; padding:28px 18px; flex-shrink:0; }
.cv-sidebar .cv-name{ color:#ffffff !important; }
.cv-sidebar .cv-title{ color:rgba(255,255,255,.7); font-size:13px; }
.cv-sidebar .cv-contact{ flex-direction:column; gap:6px; color:rgba(255,255,255,.75); font-size:12px; margin-top:14px; }
.cv-sidebar .cv-h{ color:#fff !important; border-bottom-color:rgba(255,255,255,.2) !important; font-size:12px; }
.cv-sidebar .cv-ul li,.cv-sidebar .cv-tags,.cv-sidebar .cv-p,.cv-sidebar .cv-sub{ color:rgba(255,255,255,.8); }
.cv-sidebar .cv-strong{ color:#fff; }
.cv-main{ flex:1; padding:28px 26px; }

/* BOLD: colored heading BANDS, thick accent border */
.cv-tpl-bold .cv-header{ border-bottom:4px solid var(--cv-accent,#059669); padding-bottom:16px; margin-bottom:10px; }
.cv-tpl-bold .cv-name{ font-weight:900 !important; }
.cv-tpl-bold .cv-h{ background:var(--cv-accent,#059669) !important; color:#fff !important; padding:6px 16px !important; border-radius:4px !important; border:none !important; display:inline-block; font-size:12px !important; letter-spacing:.07em; margin-bottom:10px; text-transform:uppercase; }
.cv-tpl-bold .cv-section{ margin-top:18px; }

/* MINIMAL: ultra-clean, no rules, tiny gray labels */
.cv-tpl-minimal .cv-h{ font-weight:400 !important; font-size:10px !important; letter-spacing:.16em !important; text-transform:uppercase !important; color:#9ca3af !important; border:none !important; padding:0 !important; margin-bottom:10px; }
.cv-tpl-minimal .cv-section{ margin-top:26px; }
.cv-tpl-minimal .cv-name{ font-weight:300 !important; letter-spacing:.04em; }
.cv-tpl-minimal .cv-title{ font-size:12px; color:#6b7280; }
.cv-tpl-minimal .cv-header{ border-bottom:none !important; }

/* TIMELINE: colored vertical line + dots */
.cv-tpl-timeline .cv-section{ padding-left:22px !important; border-left:3px solid var(--cv-accent,#059669) !important; position:relative; margin-left:6px; }
.cv-tpl-timeline .cv-section::before{ content:''; position:absolute; left:-7px; top:0; width:12px; height:12px; border-radius:50%; background:var(--cv-accent,#059669); }
.cv-tpl-timeline .cv-h{ color:var(--cv-accent,#059669) !important; border:none !important; font-weight:800; font-size:13px; }
.cv-tpl-timeline .cv-header{ padding-left:22px; border-left:3px solid var(--cv-accent,#059669); margin-left:6px; }

/* ACCENT BAR: big colored banner at top */
.cv-tpl-accentbar .cv-header{ background:var(--cv-accent,#059669) !important; color:#fff !important; padding:26px 28px !important; margin:-28px -28px 20px !important; text-align:center !important; }
.cv-tpl-accentbar .cv-header .cv-name{ color:#fff !important; font-weight:800; text-transform:uppercase; letter-spacing:.03em; }
.cv-tpl-accentbar .cv-header .cv-title{ color:rgba(255,255,255,.85) !important; }
.cv-tpl-accentbar .cv-header .cv-contact{ color:rgba(255,255,255,.75) !important; justify-content:center !important; }
.cv-tpl-accentbar .cv-h{ color:var(--cv-accent,#059669) !important; border-bottom:2px solid var(--cv-accent,#059669); padding-bottom:3px; font-weight:700; }

/* PHOTO CARD: photo circle with name beside it */
.cv-photo-circle{ width:150px; height:150px; border-radius:50%; object-fit:cover; border:3px solid var(--cv-accent,#059669); flex-shrink:0; }
.cv-photo-placeholder{ width:150px; height:150px; border-radius:50%; flex-shrink:0; border:2.5px dashed #b0bec5; background:#e8ecf1 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='38' r='16' fill='%2394a3b8'/%3E%3Cellipse cx='50' cy='78' rx='28' ry='20' fill='%2394a3b8'/%3E%3C/svg%3E") center/60% no-repeat; }
.cv-tpl-photo .cv-h{ color:var(--cv-accent,#059669) !important; border-bottom:1.5px solid var(--cv-accent,#059669); padding-bottom:3px; }

/* ELEGANT: thin border frame, centered, small-caps */
.cv-tpl-elegant{ border:1.5px solid #b4bcc6 !important; padding:34px !important; }
.cv-tpl-elegant .cv-header{ text-align:center !important; margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid #d1d5db; }
.cv-tpl-elegant .cv-contact{ justify-content:center !important; }
.cv-tpl-elegant .cv-name{ font-weight:300 !important; letter-spacing:.05em; }
.cv-tpl-elegant .cv-h{ font-variant:small-caps !important; letter-spacing:.1em; font-size:14px !important; color:#4a5568 !important; border:none !important; }
.cv-tpl-elegant .cv-section{ margin-top:22px; }

/* SPLIT: two-column body */
.cv-split-wrap{ display:flex; gap:24px; }
.cv-split-left{ width:210px; flex-shrink:0; }
.cv-split-right{ flex:1; min-width:0; }

/* --- spacing variants --- */
.cv-spacing-compact .cv-section{ margin-top:8px; }
.cv-spacing-compact .cv-p,.cv-spacing-compact .cv-ul{ font-size:12px; line-height:1.45; }
.cv-spacing-spacious .cv-section{ margin-top:24px; }
.cv-spacing-spacious .cv-p,.cv-spacing-spacious .cv-ul{ line-height:1.75; }

/* --- CV accent color override --- */
.cv-doc{ --cv-accent:#059669; }

/* --- color palette in builder --- */
.color-swatch{ width:28px; height:28px; border-radius:50%; cursor:pointer; border:2px solid transparent; transition:all .15s; }
.color-swatch:hover{ transform:scale(1.15); }
.color-swatch.active{ border-color:var(--fg); outline:2px solid var(--accent-soft); outline-offset:1px; }

/* --- enhanced animations --- */
.card{ transition:transform .2s ease, box-shadow .2s ease; }
.btn:hover{ filter:brightness(1.06); }
.btn:active{ transform:scale(.97); }
@keyframes slideIn{ from{ transform:translateX(-100%); opacity:0; } to{ transform:translateX(0); opacity:1; } }
.anim-side{ animation:slideIn .28s cubic-bezier(.22,.68,.36,1) both; }
@keyframes scaleIn{ from{ opacity:0; transform:scale(.92); } to{ opacity:1; transform:scale(1); } }
.anim-scale{ animation:scaleIn .3s cubic-bezier(.2,.8,.2,1) both; }

/* --- Builder: sticky live-preview column (desktop md+ only) ---
   The sticky wrapper sits inside the right column. It sticks just below the
   builder top bar (offset measured in JS via --preview-top-offset), is capped
   to the remaining viewport height, and scrolls internally when the A4
   document is taller than that. Below md the two-column grid stacks and the
   preview is shown/hidden via tabs, so sticky is disabled (position:static). */
.builder-preview-sticky{ position:static; }
@media(min-width:768px){
  .builder-preview-sticky{
    position:sticky;
    top:var(--preview-top-offset, 56px);
    max-height:calc(100vh - var(--preview-top-offset, 56px) - 16px);
    overflow-y:auto;
  }
}

/* ========== MOBILE RESPONSIVE ========== */
@media(max-width:640px){
  /* Landing hero CV preview */
  .sa-root .hero-preview{ max-width:260px !important; margin:0 auto; }
  
  /* Landing template preview cards — constrain height */
  .sa-root .card.hover-rise [style*="width: 794"]{ transform-origin:top left; }
  
  /* Template page cards */
  .sa-root .card [style*="height: 260"]{ height:180px !important; }

  /* Dashboard stats — 2 cols on mobile */
  .sa-root .grid-cols-2{ grid-template-columns:repeat(2,1fr) !important; }
  
  /* Sidebar layout CV — stack on mobile in preview */
  .cv-sidebar-wrap{ flex-direction:column; }
  .cv-sidebar{ width:100% !important; padding:20px 16px !important; }
  .cv-main{ padding:20px 16px !important; }
  
  /* Split layout CV — stack on mobile */
  .cv-split-wrap{ flex-direction:column; }
  .cv-split-left{ width:100% !important; }
  
  /* Builder top bar */
  .sa-root header select{ max-width:120px !important; font-size:12px !important; }

  /* Filter tabs scroll horizontally */
  .sa-root .flex.flex-wrap.justify-center.gap-2{ flex-wrap:nowrap; overflow-x:auto; justify-content:flex-start; padding-bottom:8px; -webkit-overflow-scrolling:touch; }
  .sa-root .flex.flex-wrap.justify-center.gap-2::-webkit-scrollbar{ display:none; }
  
  /* General spacing */
  .sa-root main{ padding-left:12px !important; padding-right:12px !important; }
}

@media(max-width:480px){
  .sa-root .hero-preview{ max-width:220px !important; }
}

/* ---------------- print ---------------- */
.print-only{ display:none; }
@media print{
  body{ background:#fff !important; }
  .screen-only{ display:none !important; }
  .print-only{ display:block !important; }
  .cv-doc{ width:100%; min-height:auto; padding:42px 48px; box-shadow:none; }
  @page{ size:A4; margin:0; }
}
`;

/* ============================ AI LAYER (frontend → backend → provider) ============================
   These helpers call our OWN backend routes (/api/*). No API key ever lives in this file or the
   browser bundle — the secret stays in backend env vars (see /ai-layer). When the backend isn't
   deployed/configured, AI calls fail gracefully and the built-in offline engines remain fully
   usable, so nothing breaks. Override the base URL via window.__AI_API_BASE__ if the API is on
   another origin. */
const AI_BASE = (typeof window !== "undefined" && window.__AI_API_BASE__) || "/api";
async function aiFetch(path, body) {
  let res;
  try {
    res = await fetch(`${AI_BASE}/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}),
    });
  } catch {
    throw new Error("AI backend not reachable. Deploy the API routes and set AI_API_KEY to enable AI features.");
  }
  let data = null; try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) throw new Error(data?.error || "AI service is currently unavailable. Please try again later.");
  return data;
}
const aiImproveSummary = (b) => aiFetch("improve-summary", b);
const aiImproveBullets = (b) => aiFetch("improve-bullets", b);
const aiAnalyzeJob = (b) => aiFetch("analyze-job-description", b);
const aiCoverLetter = (b) => aiFetch("generate-cover-letter", b);
const aiGenerateBullets = (b) => aiFetch("generate-bullets", b);

function useAiAction(fn) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const run = useCallback(async (args) => {
    setLoading(true); setError(""); setData(null);
    try { const r = await fn(args); setData(r); return r; }
    catch (e) { setError(e.message || "Something went wrong."); return null; }
    finally { setLoading(false); }
  }, [fn]);
  const reset = useCallback(() => { setError(""); setData(null); setLoading(false); }, []);
  return { run, loading, error, data, reset };
}

/* Accept/reject panel — NEVER auto-applies. User must click Apply to replace content. */
function AiSuggestionBox({ loading, error, onRetry, children, onApply, onReject, applyLabel = "Apply", title = "AI suggestion — review before applying" }) {
  if (loading) return (
    <div className="card p-3 flex items-center gap-2 text-[13px] text-muted anim-in" style={{ background: "var(--accent-soft)" }}>
      <Loader2 size={16} className="text-accent" style={{ animation: "spin 1s linear infinite" }} /> Generating with AI…
    </div>
  );
  if (error) return (
    <div className="card p-3 flex items-start gap-2 text-[13px] anim-in" style={{ color: "var(--danger)" }}>
      <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{error} {onRetry && <button className="underline font-semibold" onClick={onRetry}>Retry</button>}</span>
    </div>
  );
  if (!children) return null;
  return (
    <div className="card p-3 anim-pop" style={{ background: "var(--accent-soft)", borderColor: "var(--accent)" }}>
      <div className="flex items-center gap-1.5 text-[12px] font-bold text-accent mb-2"><Sparkles size={14} /> {title}</div>
      <div className="text-[13px] text-fg leading-relaxed">{children}</div>
      <div className="flex flex-wrap gap-2 mt-3">
        <Button variant="primary" size="sm" onClick={onApply}><Check size={14} /> {applyLabel}</Button>
        <Button variant="ghost" size="sm" onClick={onReject}><X size={14} /> Discard</Button>
        {onRetry && <Button variant="ghost" size="sm" onClick={onRetry}><RefreshCw size={14} /> Regenerate</Button>}
      </div>
    </div>
  );
}

const DEFAULT_AI_OPTS = { length: "medium", tone: "formal", custom: "" };

function AiOptions({ opts, setOpts }) {
  return (
    <div className="card p-3 space-y-2.5 anim-in" style={{ background: "var(--surface)" }}>
      <div className="flex flex-wrap gap-3">
        <div>
          <div className="text-[11px] font-bold text-faint mb-1.5">Length</div>
          <div className="flex gap-1">
            {[["short","Short"],["medium","Medium"],["detailed","Detailed"]].map(([v,l])=>(
              <button key={v} onClick={()=>setOpts(o=>({...o,length:v}))} className={cx("chip cursor-pointer transition-all", opts.length===v ? "bg-accent" : "bg-soft")} style={opts.length===v?{color:"var(--accent-fg)"}:{}}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold text-faint mb-1.5">Tone</div>
          <div className="flex gap-1">
            {[["formal","Formal"],["technical","Technical"],["creative","Creative"]].map(([v,l])=>(
              <button key={v} onClick={()=>setOpts(o=>({...o,tone:v}))} className={cx("chip cursor-pointer transition-all", opts.tone===v ? "bg-accent" : "bg-soft")} style={opts.tone===v?{color:"var(--accent-fg)"}:{}}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      <Textarea rows={2} value={opts.custom} onChange={(e)=>setOpts(o=>({...o,custom:e.target.value}))} placeholder="Custom instructions (e.g. focus on AI/ML, keep it shorter…)" />
    </div>
  );
}

/* ============================ UI PRIMITIVES ============================ */
function Button({ variant = "primary", size, className, children, ...rest }) {
  return (
    <button className={cx("btn", `btn-${variant}`, size === "sm" && "btn-sm", className)} {...rest}>
      {children}
    </button>
  );
}
function IconButton({ className, title, children, ...rest }) {
  return <button title={title} aria-label={title} className={cx("btn btn-ghost btn-icon", className)} {...rest}>{children}</button>;
}
function Field({ label, hint, error, required, children }) {
  return (
    <label className="block">
      {label && <span className="flex items-center gap-1 text-[13px] font-semibold text-fg mb-1.5">{label}{required && <span className="text-accent">*</span>}</span>}
      {children}
      {error ? <span className="block text-[12px] mt-1" style={{ color: "var(--danger)" }}>{error}</span>
        : hint ? <span className="block text-[12px] text-faint mt-1">{hint}</span> : null}
    </label>
  );
}
function Input({ invalid, ...p }) { return <input className={cx("sa-input", invalid && "invalid")} {...p} />; }
function Textarea({ invalid, ...p }) { return <textarea className={cx("sa-input", invalid && "invalid")} {...p} />; }

function Modal({ open, onClose, title, children, max = 560 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-in" style={{ background: "rgba(8,12,18,.55)", backdropFilter: "blur(4px)" }} onMouseDown={onClose}>
      <div className="card shadow-deep w-full anim-scale" style={{ maxWidth: max }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-base">
          <h3 className="text-[16px] font-bold text-fg">{title}</h3>
          <IconButton title="Close" onClick={onClose}><X size={18} /></IconButton>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ProgressRing({ value, size = 132, stroke = 11, label = "ATS Score" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  const tone = value >= 75 ? "var(--good)" : value >= 50 ? "var(--warn)" : "var(--danger)";
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke={tone} strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-[30px] font-extrabold text-fg leading-none sa-display">{value}</div>
        <div className="text-[11px] text-faint mt-1 font-semibold tracking-wide">{label}</div>
      </div>
    </div>
  );
}

/* ============================ RESUME DOCUMENT (ATS-safe) ============================ */
const ACCENT_HEX = { emerald: "#059669", blue: "#2563eb", gold: "#b58a16" };

function ResumeDocument({ cv, accent = "emerald", forwardRef }) {
  const t = TEMPLATES.find((x) => x.id === cv.template) || TEMPLATES[1];
  const d = cv.data;
  const p = d.personalInfo || {};
  const order = cv.config?.order || DEFAULT_ORDER;
  const vis = cv.config?.visible || {};
  const cvAccent = cv.config?.accentColor || ACCENT_HEX[accent] || "#059669";
  const cvFont = cv.config?.fontOverride || t.font;
  const spacing = cv.config?.spacing || "normal";
  const ruleClass = { solid: "cv-rule-solid", thin: "cv-rule-thin", double: "cv-rule-double", accent: "cv-rule-accent" }[t.rule];
  const hClass = cx("cv-h", t.caps && "caps", t.smallcaps && "smallcaps", ruleClass);
  const Heading = ({ children }) => <div className={hClass} style={t.rule === "accent" ? { color: cvAccent } : undefined}>{children}</div>;
  const photoUrl = p.photo ? p.photo : null;
  const showPhoto = t.photo; // template supports photos
  const PhotoEl = photoUrl
    ? ({style}) => <img src={photoUrl} alt="" className="cv-photo-circle" style={style} />
    : ({style}) => <div className="cv-photo-placeholder" style={style} />;

  const contacts = [
    p.email && { t: p.email }, p.phone && { t: p.phone }, p.location && { t: p.location },
    p.linkedin && { t: p.linkedin }, p.github && { t: p.github }, p.portfolio && { t: p.portfolio },
  ].filter(Boolean);

  const Section = ({ k, children, has }) => {
    if (vis[k] === false || !has) return null;
    return <div className="cv-section"><Heading>{SECTION_META[k].label}</Heading>{children}</div>;
  };

  const renderers = {
    summary: () => <Section k="summary" has={!!(d.summary || "").trim()}><p className="cv-p">{d.summary}</p></Section>,
    skills: () => <Section k="skills" has={(d.skills || []).some((s) => (s.items || []).length)}>
      {(d.skills || []).map((s) => (s.items || []).length ? (
        <div key={s.id} className="cv-tags" style={{ marginBottom: 4 }}>
          <span className="cv-strong" style={{ fontSize: 12.7 }}>{s.category}: </span>
          <span className={t.mono ? "cv-mono" : ""}>{(s.items || []).join(t.mono ? "  ·  " : ", ")}</span>
        </div>
      ) : null)}
    </Section>,
    experience: () => <Section k="experience" has={(d.experience || []).length}>
      {(d.experience || []).map((e) => (
        <div key={e.id} style={{ marginBottom: 10 }}>
          <div className="cv-row"><span className="cv-strong">{e.role}{e.company ? ` — ${e.company}` : ""}</span>
            <span className="cv-meta">{[e.start, e.current ? "Present" : e.end].filter(Boolean).join(" – ")}</span></div>
          {e.location && <div className="cv-sub">{e.location}</div>}
          <ul className="cv-ul">{(e.bullets || []).filter((b) => b.trim()).map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
      ))}
    </Section>,
    projects: () => <Section k="projects" has={(d.projects || []).length}>
      {(d.projects || []).map((pr) => (
        <div key={pr.id} style={{ marginBottom: 9 }}>
          <div className="cv-row">
            <span className="cv-strong">{pr.name}{pr.tech ? <span className="cv-sub" style={{ fontWeight: 400 }}>{` · ${pr.tech}`}</span> : null}</span>
            {pr.link && <span className="cv-meta">{pr.link}</span>}
          </div>
          <ul className="cv-ul">{(pr.bullets || []).filter((b) => b.trim()).map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
      ))}
    </Section>,
    education: () => <Section k="education" has={(d.education || []).length}>
      {(d.education || []).map((e) => (
        <div key={e.id} style={{ marginBottom: 7 }}>
          <div className="cv-row"><span className="cv-strong">{e.degree}</span><span className="cv-meta">{[e.start, e.end].filter(Boolean).join(" – ")}</span></div>
          <div className="cv-sub">{[e.school, e.location].filter(Boolean).join(" · ")}</div>
          {e.details && <div className="cv-sub">{e.details}</div>}
        </div>
      ))}
    </Section>,
    certifications: () => <Section k="certifications" has={(d.certifications || []).length}>
      <ul className="cv-ul" style={{ listStyle: "none", paddingLeft: 0 }}>
        {(d.certifications || []).map((c) => <li key={c.id}><span className="cv-strong" style={{ fontSize: 12.7 }}>{c.name}</span><span className="cv-sub">{[c.issuer, c.date].filter(Boolean).length ? ` — ${[c.issuer, c.date].filter(Boolean).join(", ")}` : ""}</span></li>)}
      </ul>
    </Section>,
    languages: () => <Section k="languages" has={(d.languages || []).length}>
      <div className="cv-tags">{(d.languages || []).map((l) => `${l.name}${l.level ? ` (${l.level})` : ""}`).join("  ·  ")}</div>
    </Section>,
    achievements: () => <Section k="achievements" has={(d.achievements || []).length}>
      <ul className="cv-ul">{(d.achievements || []).map((a) => <li key={a.id}>{a.text}</li>)}</ul>
    </Section>,
    volunteer: () => <Section k="volunteer" has={(d.volunteer || []).length}>
      {(d.volunteer || []).map((v) => (
        <div key={v.id} style={{ marginBottom: 6 }}>
          <div className="cv-row"><span className="cv-strong">{v.role}{v.org ? ` — ${v.org}` : ""}</span><span className="cv-meta">{v.period}</span></div>
          {v.description && <div className="cv-sub">{v.description}</div>}
        </div>
      ))}
    </Section>,
    custom: () => (d.customSections || []).map((cs) => (
      (vis.custom === false || !(cs.items || []).length) ? null : (
        <div className="cv-section" key={cs.id}><Heading>{cs.title || "Section"}</Heading>
          <ul className="cv-ul">{(cs.items || []).map((it) => <li key={it.id}>{it.text}</li>)}</ul>
        </div>
      )
    )),
  };

  const sidebarKeys = new Set(["skills", "languages", "certifications", "achievements"]);
  const mainKeys = order.filter((k) => !sidebarKeys.has(k));
  const sideKeys = order.filter((k) => sidebarKeys.has(k));
  const docStyle = { fontFamily: cvFont, "--cv-accent": cvAccent };
  const spacingCls = spacing !== "normal" ? `cv-spacing-${spacing}` : "";

  if (t.layout === "sidebar") {
    return (
      <div ref={forwardRef} className={cx("cv-doc", `cv-tpl-${t.id}`, spacingCls)} style={{ ...docStyle, padding: 0, overflow: "hidden" }}>
        <div className="cv-sidebar-wrap">
          <div className="cv-sidebar" style={{ background: cvAccent }}>
            {showPhoto && <PhotoEl style={{ borderColor: "rgba(255,255,255,.4)", width: 150, height: 150, marginBottom: 12 }} />}
            <h1 className="cv-name" style={{ fontSize: t.nameSize, fontFamily: cvFont }}>{p.fullName || "Your Name"}</h1>
            {p.jobTitle && <div className="cv-title">{p.jobTitle}</div>}
            <div className="cv-contact">
              {contacts.map((c, i) => <div key={i}>{c.t}</div>)}
            </div>
            {sideKeys.map((k) => <React.Fragment key={k}>{renderers[k] ? renderers[k]() : null}</React.Fragment>)}
          </div>
          <div className="cv-main">
            {mainKeys.map((k) => <React.Fragment key={k}>{renderers[k] ? renderers[k]() : null}</React.Fragment>)}
          </div>
        </div>
      </div>
    );
  }

  if (t.layout === "split") {
    const splitLeft = ["summary", "skills", "languages", "certifications", "achievements"];
    const splitRight = order.filter((k) => !splitLeft.includes(k));
    const splitL = order.filter((k) => splitLeft.includes(k));
    return (
      <div ref={forwardRef} className={cx("cv-doc", `cv-tpl-${t.id}`, spacingCls)} style={docStyle}>
        <div className="cv-header" style={{ textAlign: t.align }}>
          {showPhoto && <PhotoEl style={{ borderColor: cvAccent, marginBottom: 8 }} />}
          <h1 className="cv-name" style={{ fontSize: t.nameSize, fontFamily: cvFont }}>{p.fullName || "Your Name"}</h1>
          {p.jobTitle && <div className="cv-title">{p.jobTitle}</div>}
          <div className="cv-contact" style={{ justifyContent: t.align === "center" ? "center" : "flex-start" }}>
            {contacts.map((c, i) => <span key={i}>{c.t}{i < contacts.length - 1 ? <span style={{ opacity: .5 }}>{"  ·"}</span> : null}</span>)}
          </div>
        </div>
        <div className="cv-split-wrap">
          <div className="cv-split-left">
            {splitL.map((k) => <React.Fragment key={k}>{renderers[k] ? renderers[k]() : null}</React.Fragment>)}
          </div>
          <div className="cv-split-right">
            {splitRight.map((k) => <React.Fragment key={k}>{renderers[k] ? renderers[k]() : null}</React.Fragment>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={forwardRef} className={cx("cv-doc", `cv-tpl-${t.id}`, spacingCls)} style={docStyle}>
      <div className="cv-header" style={{ textAlign: t.align }}>
        {showPhoto && t.photo && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
            <PhotoEl style={{ borderColor: cvAccent }} />
            <div>
              <h1 className="cv-name" style={{ fontSize: t.nameSize, fontFamily: cvFont, letterSpacing: t.caps ? ".02em" : "0" }}>{p.fullName || "Your Name"}</h1>
              {p.jobTitle && <div className="cv-title">{p.jobTitle}</div>}
            </div>
          </div>
        )}
        {!(showPhoto && t.photo) && (
          <>
            <h1 className="cv-name" style={{ fontSize: t.nameSize, fontFamily: cvFont, letterSpacing: t.caps ? ".02em" : "0" }}>
              {p.fullName || "Your Name"}
            </h1>
            {p.jobTitle && <div className="cv-title">{p.jobTitle}</div>}
          </>
        )}
        <div className="cv-contact" style={{ justifyContent: t.align === "center" ? "center" : "flex-start" }}>
          {contacts.map((c, i) => <span key={i}>{c.t}{i < contacts.length - 1 ? <span style={{ opacity: .5 }}>{"  ·"}</span> : null}</span>)}
        </div>
      </div>
      {order.map((k) => <React.Fragment key={k}>{renderers[k] ? renderers[k]() : null}</React.Fragment>)}
    </div>
  );
}

/* Scales the fixed-width A4 document to fit any container width */
function ScaledDoc({ cv, accent }) {
  const wrap = useRef(null), inner = useRef(null);
  const [scale, setScale] = useState(0.5);
  const [h, setH] = useState(600);
  useEffect(() => {
    const recalc = () => {
      const w = wrap.current?.clientWidth || 794;
      const s = Math.min(1, w / 794);
      const nat = inner.current?.scrollHeight || 1123;
      setScale(s); setH(Math.max(1, nat * s));
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    if (wrap.current) ro.observe(wrap.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  });
  return (
    <div ref={wrap} style={{ width: "100%", overflow: "hidden", height: h }}>
      <div ref={inner} style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: 794 }}>
        <div className="shadow-deep" style={{ borderRadius: 4, overflow: "hidden" }}>
          <ResumeDocument cv={cv} accent={accent} />
        </div>
      </div>
    </div>
  );
}

/* ============================ BUILDER EDITING PRIMITIVES ============================ */
function Repeater({ list, setList, addLabel, onAdd, renderItem }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [armed, setArmed] = useState(null);
  const move = (from, to) => {
    if (to < 0 || to >= list.length) return;
    const a = [...list]; const [m] = a.splice(from, 1); a.splice(to, 0, m); setList(a);
  };
  return (
    <div className="space-y-3">
      {list.map((item, i) => (
        <div key={item.id}
          draggable={armed === i}
          onDragStart={(e) => { setDragIdx(i); e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== i) move(dragIdx, i); setDragIdx(null); setArmed(null); }}
          onDragEnd={() => { setDragIdx(null); setArmed(null); }}
          className={cx("surface-2 rounded-xl border border-base p-3", dragIdx === i && "dragging")}>
          <div className="flex items-start gap-2">
            <button title="Drag to reorder" className="mt-1 cursor-grab text-faint hover:text-fg"
              onMouseDown={() => setArmed(i)} onMouseUp={() => setArmed(null)}><GripVertical size={16} /></button>
            <div className="flex-1 min-w-0">{renderItem(item, i)}</div>
            <div className="flex flex-col gap-1">
              <button className="btn btn-ghost btn-icon btn-sm" title="Move up" onClick={() => move(i, i - 1)}><ChevronUp size={14} /></button>
              <button className="btn btn-ghost btn-icon btn-sm" title="Move down" onClick={() => move(i, i + 1)}><ChevronDown size={14} /></button>
              <button className="btn btn-danger btn-icon btn-sm" title="Delete" onClick={() => setList(list.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          </div>
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={onAdd} className="w-full"><Plus size={15} /> {addLabel}</Button>
    </div>
  );
}

function TagInput({ value = [], onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  const add = () => { const v = draft.trim(); if (!v) return; onChange([...value, v]); setDraft(""); };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((tag, i) => (
          <span key={i} className="chip chip-accent">
            {tag}
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="hover:opacity-70"><X size={12} /></button>
          </span>
        ))}
        {!value.length && <span className="text-[12px] text-faint">No items yet — add a few keywords.</span>}
      </div>
      <div className="flex gap-2">
        <Input value={draft} placeholder={placeholder || "Type a skill and press Enter"} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} />
        <Button variant="subtle" size="sm" onClick={add}><Plus size={15} /></Button>
      </div>
    </div>
  );
}

function BulletEditor({ bullets = [], onChange, suggestKey, pushToast, cvData, targetRole, sectionType, entryRole, entryCompany }) {
  const set = (i, v) => onChange(bullets.map((b, j) => (j === i ? v : b)));
  const [dragIdx, setDragIdx] = useState(null);
  const move = (from, to) => { if (to < 0 || to >= bullets.length) return; const a = [...bullets]; const [m] = a.splice(from, 1); a.splice(to, 0, m); onChange(a); };
  const suggestion = suggestKey && SUGGESTIONS[suggestKey];
  const aiImprove = useAiAction(aiImproveBullets);
  const aiGenerate = useAiAction(aiGenerateBullets);
  const hasContent = bullets.some((b) => b && b.trim());
  const [showOpts, setShowOpts] = useState(false);
  const [opts, setOpts] = useState(DEFAULT_AI_OPTS);
  const active = aiImprove.loading || aiImprove.data || aiImprove.error || aiGenerate.loading || aiGenerate.data || aiGenerate.error;
  const runImprove = () => { setShowOpts(false); aiGenerate.reset(); aiImprove.run({ bullets: bullets.filter((b) => b && b.trim()), sectionType: sectionType || (suggestKey === "projects" ? "project" : "experience"), targetRole: targetRole || "", cvData, length: opts.length, tone: opts.tone, customInstructions: opts.custom }); };
  const runGenerate = () => { setShowOpts(false); aiImprove.reset(); aiGenerate.run({ role: entryRole || "", company: entryCompany || "", sectionType: sectionType || (suggestKey === "projects" ? "project" : "experience"), targetRole: targetRole || "", cvData, count: 4, length: opts.length, tone: opts.tone, customInstructions: opts.custom }); };
  const resetAll = () => { aiImprove.reset(); aiGenerate.reset(); setShowOpts(false); };
  return (
    <div className="space-y-2">
      {bullets.map((b, i) => (
        <div key={i} className="flex items-start gap-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => { if (dragIdx !== null && dragIdx !== i) move(dragIdx, i); setDragIdx(null); }}>
          <button className="mt-2 cursor-grab text-faint hover:text-fg" draggable onDragStart={() => setDragIdx(i)} onDragEnd={() => setDragIdx(null)}><GripVertical size={14} /></button>
          <Textarea rows={2} value={b} onChange={(e) => set(i, e.target.value)} placeholder="Start with an action verb and quantify the impact…" />
          <button className="btn btn-danger btn-icon btn-sm mt-1" title="Remove bullet" onClick={() => onChange(bullets.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => onChange([...bullets, ""])}><Plus size={14} /> Add bullet</Button>
        {suggestion && (
          <Button variant="subtle" size="sm" onClick={() => { const s = suggestion[Math.floor(Math.random() * suggestion.length)]; onChange([...bullets, s]); pushToast?.("Suggested bullet added — edit to fit your story", "info"); }}>
            <Wand2 size={14} /> Suggest a bullet
          </Button>
        )}
        <Button variant="primary" size="sm" onClick={() => setShowOpts((v) => !v)} disabled={aiImprove.loading || aiGenerate.loading}><Sparkles size={14} /> AI Assist</Button>
      </div>
      {showOpts && !active && (
        <div className="space-y-2">
          <AiOptions opts={opts} setOpts={setOpts} />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={runImprove} disabled={!hasContent}><RefreshCw size={14} /> Improve existing</Button>
            <Button variant="secondary" size="sm" onClick={runGenerate} disabled={!entryRole}><Plus size={14} /> Generate from role</Button>
          </div>
          {!entryRole && <p className="text-[11px] text-faint">Fill in the job title above to enable "Generate from role".</p>}
        </div>
      )}
      {(aiImprove.loading || aiImprove.error || aiImprove.data) && (
        <AiSuggestionBox loading={aiImprove.loading} error={aiImprove.error} onRetry={runImprove} onReject={resetAll} applyLabel="Apply bullets"
          onApply={() => { onChange(aiImprove.data.improvedBullets); resetAll(); pushToast?.("AI bullets applied", "success"); }}>
          <ul className="space-y-1.5" style={{ listStyle: "disc", paddingLeft: 18 }}>
            {(aiImprove.data?.improvedBullets || []).map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </AiSuggestionBox>
      )}
      {(aiGenerate.loading || aiGenerate.error || aiGenerate.data) && (
        <AiSuggestionBox loading={aiGenerate.loading} error={aiGenerate.error} onRetry={runGenerate} onReject={resetAll} applyLabel="Add generated bullets"
          title="AI generated bullets — review before adding"
          onApply={() => { onChange([...bullets.filter((b) => b && b.trim()), ...(aiGenerate.data?.generatedBullets || [])]); resetAll(); pushToast?.("Generated bullets added", "success"); }}>
          <ul className="space-y-1.5" style={{ listStyle: "disc", paddingLeft: 18 }}>
            {(aiGenerate.data?.generatedBullets || []).map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </AiSuggestionBox>
      )}
    </div>
  );
}

/* ============================ SECTION EDITORS ============================ */
function SummaryEditor({ d, update, pushToast }) {
  const ai = useAiAction(aiImproveSummary);
  const [showOpts, setShowOpts] = useState(false);
  const [opts, setOpts] = useState(DEFAULT_AI_OPTS);
  const runAi = () => { setShowOpts(false); ai.run({ summary: d.summary, targetRole: d.personalInfo?.jobTitle || "", cvData: d, length: opts.length, tone: opts.tone, customInstructions: opts.custom }); };
  return (
    <div className="space-y-3">
      <Textarea rows={5} value={d.summary} onChange={(e) => update((x) => { x.data.summary = e.target.value; })}
        placeholder="Write 2–3 punchy sentences about who you are and your strongest results…" />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className={cx("text-[12px]", wordCount(d.summary) >= 30 && wordCount(d.summary) <= 90 ? "text-accent" : "text-faint")}>{wordCount(d.summary)} words · aim for 30–80</span>
        <div className="flex gap-2">
          <Button variant="subtle" size="sm" onClick={() => { const s = SUGGESTIONS.summary[Math.floor(Math.random() * SUGGESTIONS.summary.length)]; update((x) => { x.data.summary = s; }); pushToast?.("Summary suggestion applied", "info"); }}>
            <Sparkles size={14} /> Suggest
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowOpts((v) => !v)} disabled={ai.loading}><Wand2 size={14} /> Improve with AI</Button>
        </div>
      </div>
      {showOpts && !ai.loading && !ai.data && (
        <div className="space-y-2">
          <AiOptions opts={opts} setOpts={setOpts} />
          <Button variant="primary" size="sm" onClick={runAi}><Sparkles size={14} /> Run AI</Button>
        </div>
      )}
      {(ai.loading || ai.error || ai.data) && (
        <AiSuggestionBox loading={ai.loading} error={ai.error} onRetry={runAi} onReject={() => { ai.reset(); setShowOpts(false); }} applyLabel="Apply summary"
          onApply={() => { update((x) => { x.data.summary = ai.data.improvedSummary; }); ai.reset(); setShowOpts(false); pushToast?.("AI summary applied", "success"); }}>
          {ai.data?.improvedSummary}
        </AiSuggestionBox>
      )}
    </div>
  );
}

function SkillsEditor({ d, update }) {
  const setList = (list) => update((x) => { x.data.skills = list; });
  return (
    <Repeater list={d.skills} setList={setList} addLabel="Add skill category"
      onAdd={() => setList([...d.skills, { id: uid(), category: "New Category", items: [] }])}
      renderItem={(item) => (
        <div className="space-y-2">
          <Input value={item.category} placeholder="Category (e.g. Frontend)" onChange={(e) => setList(d.skills.map((s) => s.id === item.id ? { ...s, category: e.target.value } : s))} />
          <TagInput value={item.items} onChange={(items) => setList(d.skills.map((s) => s.id === item.id ? { ...s, items } : s))} />
        </div>
      )} />
  );
}

function ExperienceEditor({ d, update, pushToast }) {
  const setList = (list) => update((x) => { x.data.experience = list; });
  const patch = (id, p) => setList(d.experience.map((e) => e.id === id ? { ...e, ...p } : e));
  return (
    <Repeater list={d.experience} setList={setList} addLabel="Add experience"
      onAdd={() => setList([...d.experience, { id: uid(), role: "", company: "", location: "", start: "", end: "", current: false, bullets: [""] }])}
      renderItem={(e) => (
        <div className="space-y-2">
          <div className="grid sm:grid-cols-2 gap-2">
            <Input value={e.role} placeholder="Job title" onChange={(ev) => patch(e.id, { role: ev.target.value })} />
            <Input value={e.company} placeholder="Company" onChange={(ev) => patch(e.id, { company: ev.target.value })} />
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <Input value={e.location} placeholder="Location" onChange={(ev) => patch(e.id, { location: ev.target.value })} />
            <Input value={e.start} placeholder="Start (e.g. 2022)" onChange={(ev) => patch(e.id, { start: ev.target.value })} />
            <Input value={e.end} placeholder="End" disabled={e.current} onChange={(ev) => patch(e.id, { end: ev.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <input type="checkbox" checked={e.current} onChange={(ev) => patch(e.id, { current: ev.target.checked })} /> I currently work here
          </label>
          <BulletEditor bullets={e.bullets} suggestKey="experience" sectionType="experience" cvData={d} targetRole={d.personalInfo?.jobTitle} entryRole={e.role} entryCompany={e.company} pushToast={pushToast} onChange={(bullets) => patch(e.id, { bullets })} />
        </div>
      )} />
  );
}

function ProjectsEditor({ d, update, pushToast }) {
  const setList = (list) => update((x) => { x.data.projects = list; });
  const patch = (id, p) => setList(d.projects.map((e) => e.id === id ? { ...e, ...p } : e));
  return (
    <Repeater list={d.projects} setList={setList} addLabel="Add project"
      onAdd={() => setList([...d.projects, { id: uid(), name: "", tech: "", link: "", bullets: [""] }])}
      renderItem={(pr) => (
        <div className="space-y-2">
          <div className="grid sm:grid-cols-2 gap-2">
            <Input value={pr.name} placeholder="Project name" onChange={(e) => patch(pr.id, { name: e.target.value })} />
            <Input value={pr.tech} placeholder="Tech stack (React · Node…)" onChange={(e) => patch(pr.id, { tech: e.target.value })} />
          </div>
          <Input value={pr.link} placeholder="Link (github.com/…)" onChange={(e) => patch(pr.id, { link: e.target.value })} />
          <BulletEditor bullets={pr.bullets} suggestKey="projects" sectionType="project" cvData={d} targetRole={d.personalInfo?.jobTitle} entryRole={pr.name} entryCompany={pr.tech} pushToast={pushToast} onChange={(bullets) => patch(pr.id, { bullets })} />
        </div>
      )} />
  );
}

function EducationEditor({ d, update }) {
  const setList = (list) => update((x) => { x.data.education = list; });
  const patch = (id, p) => setList(d.education.map((e) => e.id === id ? { ...e, ...p } : e));
  return (
    <Repeater list={d.education} setList={setList} addLabel="Add education"
      onAdd={() => setList([...d.education, { id: uid(), degree: "", school: "", location: "", start: "", end: "", details: "" }])}
      renderItem={(e) => (
        <div className="space-y-2">
          <Input value={e.degree} placeholder="Degree (B.Sc. in …)" onChange={(ev) => patch(e.id, { degree: ev.target.value })} />
          <div className="grid sm:grid-cols-2 gap-2">
            <Input value={e.school} placeholder="School / University" onChange={(ev) => patch(e.id, { school: ev.target.value })} />
            <Input value={e.location} placeholder="Location" onChange={(ev) => patch(e.id, { location: ev.target.value })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <Input value={e.start} placeholder="Start" onChange={(ev) => patch(e.id, { start: ev.target.value })} />
            <Input value={e.end} placeholder="End" onChange={(ev) => patch(e.id, { end: ev.target.value })} />
          </div>
          <Input value={e.details} placeholder="Details (GPA, honors…)" onChange={(ev) => patch(e.id, { details: ev.target.value })} />
        </div>
      )} />
  );
}

function CertificationsEditor({ d, update }) {
  const setList = (list) => update((x) => { x.data.certifications = list; });
  const patch = (id, p) => setList(d.certifications.map((e) => e.id === id ? { ...e, ...p } : e));
  return (
    <Repeater list={d.certifications} setList={setList} addLabel="Add certification"
      onAdd={() => setList([...d.certifications, { id: uid(), name: "", issuer: "", date: "" }])}
      renderItem={(c) => (
        <div className="grid sm:grid-cols-3 gap-2">
          <Input value={c.name} placeholder="Certification" onChange={(e) => patch(c.id, { name: e.target.value })} />
          <Input value={c.issuer} placeholder="Issuer" onChange={(e) => patch(c.id, { issuer: e.target.value })} />
          <Input value={c.date} placeholder="Year" onChange={(e) => patch(c.id, { date: e.target.value })} />
        </div>
      )} />
  );
}

function LanguagesEditor({ d, update }) {
  const setList = (list) => update((x) => { x.data.languages = list; });
  const patch = (id, p) => setList(d.languages.map((e) => e.id === id ? { ...e, ...p } : e));
  return (
    <Repeater list={d.languages} setList={setList} addLabel="Add language"
      onAdd={() => setList([...d.languages, { id: uid(), name: "", level: "" }])}
      renderItem={(l) => (
        <div className="grid sm:grid-cols-2 gap-2">
          <Input value={l.name} placeholder="Language" onChange={(e) => patch(l.id, { name: e.target.value })} />
          <Input value={l.level} placeholder="Level (Native, Fluent…)" onChange={(e) => patch(l.id, { level: e.target.value })} />
        </div>
      )} />
  );
}

function AchievementsEditor({ d, update }) {
  const setList = (list) => update((x) => { x.data.achievements = list; });
  const patch = (id, p) => setList(d.achievements.map((e) => e.id === id ? { ...e, ...p } : e));
  return (
    <Repeater list={d.achievements} setList={setList} addLabel="Add achievement"
      onAdd={() => setList([...d.achievements, { id: uid(), text: "" }])}
      renderItem={(a) => <Textarea rows={2} value={a.text} placeholder="Award, recognition, or measurable achievement…" onChange={(e) => patch(a.id, { text: e.target.value })} />} />
  );
}

function VolunteerEditor({ d, update }) {
  const setList = (list) => update((x) => { x.data.volunteer = list; });
  const patch = (id, p) => setList(d.volunteer.map((e) => e.id === id ? { ...e, ...p } : e));
  return (
    <Repeater list={d.volunteer} setList={setList} addLabel="Add volunteer role"
      onAdd={() => setList([...d.volunteer, { id: uid(), role: "", org: "", period: "", description: "" }])}
      renderItem={(v) => (
        <div className="space-y-2">
          <div className="grid sm:grid-cols-3 gap-2">
            <Input value={v.role} placeholder="Role" onChange={(e) => patch(v.id, { role: e.target.value })} />
            <Input value={v.org} placeholder="Organization" onChange={(e) => patch(v.id, { org: e.target.value })} />
            <Input value={v.period} placeholder="Period" onChange={(e) => patch(v.id, { period: e.target.value })} />
          </div>
          <Textarea rows={2} value={v.description} placeholder="What you did and the impact…" onChange={(e) => patch(v.id, { description: e.target.value })} />
        </div>
      )} />
  );
}

function CustomEditor({ d, update }) {
  const setList = (list) => update((x) => { x.data.customSections = list; });
  const patch = (id, p) => setList(d.customSections.map((e) => e.id === id ? { ...e, ...p } : e));
  return (
    <Repeater list={d.customSections} setList={setList} addLabel="Add custom section"
      onAdd={() => setList([...d.customSections, { id: uid(), title: "New Section", items: [{ id: uid(), text: "" }] }])}
      renderItem={(cs) => (
        <div className="space-y-2">
          <Input value={cs.title} placeholder="Section title" onChange={(e) => patch(cs.id, { title: e.target.value })} />
          {(cs.items || []).map((it) => (
            <div key={it.id} className="flex items-start gap-2">
              <Textarea rows={2} value={it.text} placeholder="Item…" onChange={(e) => patch(cs.id, { items: cs.items.map((x) => x.id === it.id ? { ...x, text: e.target.value } : x) })} />
              <button className="btn btn-danger btn-icon btn-sm mt-1" onClick={() => patch(cs.id, { items: cs.items.filter((x) => x.id !== it.id) })}><Trash2 size={14} /></button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => patch(cs.id, { items: [...(cs.items || []), { id: uid(), text: "" }] })}><Plus size={14} /> Add item</Button>
        </div>
      )} />
  );
}

const SECTION_EDITORS = {
  summary: SummaryEditor, skills: SkillsEditor, experience: ExperienceEditor, projects: ProjectsEditor,
  education: EducationEditor, certifications: CertificationsEditor, languages: LanguagesEditor,
  achievements: AchievementsEditor, volunteer: VolunteerEditor, custom: CustomEditor,
};

/* ============================ ANALYSIS PANELS ============================ */
function ListBlock({ icon: Icon, tone, title, items, empty }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2"><Icon size={15} style={{ color: tone }} /><span className="text-[13px] font-bold text-fg">{title}</span><span className="chip">{items.length}</span></div>
      {items.length ? (
        <ul className="space-y-1.5">{items.map((t, i) => (
          <li key={i} className="flex gap-2 text-[13px] text-muted"><span style={{ color: tone, marginTop: 1 }}>•</span><span>{t}</span></li>
        ))}</ul>
      ) : <p className="text-[12.5px] text-faint">{empty}</p>}
    </div>
  );
}

function AtsPanel({ cv, jobKeywords = [] }) {
  const res = useMemo(() => computeAts(cv, jobKeywords), [cv, jobKeywords]);
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center">
        <ProgressRing value={res.score} />
        <p className="text-[13px] text-muted mt-3 max-w-[260px]">
          {res.score >= 75 ? "Strong — this resume should parse cleanly and read well." :
            res.score >= 50 ? "Decent start. Apply the tips below to push past 75." :
              "Needs work. The fixes below will raise your score quickly."}
        </p>
      </div>
      <div className="grid gap-5">
        <ListBlock icon={CheckCircle2} tone="var(--good)" title="Strengths" items={res.strengths} empty="Fill in more sections to build strengths." />
        <ListBlock icon={AlertTriangle} tone="var(--warn)" title="Weaknesses" items={res.weaknesses} empty="No major issues found. Nice." />
        <ListBlock icon={Lightbulb} tone="var(--accent)" title="Actionable tips" items={res.tips} empty="You're all set on the basics." />
      </div>
    </div>
  );
}

/* ============================ PERSONAL INFO ============================ */
function PersonalInfoEditor({ d, update, showPhoto }) {
  const p = d.personalInfo;
  const set = (k, v) => update((x) => { x.data.personalInfo[k] = v; });
  const emailBad = p.email && !isEmail(p.email);
  const phoneBad = p.phone && !isPhone(p.phone);
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Full name" required><Input value={p.fullName} placeholder="Jane Doe" onChange={(e) => set("fullName", e.target.value)} /></Field>
      <Field label="Job title"><Input value={p.jobTitle} placeholder="Software Engineer" onChange={(e) => set("jobTitle", e.target.value)} /></Field>
      <Field label="Email" required error={emailBad ? "Enter a valid email" : ""}><Input invalid={emailBad} value={p.email} placeholder="jane@email.com" onChange={(e) => set("email", e.target.value)} /></Field>
      <Field label="Phone" error={phoneBad ? "Enter a valid phone" : ""}><Input invalid={phoneBad} value={p.phone} placeholder="+1 555 123 4567" onChange={(e) => set("phone", e.target.value)} /></Field>
      <Field label="Location"><Input value={p.location} placeholder="City, Country" onChange={(e) => set("location", e.target.value)} /></Field>
      <Field label="LinkedIn"><Input value={p.linkedin} placeholder="linkedin.com/in/you" onChange={(e) => set("linkedin", e.target.value)} /></Field>
      <Field label="GitHub"><Input value={p.github} placeholder="github.com/you" onChange={(e) => set("github", e.target.value)} /></Field>
      <Field label="Portfolio"><Input value={p.portfolio} placeholder="yoursite.dev" onChange={(e) => set("portfolio", e.target.value)} /></Field>
      {showPhoto && <div className="sm:col-span-2">
        <div className="text-[12px] font-bold text-faint mb-1.5">Profile photo</div>
        <div className="flex items-center gap-3">
          {p.photo && <img src={p.photo} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--accent)" }} />}
          <label className="btn btn-secondary btn-sm cursor-pointer">
            <Upload size={14} /> {p.photo ? "Change photo" : "Upload photo"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0]; if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => set("photo", ev.target.result);
              reader.readAsDataURL(file);
              e.target.value = "";
            }} />
          </label>
          {p.photo && <button className="btn btn-ghost btn-sm" onClick={() => set("photo", "")}><Trash2 size={14} /> Remove</button>}
        </div>
        <p className="text-[11px] text-faint mt-1">Shown in templates that support photos (Photo Card, Sidebar Pro, Accent Bar).</p>
      </div>}
    </div>
  );
}

/* ============================ SECTION PANEL (collapsible + reorder) ============================ */
function SectionPanel({ k, cv, update, pushToast, dragProps, onToggleVis }) {
  const [open, setOpen] = useState(true);
  const meta = SECTION_META[k];
  const Icon = meta.icon;
  const Editor = SECTION_EDITORS[k];
  const visible = cv.config.visible[k] !== false;
  return (
    <div className="card overflow-hidden" {...dragProps.container}>
      <div className="flex items-center gap-2 px-3 py-2.5 surface-2">
        <button className="cursor-grab text-faint hover:text-fg" title="Drag to reorder section" {...dragProps.handle}><GripVertical size={16} /></button>
        <button className="flex items-center gap-2 flex-1 min-w-0 text-left" onClick={() => setOpen((o) => !o)}>
          <span className="grid place-items-center rounded-lg" style={{ width: 28, height: 28, background: "var(--accent-soft)", color: "var(--accent)" }}><Icon size={15} /></span>
          <span className="text-[14px] font-bold text-fg truncate">{meta.label}</span>
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" title={visible ? "Hide section" : "Show section"} onClick={onToggleVis}>
          {visible ? <Eye size={15} /> : <EyeOff size={15} className="text-faint" />}
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen((o) => !o)}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
      </div>
      {open && <div className={cx("p-3.5", !visible && "opacity-50")}>
        <Editor d={cv.data} update={update} pushToast={pushToast} />
      </div>}
    </div>
  );
}

/* ============================ BUILDER PAGE ============================ */
function BuilderPage({ cv, update, setTemplate, rename, onExport, onBack, accent, pushToast }) {
  const [tab, setTab] = useState("edit");           // mobile: edit | preview
  const [showAts, setShowAts] = useState(false);
  const [full, setFull] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [armed, setArmed] = useState(null);
  const order = cv.config.order;

  const moveSection = (from, to) => {
    if (to < 0 || to >= order.length) return;
    update((x) => { const a = [...x.config.order]; const [m] = a.splice(from, 1); a.splice(to, 0, m); x.config.order = a; });
  };

  /* Measure the sticky top bar so the live-preview panel can stick just below it */
  const topbarRef = useRef(null);
  const [topbarH, setTopbarH] = useState(56);
  useEffect(() => {
    const el = topbarRef.current;
    if (!el) return;
    const measure = () => setTopbarH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ "--preview-top-offset": `${topbarH + 8}px` }}>
      {/* top bar */}
      <div ref={topbarRef} className="surface border-b border-base px-3 sm:px-5 py-2.5 flex items-center gap-2 flex-wrap sticky top-0 z-20">
        <button className="btn btn-ghost btn-sm" onClick={onBack}><ChevronRight size={15} className="rotate-180" /> Dashboard</button>
        <input value={cv.name} onChange={(e) => rename(e.target.value)} className="sa-input" style={{ maxWidth: 200, fontWeight: 700 }} />
        <select className="sa-input" style={{ maxWidth: 170 }} value={cv.template} onChange={(e) => setTemplate(e.target.value)}>
          {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => setShowAts(true)}><ShieldCheck size={15} /> ATS</Button>
        <Button variant="ghost" size="sm" onClick={() => setFull(true)}><Maximize2 size={15} /> <span className="hidden sm:inline">Preview</span></Button>
        <Button variant="primary" size="sm" onClick={onExport}><Download size={15} /> <span className="hidden sm:inline">Export PDF</span></Button>
      </div>

      {/* mobile tabs */}
      <div className="md:hidden flex p-2 gap-2 surface border-b border-base">
        {["edit", "preview"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cx("btn flex-1 btn-sm", tab === t ? "btn-primary" : "btn-subtle")}>{t === "edit" ? "Edit" : "Preview"}</button>
        ))}
      </div>

      <div className="flex-1 grid md:grid-cols-2">
        {/* editor column */}
        <div className={cx("min-w-0 p-3 sm:p-5 space-y-4", tab === "preview" && "hidden md:block")} style={{ background: "var(--bg)" }}>
          <div className="card p-3.5">
            <div className="flex items-center gap-2 mb-3"><span className="grid place-items-center rounded-lg" style={{ width: 28, height: 28, background: "var(--accent-soft)", color: "var(--accent)" }}><Mail size={15} /></span><span className="text-[14px] font-bold text-fg">Personal Information</span></div>
            <PersonalInfoEditor d={cv.data} update={update} showPhoto={!!(TEMPLATES.find((t) => t.id === cv.template) || {}).photo} />
          </div>

          {/* Customize CV */}
          <div className="card p-3.5">
            <div className="flex items-center gap-2 mb-3"><span className="grid place-items-center rounded-lg" style={{ width: 28, height: 28, background: "var(--accent-soft)", color: "var(--accent)" }}><Palette size={15} /></span><span className="text-[14px] font-bold text-fg">Customize CV</span></div>
            <div className="space-y-3">
              <div>
                <div className="text-[12px] font-bold text-faint mb-2">Accent color</div>
                <div className="flex flex-wrap gap-2">
                  {CV_COLORS.map((c) => (
                    <button key={c.hex} onClick={() => update((x) => { x.config.accentColor = c.hex; })}
                      className={cx("color-swatch", cv.config?.accentColor === c.hex && "active")}
                      style={{ background: c.hex }} title={c.label} />
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[12px] font-bold text-faint mb-2">Font family</div>
                <select className="sa-input" style={{ maxWidth: 220 }} value={cv.config?.fontOverride || ""} onChange={(e) => update((x) => { x.config.fontOverride = e.target.value || null; })}>
                  <option value="">Template default</option>
                  {CV_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[12px] font-bold text-faint mb-2">Spacing</div>
                <div className="flex gap-1.5">
                  {[["compact","Compact"],["normal","Normal"],["spacious","Spacious"]].map(([v,l]) => (
                    <button key={v} onClick={() => update((x) => { x.config.spacing = v; })}
                      className={cx("chip cursor-pointer transition-all", (cv.config?.spacing || "normal") === v ? "bg-accent" : "bg-soft")}
                      style={(cv.config?.spacing || "normal") === v ? { color: "var(--accent-fg)" } : {}}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {order.map((k, i) => (
            <SectionPanel key={k} k={k} cv={cv} update={update} pushToast={pushToast}
              onToggleVis={() => update((x) => { x.config.visible[k] = x.config.visible[k] === false; })}
              dragProps={{
                container: {
                  draggable: armed === i,
                  onDragStart: (e) => { setDragIdx(i); e.dataTransfer.effectAllowed = "move"; },
                  onDragOver: (e) => e.preventDefault(),
                  onDrop: (e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== i) moveSection(dragIdx, i); setDragIdx(null); setArmed(null); },
                  onDragEnd: () => { setDragIdx(null); setArmed(null); },
                  className: cx(dragIdx === i && "dragging"),
                },
                handle: { onMouseDown: () => setArmed(i), onMouseUp: () => setArmed(null) },
              }} />
          ))}
          <p className="text-center text-[12px] text-faint pt-2">Drag the <GripVertical size={12} className="inline" /> handles to reorder sections · toggle the eye to hide them</p>
        </div>

        {/* preview column */}
        <div className={cx("min-w-0 p-4 sm:p-6 border-l border-base", tab === "edit" && "hidden md:block")} style={{ background: "var(--surface-2)" }}>
          <div className="builder-preview-sticky">
            <div className="flex items-center justify-between mb-3">
              <span className="chip"><Eye size={13} /> Live preview</span>
              <span className="chip chip-accent">{TEMPLATES.find((t) => t.id === cv.template)?.name}</span>
            </div>
            <ScaledDoc cv={cv} accent={accent} />
          </div>
        </div>
      </div>

      {/* ATS drawer */}
      <Modal open={showAts} onClose={() => setShowAts(false)} title="ATS Score & Suggestions" max={460}>
        <AtsPanel cv={cv} />
      </Modal>

      {/* fullscreen preview */}
      {full && (
        <div className="fixed inset-0 z-50 anim-in flex flex-col" style={{ background: "rgba(8,12,18,.85)", backdropFilter: "blur(4px)" }}>
          <div className="flex items-center gap-2 p-3 flex-wrap">
            <span className="text-white font-bold px-2">Preview · {cv.name}</span>
            <select className="sa-input" style={{ maxWidth: 180 }} value={cv.template} onChange={(e) => setTemplate(e.target.value)}>
              {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="flex-1" />
            <Button variant="primary" size="sm" onClick={onExport}><Printer size={15} /> Export PDF</Button>
            <Button variant="ghost" size="sm" className="text-white border-white/30" onClick={() => setFull(false)}><X size={15} /> Close</Button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-10 flex justify-center">
            <div style={{ width: "min(794px, 100%)" }}><ScaledDoc cv={cv} accent={accent} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ SHARED BITS ============================ */
function Brand({ size = 18, onClick }) {
  const inner = (
    <div className="flex items-center gap-2.5" style={{ cursor: onClick ? "pointer" : undefined }} onClick={onClick}>
      <span className="grid place-items-center bg-accent rounded-xl shadow-soft" style={{ width: size + 16, height: size + 16 }}><FileText size={size} /></span>
      <span className="font-extrabold text-fg sa-display" style={{ fontSize: size + 2, letterSpacing: "-.03em" }}>Smart<span className="text-accent">ATS</span></span>
    </div>
  );
  return inner;
}
function Stat({ icon: Icon, label, value }) {
  return (
    <div className="card p-4 flex items-center gap-3 hover-rise">
      <span className="grid place-items-center rounded-xl" style={{ width: 44, height: 44, background: "var(--accent-soft)", color: "var(--accent)" }}><Icon size={20} /></span>
      <div><div className="text-[22px] font-extrabold text-fg sa-display leading-none">{value}</div><div className="text-[12.5px] text-faint mt-1">{label}</div></div>
    </div>
  );
}

/* ============================ LANDING ============================ */
function Landing({ onStart, goTemplates, theme, toggleTheme, onLogin, user, onLogout, onDashboard }) {
  const sample = useMemo(() => newCv("Sample"), []);
  const features = [
    { icon: Eye, t: "Live preview", d: "Watch your resume update instantly as you type — no guesswork." },
    { icon: ShieldCheck, t: "ATS score checker", d: "Get a 0–100 score with concrete, prioritized fixes." },
    { icon: Target, t: "Job-description match", d: "Paste any job post and see exactly which keywords you're missing." },
    { icon: Layers, t: "5 ATS-safe templates", d: "Single-column, parser-friendly layouts with selectable text." },
    { icon: Wand2, t: "Smart suggestions", d: "Strong, achievement-based wording for bullets and summaries." },
    { icon: Download, t: "Clean PDF export", d: "Pixel-clean, text-selectable PDFs named FullName_CV.pdf." },
  ];
  const steps = [
    { n: "01", t: "Add your details", d: "Fill structured sections — or start from realistic sample data." },
    { n: "02", t: "Optimize for ATS", d: "Apply suggestions and match a specific job description." },
    { n: "03", t: "Export & apply", d: "Download a clean, recruiter-ready PDF in one click." },
  ];
  const quotes = [
    { q: "Went from 3 callbacks to 11 in two weeks. The job-match keywords were the difference.", n: "Lina H.", r: "New-grad SWE" },
    { q: "Finally a builder that doesn't fight the ATS. Clean output, zero parsing issues.", n: "Marcus T.", r: "Backend Engineer" },
    { q: "The live ATS score made it obvious what to fix. Hit 92 before I applied.", n: "Sara K.", r: "Computer Engineer" },
  ];
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-5 sm:px-8 py-4 max-w-[1200px] mx-auto">
        <Brand />
        <div className="flex items-center gap-2">
          <IconButton title="Toggle theme" onClick={toggleTheme}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</IconButton>
          {user && !user.guest ? (
            <>
              <Button variant="ghost" size="sm" onClick={onDashboard}><LayoutDashboard size={15} /> Dashboard</Button>
              <Button variant="secondary" size="sm" onClick={onLogout}><LogOut size={15} /> Logout</Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={onLogin}>Sign in</Button>
          )}
          <Button variant="primary" size="sm" onClick={onStart}>Build My CV</Button>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="glow" style={{ width: 460, height: 460, background: "var(--accent)", top: -160, right: -80 }} />
        <div className="glow" style={{ width: 380, height: 380, background: "var(--accent-2)", bottom: -200, left: -120, opacity: .25 }} />
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12 md:py-20 grid lg:grid-cols-2 gap-12 items-center relative">
          <div className="anim-up">
            <span className="chip chip-accent mb-5"><Sparkles size={13} /> ATS-friendly resume builder</span>
            <h1 className="text-fg font-extrabold sa-display" style={{ fontSize: "clamp(34px,5vw,56px)", lineHeight: 1.04 }}>
              Land the interview with a resume the <span className="text-accent">robots</span> can read.
            </h1>
            <p className="text-muted mt-5 text-[16px] max-w-[520px]">
              Build a clean, professional CV with live preview, a real-time ATS score, job-description matching, and one-click PDF export — all in your browser.
            </p>
            <div className="flex flex-wrap gap-3 mt-7">
              <Button variant="primary" onClick={onStart}>Build My CV <ArrowRight size={16} /></Button>
              <Button variant="ghost" onClick={goTemplates}>View Templates</Button>
            </div>
            <div className="flex items-center gap-5 mt-8 text-[13px] text-faint">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-accent" /> No sign-up needed</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-accent" /> Saved in your browser</span>
            </div>
          </div>
          <div className="relative anim-up" style={{ animationDelay: ".12s" }}>
            <div className="card shadow-deep p-3 rotate-1 hover-rise hero-preview" style={{ maxWidth: 380, margin: "0 auto" }}>
              <ScaledDoc cv={sample} accent="emerald" />
            </div>
            <div className="card shadow-deep p-3 absolute -bottom-5 -left-2 sm:left-4 flex items-center gap-3 anim-pop" style={{ animationDelay: ".4s" }}>
              <ProgressRing value={92} size={62} stroke={7} label="ATS" />
              <div><div className="text-[13px] font-bold text-fg">Great score</div><div className="text-[12px] text-faint">Recruiter-ready</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* features */}
      <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-14">
        <h2 className="text-center text-fg font-extrabold sa-display" style={{ fontSize: "clamp(26px,3.5vw,38px)" }}>Everything you need to get hired</h2>
        <p className="text-center text-muted mt-3 max-w-[560px] mx-auto">A complete toolkit — not just a form. Built for students, fresh grads, developers, and engineers.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
          {features.map((f, i) => (
            <div key={i} className="card p-5 hover-rise anim-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <span className="grid place-items-center rounded-xl mb-4" style={{ width: 46, height: 46, background: "var(--accent-soft)", color: "var(--accent)" }}><f.icon size={22} /></span>
              <h3 className="text-[16px] font-bold text-fg">{f.t}</h3>
              <p className="text-[14px] text-muted mt-1.5">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ATS band */}
      <section className="surface border-y border-base">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-14 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="chip chip-accent mb-4"><ShieldCheck size={13} /> Why ATS matters</span>
            <h2 className="text-fg font-extrabold sa-display" style={{ fontSize: "clamp(24px,3vw,32px)" }}>75% of resumes never reach a human</h2>
            <p className="text-muted mt-3">Applicant Tracking Systems scan and rank resumes before a recruiter sees them. Fancy graphics, columns, and tables confuse parsers — and good candidates get filtered out.</p>
            <p className="text-muted mt-3">Every Smart ATS template is single-column, table-free, and exports selectable text, so your content survives the scan.</p>
          </div>
          <div className="card p-6 space-y-3">
            {["Single-column, parser-safe structure", "Standard section headings recognized by ATS", "Selectable text — never an image of your resume", "No tables or graphics that break parsing", "Keyword matching against the exact job post"].map((t, i) => (
              <div key={i} className="flex items-center gap-3 text-[14px] text-fg"><CheckCircle2 size={18} className="text-accent shrink-0" /> {t}</div>
            ))}
          </div>
        </div>
      </section>

      {/* templates preview */}
      <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-14">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-8">
          <div><h2 className="text-fg font-extrabold sa-display" style={{ fontSize: "clamp(24px,3vw,34px)" }}>Professional templates</h2><p className="text-muted mt-2">Five recruiter-tested layouts. All ATS-safe.</p></div>
          <Button variant="ghost" onClick={goTemplates}>See all templates <ArrowRight size={15} /></Button>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {TEMPLATES.slice(0, 3).map((t) => (
            <div key={t.id} className="card p-3 hover-rise" style={{ overflow: "hidden" }}>
              <div style={{ maxHeight: 420, overflow: "hidden" }}><ScaledDoc cv={{ ...sample, template: t.id }} accent="emerald" /></div>
              <div className="px-1 pt-3 pb-1"><div className="text-[14px] font-bold text-fg">{t.name}</div><div className="text-[12.5px] text-faint">{t.blurb}</div></div>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section className="surface border-y border-base">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-14">
          <h2 className="text-center text-fg font-extrabold sa-display" style={{ fontSize: "clamp(24px,3vw,34px)" }}>How it works</h2>
          <div className="grid md:grid-cols-3 gap-5 mt-10">
            {steps.map((s) => (
              <div key={s.n} className="relative card p-6">
                <span className="text-accent font-extrabold sa-display" style={{ fontSize: 34, opacity: .25 }}>{s.n}</span>
                <h3 className="text-[17px] font-bold text-fg mt-1">{s.t}</h3>
                <p className="text-[14px] text-muted mt-2">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* testimonials */}
      <section className="max-w-[1100px] mx-auto px-5 sm:px-8 py-14">
        <h2 className="text-center text-fg font-extrabold sa-display" style={{ fontSize: "clamp(24px,3vw,34px)" }}>Loved by job seekers</h2>
        <div className="grid md:grid-cols-3 gap-4 mt-10">
          {quotes.map((q, i) => (
            <div key={i} className="card p-6 hover-rise">
              <Quote size={22} className="text-accent" />
              <p className="text-[14px] text-fg mt-3">{q.q}</p>
              <div className="flex items-center gap-1 mt-4 mb-2">{[0, 1, 2, 3, 4].map((s) => <Star key={s} size={14} className="text-accent" fill="currentColor" />)}</div>
              <div className="text-[13px] font-bold text-fg">{q.n}</div><div className="text-[12px] text-faint">{q.r}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1100px] mx-auto px-5 sm:px-8 pb-16">
        <div className="card shadow-deep p-10 text-center relative overflow-hidden">
          <div className="glow" style={{ width: 320, height: 320, background: "var(--accent)", top: -120, left: "40%" }} />
          <h2 className="text-fg font-extrabold sa-display relative" style={{ fontSize: "clamp(26px,3.5vw,38px)" }}>Your next resume is 5 minutes away</h2>
          <p className="text-muted mt-3 relative">Start free — your work saves automatically in your browser.</p>
          <div className="mt-6 relative flex justify-center"><Button variant="primary" onClick={onStart}>Build My CV <ArrowRight size={16} /></Button></div>
        </div>
      </section>

      <footer className="border-t border-base">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Brand size={16} />
          <p className="text-[13px] text-faint">Built as a portfolio project · ATS-friendly resume builder</p>
          <div className="flex gap-3 text-faint"><Github size={18} /><Linkedin size={18} /><Globe size={18} /></div>
        </div>
      </footer>
    </div>
  );
}

/* ============================ AUTH ============================ */
function AuthPage({ mode, setMode, onAuth, onBack }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const titles = { login: "Welcome back", register: "Create your account", forgot: "Reset your password" };
  const submit = async () => {
    if (mode === "forgot") { if (!isEmail(email)) return setErr("Enter a valid email"); }
    else {
      if (mode === "register" && !name.trim()) return setErr("Enter your name");
      if (!isEmail(email)) return setErr("Enter a valid email");
      if ((pw || "").length < 6) return setErr("Password must be at least 6 characters");
    }
    setLoading(true); setErr("");
    try {
      const result = await onAuth({ email, password: pw, name: name.trim(), mode });
      if (result?.error) setErr(result.error);
    } catch (e) { setErr(e.message || "Something went wrong"); }
    finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden" style={{ background: "var(--surface)" }}>
        <div className="glow" style={{ width: 360, height: 360, background: "var(--accent)", top: -120, left: -80 }} />
        <Brand />
        <div className="relative">
          <h2 className="text-fg font-extrabold sa-display" style={{ fontSize: 30 }}>Resumes that beat the bots.</h2>
          <p className="text-muted mt-4 max-w-[380px]">Live ATS scoring, job-match keywords, and clean PDF export — everything in one place.</p>
          <div className="space-y-3 mt-8">
            {["Real-time ATS score 0–100", "Match against any job description", "5 parser-safe templates"].map((t, i) => (
              <div key={i} className="flex items-center gap-3 text-[14px] text-fg"><CheckCircle2 size={18} className="text-accent" /> {t}</div>
            ))}
          </div>
        </div>
        <p className="text-[13px] text-faint relative">© Smart ATS CV Builder</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-[400px] anim-up">
          <div className="lg:hidden mb-8 flex justify-center"><Brand /></div>
          <button onClick={onBack} className="text-[13px] text-faint hover:text-fg mb-4 flex items-center gap-1"><ChevronRight size={14} className="rotate-180" /> Back to home</button>
          <h1 className="text-fg font-extrabold sa-display" style={{ fontSize: 26 }}>{titles[mode]}</h1>
          <p className="text-muted text-[14px] mt-1.5">{mode === "register" ? "Free forever. No credit card." : mode === "forgot" ? "We'll email you a reset link." : "Sign in to continue building."}</p>
          <div className="space-y-3 mt-6">
            {mode === "register" && <Field label="Full name"><Input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="Jane Doe" /></Field>}
            <Field label="Email"><Input value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="jane@email.com" /></Field>
            {mode !== "forgot" && <Field label="Password"><Input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder="••••••••" /></Field>}
            {err && <div className="text-[13px] flex items-center gap-1.5" style={{ color: "var(--danger)" }}><AlertCircle size={15} /> {err}</div>}
            <Button variant="primary" className="w-full" onClick={submit} disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send reset link"}</Button>
          </div>
          <div className="text-[13px] text-muted mt-5 text-center space-y-1.5">
            {mode === "login" && <><div>No account? <button className="text-accent font-semibold" onClick={() => setMode("register")}>Sign up</button></div><div><button className="text-faint hover:text-fg" onClick={() => setMode("forgot")}>Forgot password?</button></div></>}
            {mode === "register" && <div>Already have an account? <button className="text-accent font-semibold" onClick={() => setMode("login")}>Sign in</button></div>}
            {mode === "forgot" && <div><button className="text-accent font-semibold" onClick={() => setMode("login")}>Back to sign in</button></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ DASHBOARD ============================ */

function AuthFormInline({ mode, setMode, onAuth }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (mode === "forgot") { if (!isEmail(email)) return setErr("Enter a valid email"); }
    else {
      if (mode === "register" && !name.trim()) return setErr("Enter your name");
      if (!isEmail(email)) return setErr("Enter a valid email");
      if ((pw || "").length < 6) return setErr("Password must be at least 6 characters");
    }
    setLoading(true); setErr("");
    try {
      const result = await onAuth({ email, password: pw, name: name.trim(), mode });
      if (result?.error) setErr(result.error);
    } catch (e) { setErr(e.message || "Something went wrong"); }
    finally { setLoading(false); }
  };
  return (
    <div className="space-y-3">
      {mode === "register" && <Field label="Full name"><Input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="Your name" /></Field>}
      <Field label="Email"><Input value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="you@email.com" /></Field>
      {mode !== "forgot" && <Field label="Password"><Input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder="••••••••" /></Field>}
      {err && <div className="text-[13px] flex items-center gap-1.5" style={{ color: "var(--danger)" }}><AlertCircle size={15} /> {err}</div>}
      <Button variant="primary" className="w-full" onClick={submit} disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send reset link"}</Button>
      <div className="text-[13px] text-muted text-center space-y-1.5">
        {mode === "login" && <><div>No account? <button className="text-accent font-semibold" onClick={() => setMode("register")}>Sign up</button></div><div><button className="text-faint hover:text-fg" onClick={() => setMode("forgot")}>Forgot password?</button></div></>}
        {mode === "register" && <div>Already have an account? <button className="text-accent font-semibold" onClick={() => setMode("login")}>Sign in</button></div>}
        {mode === "forgot" && <div><button className="text-accent font-semibold" onClick={() => setMode("login")}>Back to sign in</button></div>}
      </div>
    </div>
  );
}

/* ============================ CvCard ============================ */
function CvCard({ cv, accent, onOpen, onDuplicate, onRename, onDelete, onExport }) {
  const [menu, setMenu] = useState(false);
  const tpl = TEMPLATES.find((t) => t.id === cv.template);
  return (
    <div className="card overflow-hidden hover-rise group" style={{ position: "relative" }}>
      <div className="relative cursor-pointer" onClick={onOpen} style={{ height: 188, background: "var(--doc-shell)", borderBottom: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ pointerEvents: "none", padding: "14px 14px 0" }}><ScaledDoc cv={cv} accent={accent} /></div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition" style={{ background: "rgba(8,12,18,.32)" }}>
          <span className="btn btn-primary btn-sm"><Pencil size={14} /> Open editor</span>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-bold text-fg truncate text-[15px]">{cv.name}</div>
            <div className="text-[12px] text-faint mt-0.5">{tpl?.name} · edited {fmtDate(cv.lastEdited)}</div>
          </div>
          <div className="relative">
            <IconButton title="Actions" onClick={() => setMenu((m) => !m)}><ChevronDown size={16} /></IconButton>
            {menu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-40 card shadow-deep py-1.5 anim-pop" style={{ minWidth: 168 }}>
                  {[
                    { label: "Open", icon: Pencil, fn: onOpen },
                    { label: "Export PDF", icon: Download, fn: onExport },
                    { label: "Duplicate", icon: Copy, fn: onDuplicate },
                    { label: "Rename", icon: PenLine, fn: onRename },
                  ].map((a) => (
                    <button key={a.label} onClick={() => { setMenu(false); a.fn(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-fg hover:bg-soft text-left"><a.icon size={15} className="text-faint" /> {a.label}</button>
                  ))}
                  <div className="my-1 border-t border-base" />
                  <button onClick={() => { setMenu(false); onDelete(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-left hover:bg-soft" style={{ color: "var(--danger)" }}><Trash2 size={15} /> Delete</button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 text-[12px] text-faint">
          <span className="flex items-center gap-1"><Download size={13} /> {cv.exports} exports</span>
          <span className="flex items-center gap-1"><Target size={13} /> ATS {computeAts(cv).score}</span>
        </div>
      </div>
    </div>
  );
}

function DashboardPage({ cvs, accent, user, onNew, onOpen, onDuplicate, onRename, onDelete, onExport, goTemplates }) {
  const totalExports = cvs.reduce((s, c) => s + (c.exports || 0), 0);
  const tplUsed = new Set(cvs.map((c) => c.template)).size;
  const avgAts = cvs.length ? Math.round(cvs.reduce((s, c) => s + computeAts(c).score, 0) / cvs.length) : 0;
  const recent = [...cvs].sort((a, b) => (a.lastEdited < b.lastEdited ? 1 : -1));
  return (
    <div className="anim-up">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
        <div>
          <h1 className="sa-display font-extrabold text-fg" style={{ fontSize: 28, letterSpacing: "-.02em" }}>Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
          <p className="text-muted text-[14px] mt-1">Pick up where you left off, or start a fresh resume.</p>
        </div>
        <Button variant="primary" onClick={onNew}><Plus size={17} /> New CV</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat icon={FileText} label="Resumes" value={cvs.length} />
        <Stat icon={Download} label="Total exports" value={totalExports} />
        <Stat icon={Layers} label="Templates used" value={tplUsed} />
        <Stat icon={Target} label="Avg. ATS score" value={cvs.length ? avgAts : "—"} />
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-bold text-fg">Recent CVs</h2>
            {cvs.length > 0 && <button onClick={goTemplates} className="text-[13px] text-accent font-semibold">Browse templates</button>}
          </div>
          {cvs.length === 0 ? (
            <div className="card p-10 text-center">
              <span className="grid place-items-center mx-auto rounded-2xl mb-4" style={{ width: 64, height: 64, background: "var(--accent-soft)", color: "var(--accent)" }}><FileText size={28} /></span>
              <h3 className="text-[17px] font-bold text-fg">No resumes yet</h3>
              <p className="text-muted text-[14px] mt-1.5 max-w-[340px] mx-auto">Create your first ATS-friendly resume in minutes. We'll start you off with a polished sample you can edit.</p>
              <div className="mt-5"><Button variant="primary" onClick={onNew}><Plus size={17} /> Create your first CV</Button></div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {recent.map((cv) => (
                <CvCard key={cv.id} cv={cv} accent={accent} onOpen={() => onOpen(cv.id)} onDuplicate={() => onDuplicate(cv.id)} onRename={() => onRename(cv.id)} onDelete={() => onDelete(cv.id)} onExport={() => onExport(cv.id)} />
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3"><span className="text-accent"><Lightbulb size={18} /></span><h3 className="text-[15px] font-bold text-fg">Quick tips</h3></div>
          <ul className="space-y-3">
            {[
              "Lead every bullet with a strong action verb — built, led, shipped.",
              "Quantify impact: percentages, time saved, users, revenue.",
              "Mirror the exact keywords from the job description.",
              "Keep it to one page unless you have 8+ years of experience.",
              "Use a single-column layout so parsers read top-to-bottom.",
            ].map((t, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] text-muted leading-relaxed"><CheckCircle2 size={16} className="text-accent shrink-0 mt-0.5" /> {t}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ============================ TEMPLATES ============================ */
const TEMPLATE_FILTERS = [
  { id: "all", label: "All Templates", icon: Layers },
  { id: "simple", label: "Simple", icon: FileText },
  { id: "modern", label: "Modern", icon: Sparkles },
  { id: "one-column", label: "One Column", icon: FileText },
  { id: "with-photo", label: "With Photo", icon: Upload },
  { id: "professional", label: "Professional", icon: Target },
  { id: "ats", label: "ATS", icon: ShieldCheck },
];

function TemplatesPage({ cvs, accent, defaultTemplate, onUse }) {
  const preview = useMemo(() => cvs[0] || newCv("Preview", true), [cvs]);
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? TEMPLATES : TEMPLATES.filter((t) => (t.tags || []).includes(filter));
  return (
    <div className="anim-up">
      <div className="text-center mb-6">
        <h1 className="sa-display font-extrabold text-fg" style={{ fontSize: 32, letterSpacing: "-.02em" }}>Choose a Template</h1>
        <p className="text-muted text-[15px] mt-2 max-w-[520px] mx-auto">Every template is ATS-friendly and exports to selectable-text PDF. Pick one to start building.</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {TEMPLATE_FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={cx("flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-all border", filter === f.id ? "bg-accent border-transparent" : "bg-soft border-base hover:border-accent")}
            style={filter === f.id ? { color: "var(--accent-fg)" } : {}}>
            <f.icon size={15} /> {f.label}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((t) => {
          const demo = { ...preview, template: t.id };
          return (
            <div key={t.id} className="card overflow-hidden hover-rise group">
              <div style={{ height: 260, background: "var(--doc-shell)", borderBottom: "1px solid var(--border)", overflow: "hidden", padding: "16px 16px 0" }}>
                <div style={{ pointerEvents: "none" }}><ScaledDoc cv={demo} accent={accent} /></div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-fg text-[15px]">{t.name}</h3>
                  <div className="flex gap-1.5">
                    {t.photo && <span className="chip text-[10px]" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>Photo</span>}
                    {(t.tags || []).includes("ats") && <span className="chip text-[10px]" style={{ background: "var(--good-soft)", color: "var(--good)" }}>ATS</span>}
                  </div>
                </div>
                <p className="text-[12.5px] text-muted mt-1 leading-relaxed">{t.blurb}</p>
                <div className="mt-3"><Button variant="primary" size="sm" onClick={() => onUse(t.id)}><Plus size={15} /> Use this template</Button></div>
              </div>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && <p className="text-center text-muted text-[14px] py-10">No templates in this category.</p>}
    </div>
  );
}

/* ============================ ATS CHECKER ============================ */
function AtsCheckerPage({ cvs, activeId, onOpen, onNew }) {
  const [sel, setSel] = useState(activeId || cvs[0]?.id);
  const cv = cvs.find((c) => c.id === sel) || cvs[0];
  if (!cv) return <EmptyPage icon={Target} title="No resume to analyze" body="Create a CV first, then run it through the ATS checker for a live score and fixes." cta="Create a CV" onCta={onNew} />;
  return (
    <div className="anim-up">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="sa-display font-extrabold text-fg" style={{ fontSize: 28, letterSpacing: "-.02em" }}>ATS Checker</h1>
          <p className="text-muted text-[14px] mt-1">A live, rule-based score with concrete fixes — no black box.</p>
        </div>
        <select className="sa-input" style={{ maxWidth: 260 }} value={cv.id} onChange={(e) => setSel(e.target.value)}>
          {cvs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid lg:grid-cols-[420px_1fr] gap-6 items-start">
        <div className="card p-6"><AtsPanel cv={cv} /></div>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-base">
            <span className="text-[13px] font-semibold text-muted">Live preview</span>
            <Button variant="ghost" size="sm" onClick={() => onOpen(cv.id)}><Pencil size={14} /> Edit</Button>
          </div>
          <div style={{ background: "var(--doc-shell)", padding: 20, maxHeight: 620, overflow: "auto" }}><ScaledDoc cv={cv} /></div>
        </div>
      </div>
    </div>
  );
}

/* ============================ JOB MATCH ============================ */
function JobMatchPage({ cvs, activeId, accent, onNew }) {
  const [sel, setSel] = useState(activeId || cvs[0]?.id);
  const [jd, setJd] = useState("");
  const [company, setCompany] = useState("");
  const [run, setRun] = useState(false);
  const [showCl, setShowCl] = useState(false);
  const [copied, setCopied] = useState(false);
  const cv = cvs.find((c) => c.id === sel) || cvs[0];
  const result = useMemo(() => (run && cv ? analyzeJobMatch(cv, jd) : null), [run, cv, jd]);
  const aiJob = useAiAction(aiAnalyzeJob);
  const aiCl = useAiAction(aiCoverLetter);
  const enoughJd = wordCount(jd) >= 10;
  if (!cv) return <EmptyPage icon={Search} title="No resume to match" body="Create a CV, paste a job description, and see exactly which keywords you're missing." cta="Create a CV" onCta={onNew} />;

  const runAiJob = () => aiJob.run({ jobDescription: jd, cvData: cv.data });
  const runCl = () => { setShowCl(true); setCopied(false); aiCl.run({ cvData: cv.data, jobDescription: jd, companyName: company, targetRole: cv.data.personalInfo?.jobTitle || "" }); };
  const copyCl = async () => { try { await navigator.clipboard.writeText(aiCl.data.coverLetter); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } };
  const downloadCl = () => {
    const blob = new Blob([aiCl.data.coverLetter], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${(cv.data.personalInfo?.fullName || cv.name).replace(/\s+/g, "_")}_Cover_Letter.txt`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const ai = aiJob.data;
  return (
    <div className="anim-up">
      <div className="mb-6">
        <h1 className="sa-display font-extrabold text-fg" style={{ fontSize: 28, letterSpacing: "-.02em" }}>Job Description Matching</h1>
        <p className="text-muted text-[14px] mt-1">Paste a posting for an instant offline match, or run a deeper AI analysis.</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold text-fg">Job description</span>
            <select className="sa-input" style={{ maxWidth: 180, padding: "6px 10px", fontSize: 13 }} value={cv.id} onChange={(e) => setSel(e.target.value)}>
              {cvs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Textarea rows={11} value={jd} onChange={(e) => { setJd(e.target.value); setRun(false); }} placeholder="Paste the full job description here — responsibilities, requirements, the lot…" />
          <div className="mt-2"><Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name (for cover letter, optional)" /></div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button variant="primary" onClick={() => setRun(true)} disabled={!enoughJd}><Search size={16} /> Analyze match</Button>
            <Button variant="secondary" onClick={runAiJob} disabled={!enoughJd || aiJob.loading}><Sparkles size={16} /> Analyze with AI</Button>
            <Button variant="ghost" onClick={runCl} disabled={!enoughJd || aiCl.loading}><FileSignature size={16} /> Cover letter</Button>
          </div>
          {!enoughJd && jd.length > 0 && <p className="text-[12px] text-faint mt-2">Paste a bit more text to analyze.</p>}
          {(aiJob.loading || aiJob.error) && <div className="mt-3"><AiSuggestionBox loading={aiJob.loading} error={aiJob.error} onRetry={runAiJob} /></div>}
        </div>

        <div className="card p-6">
          {ai ? (
            <div className="anim-in space-y-5">
              <div className="flex items-center justify-between">
                <span className="chip" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Sparkles size={12} /> AI analysis</span>
                <button className="text-[12px] text-faint hover:text-fg" onClick={aiJob.reset}>Show offline result</button>
              </div>
              <div className="flex flex-col items-center text-center">
                <ProgressRing value={ai.matchScore} label="AI Match" />
              </div>
              <KeywordBlock title="Matched" tone="good" icon={CheckCircle2} items={ai.matchedKeywords} empty="No direct matches found yet." />
              <KeywordBlock title="Missing" tone="danger" icon={XCircle} items={ai.missingKeywords} empty="You've covered the key terms." />
              {ai.recommendedSkills?.length > 0 && <KeywordBlock title="Recommended skills" tone="accent" icon={Zap} items={ai.recommendedSkills} />}
              {ai.summarySuggestions?.length > 0 && <AdviceBlock title="Summary suggestions" items={ai.summarySuggestions} />}
              {ai.bulletSuggestions?.length > 0 && <AdviceBlock title="Bullet ideas (grounded in your experience)" items={ai.bulletSuggestions} />}
            </div>
          ) : !result ? (
            <div className="h-full grid place-items-center text-center py-10">
              <div>
                <span className="grid place-items-center mx-auto rounded-2xl mb-3" style={{ width: 56, height: 56, background: "var(--accent-soft)", color: "var(--accent)" }}><Target size={26} /></span>
                <p className="text-muted text-[14px] max-w-[260px]">Your match score and missing keywords will appear here.</p>
              </div>
            </div>
          ) : (
            <div className="anim-in space-y-5">
              <div className="flex flex-col items-center text-center">
                <ProgressRing value={result.pct} label="Match" />
                <p className="text-[13px] text-muted mt-3">{result.matched.length} of {result.keywords.length} key terms found in your CV.</p>
              </div>
              <KeywordBlock title="Matched" tone="good" icon={CheckCircle2} items={result.matched} count empty="None yet — add some of the terms below." />
              <KeywordBlock title="Missing" tone="danger" icon={XCircle} items={result.missing} count empty="Great — you've covered every key term." />
              {result.missing.length > 0 && (
                <div className="rounded-xl p-3.5 text-[13px] text-muted leading-relaxed" style={{ background: "var(--accent-soft)" }}>
                  <span className="font-semibold text-fg flex items-center gap-1.5 mb-1"><Wand2 size={15} className="text-accent" /> Suggestion</span>
                  Weave the missing terms into your <strong>Skills</strong> and <strong>Experience</strong> bullets — only where they're true. Mirroring the posting's exact wording is what lifts your match.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal open={showCl} onClose={() => setShowCl(false)} title="AI cover letter" max={640}>
        {aiCl.loading ? (
          <div className="flex items-center gap-2 text-[14px] text-muted py-6 justify-center"><Loader2 size={18} className="text-accent" style={{ animation: "spin 1s linear infinite" }} /> Writing your cover letter…</div>
        ) : aiCl.error ? (
          <div className="flex items-start gap-2 text-[14px] py-2" style={{ color: "var(--danger)" }}><AlertCircle size={18} className="shrink-0 mt-0.5" /><span>{aiCl.error} <button className="underline font-semibold" onClick={runCl}>Retry</button></span></div>
        ) : aiCl.data ? (
          <div>
            <div className="rounded-xl p-4 text-[13.5px] text-fg leading-relaxed" style={{ background: "var(--surface-2, var(--accent-soft))", whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto" }}>{aiCl.data.coverLetter}</div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="ghost" onClick={copyCl}>{copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}</Button>
              <Button variant="secondary" onClick={downloadCl}><Download size={15} /> Download</Button>
              <Button variant="primary" onClick={runCl}><RefreshCw size={15} /> Regenerate</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function KeywordBlock({ title, tone, icon: Icon, items = [], empty, count }) {
  const c = { good: "var(--good)", danger: "var(--danger)", accent: "var(--accent)" }[tone];
  const soft = { good: "var(--good-soft)", danger: "var(--danger-soft)", accent: "var(--accent-soft)" }[tone];
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-[13px] font-bold text-fg"><Icon size={16} style={{ color: c }} /> {title}{count ? ` (${items.length})` : ""}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.length ? items.map((k, i) => <span key={k + i} className="chip" style={{ background: soft, color: c }}>{k}</span>) : <span className="text-[13px] text-faint">{empty}</span>}
      </div>
    </div>
  );
}
function AdviceBlock({ title, items = [] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-[13px] font-bold text-fg"><Lightbulb size={16} className="text-accent" /> {title}</div>
      <ul className="space-y-1.5">{items.map((t, i) => <li key={i} className="flex gap-2 text-[13px] text-muted leading-relaxed"><span className="text-accent mt-0.5">•</span> {t}</li>)}</ul>
    </div>
  );
}

/* ============================ SETTINGS ============================ */
function SettingsPage({ theme, setTheme, accent, setAccent, defaultTemplate, setDefaultTemplate, onClearAll }) {
  const [confirm, setConfirm] = useState(false);
  const accents = [{ id: "emerald", hex: "#059669" }, { id: "blue", hex: "#2563eb" }, { id: "gold", hex: "#b58a16" }];
  return (
    <div className="anim-up max-w-[680px]">
      <div className="mb-7">
        <h1 className="sa-display font-extrabold text-fg" style={{ fontSize: 28, letterSpacing: "-.02em" }}>Settings</h1>
        <p className="text-muted text-[14px] mt-1">Personalize the workspace. Your data stays in your browser.</p>
      </div>
      <div className="space-y-5">
        <div className="card p-5">
          <h3 className="text-[15px] font-bold text-fg mb-1">Appearance</h3>
          <p className="text-[13px] text-muted mb-4">Switch between light and dark.</p>
          <div className="flex gap-2">
            {[{ id: "light", icon: Sun, label: "Light" }, { id: "dark", icon: Moon, label: "Dark" }].map((m) => (
              <button key={m.id} onClick={() => setTheme(m.id)} className={cx("btn", theme === m.id ? "btn-primary" : "btn-secondary")}><m.icon size={16} /> {m.label}</button>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-[15px] font-bold text-fg mb-1">Accent color</h3>
          <p className="text-[13px] text-muted mb-4">Used across the interface — never inside ATS exports.</p>
          <div className="flex gap-3">
            {accents.map((a) => (
              <button key={a.id} onClick={() => setAccent(a.id)} className="grid place-items-center rounded-full transition" style={{ width: 38, height: 38, background: a.hex, outline: accent === a.id ? "3px solid var(--ring)" : "none", outlineOffset: 2 }} title={a.id}>
                {accent === a.id && <Check size={18} color="#fff" />}
              </button>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-[15px] font-bold text-fg mb-1">Default template</h3>
          <p className="text-[13px] text-muted mb-4">New resumes start with this template.</p>
          <select className="sa-input" style={{ maxWidth: 280 }} value={defaultTemplate} onChange={(e) => setDefaultTemplate(e.target.value)}>
            {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="card p-5" style={{ borderColor: "var(--danger)" }}>
          <h3 className="text-[15px] font-bold text-fg mb-1">Danger zone</h3>
          <p className="text-[13px] text-muted mb-4">Permanently delete all saved resumes and settings from this browser.</p>
          <Button variant="danger" onClick={() => setConfirm(true)}><Trash2 size={16} /> Clear all data</Button>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1"><ShieldCheck size={18} className="text-accent" /><h3 className="text-[15px] font-bold text-fg">About</h3></div>
          <p className="text-[13px] text-muted leading-relaxed">Smart ATS CV Builder is a fully client-side resume tool. The ATS score and job-match engines are transparent, rule-based heuristics — no resume data ever leaves your device. Export produces a selectable-text PDF via your browser's print dialog.</p>
        </div>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Clear all data?" max={420}>
        <p className="text-[14px] text-muted leading-relaxed">This will permanently delete every saved resume and reset your preferences. This can't be undone.</p>
        <div className="flex gap-2 justify-end mt-5">
          <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { setConfirm(false); onClearAll(); }}><Trash2 size={16} /> Delete everything</Button>
        </div>
      </Modal>
    </div>
  );
}

function EmptyPage({ icon: Icon, title, body, cta, onCta }) {
  return (
    <div className="anim-up grid place-items-center" style={{ minHeight: "60vh" }}>
      <div className="card p-10 text-center max-w-[420px]">
        <span className="grid place-items-center mx-auto rounded-2xl mb-4" style={{ width: 64, height: 64, background: "var(--accent-soft)", color: "var(--accent)" }}><Icon size={28} /></span>
        <h3 className="text-[18px] font-bold text-fg">{title}</h3>
        <p className="text-muted text-[14px] mt-1.5">{body}</p>
        <div className="mt-5"><Button variant="primary" onClick={onCta}><Plus size={17} /> {cta}</Button></div>
      </div>
    </div>
  );
}

/* ============================ TOASTS ============================ */
function Toasts({ toasts, dismiss }) {
  return (
    <div className="fixed z-[60] bottom-5 right-5 left-5 sm:left-auto flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => {
        const Icon = t.type === "error" ? AlertCircle : t.type === "info" ? Sparkles : CheckCircle2;
        const tone = t.type === "error" ? "var(--danger)" : t.type === "info" ? "var(--accent)" : "var(--good)";
        return (
          <div key={t.id} className="card shadow-deep px-4 py-3 flex items-center gap-2.5 anim-pop pointer-events-auto" style={{ maxWidth: 360 }}>
            <Icon size={18} style={{ color: tone }} />
            <span className="text-[13.5px] text-fg flex-1">{t.msg}</span>
            <button onClick={() => dismiss(t.id)} className="text-faint hover:text-fg"><X size={15} /></button>
          </div>
        );
      })}
    </div>
  );
}

/* ============================ APP LAYOUT ============================ */
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "builder", label: "Builder", icon: Pencil },
  { id: "templates", label: "Templates", icon: Layers },
  { id: "ats", label: "ATS Checker", icon: Target },
  { id: "jobmatch", label: "Job Match", icon: Search },
  { id: "settings", label: "Settings", icon: Settings },
];

function AppLayout({ view, setView, theme, toggleTheme, user, onSignOut, onSignIn, onLogo, children }) {
  const [open, setOpen] = useState(false);
  const NavList = ({ onPick }) => (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => (
        <button key={n.id} onClick={() => { setView(n.id); onPick?.(); }} className={cx("nav-item", view === n.id && "nav-active")}>
          <n.icon size={18} /> <span>{n.label}</span>
        </button>
      ))}
    </nav>
  );
  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      {/* desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[244px] shrink-0 border-r border-base p-4 sticky top-0 h-screen" style={{ background: "var(--surface)" }}>
        <div className="px-2 py-2 mb-4"><Brand onClick={onLogo} /></div>
        <NavList />
        <div className="mt-auto">
          <button onClick={toggleTheme} className="nav-item w-full">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}<span>{theme === "dark" ? "Light mode" : "Dark mode"}</span></button>
          <div className="border-t border-base my-3" />
          {user?.guest ? (
            <button onClick={onSignIn} className="nav-item w-full" style={{ color: "var(--accent)" }}><LogOut size={18} /><span>Sign in / Sign up</span></button>
          ) : (
            <div className="flex items-center gap-2.5 px-2">
              <span className="grid place-items-center rounded-full bg-accent shrink-0" style={{ width: 34, height: 34, fontSize: 13, fontWeight: 700 }}>{(user?.name || "G")[0].toUpperCase()}</span>
              <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-fg truncate">{user?.name || "Guest"}</div><div className="text-[11.5px] text-faint truncate">{user?.email || "local session"}</div></div>
              <IconButton title="Sign out" onClick={onSignOut}><LogOut size={16} /></IconButton>
            </div>
          )}
        </div>
      </aside>

      {/* mobile slide-over */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 anim-in" onClick={() => setOpen(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(8,12,18,.5)" }} />
          <div className="absolute left-0 top-0 h-full w-[260px] p-4 anim-side flex flex-col" style={{ background: "var(--surface)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-1 mb-4"><Brand onClick={() => { onLogo?.(); setOpen(false); }} /><IconButton title="Close" onClick={() => setOpen(false)}><X size={18} /></IconButton></div>
            <NavList onPick={() => setOpen(false)} />
            <div className="mt-auto">
              <button onClick={toggleTheme} className="nav-item w-full">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}<span>{theme === "dark" ? "Light mode" : "Dark mode"}</span></button>
              {user?.guest ? (
                <button onClick={() => { setOpen(false); onSignIn?.(); }} className="nav-item w-full" style={{ color: "var(--accent)" }}><LogOut size={18} /><span>Sign in / Sign up</span></button>
              ) : (
                <button onClick={onSignOut} className="nav-item w-full"><LogOut size={18} /><span>Sign out</span></button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-base" style={{ background: "var(--surface)" }}>
          <IconButton title="Menu" onClick={() => setOpen(true)}><Menu size={20} /></IconButton>
          <Brand size={16} onClick={onLogo} />
          <IconButton title="Theme" onClick={toggleTheme}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</IconButton>
        </header>
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1240px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

/* ============================ ROOT APP ============================ */
const CVS_KEY = "smartats:v1:cvs";
const SETTINGS_KEY = "smartats:v1:settings";
const hasArtifactStore = typeof window !== "undefined" && window.storage && typeof window.storage.get === "function";
const store = {
  async get(k) {
    try {
      if (hasArtifactStore) { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; }
      if (typeof localStorage !== "undefined") { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }
      return null;
    } catch { return null; }
  },
  async set(k, v) {
    try {
      if (hasArtifactStore) { await window.storage.set(k, JSON.stringify(v), false); return; }
      if (typeof localStorage !== "undefined") localStorage.setItem(k, JSON.stringify(v));
    } catch { /* ignore */ }
  },
};

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("landing");        // landing | dashboard | builder | templates | ats | jobmatch | settings | auth
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser] = useState(null);
  const [cvs, setCvs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [theme, setTheme] = useState("light");
  const [accent, setAccent] = useState("emerald");
  const [defaultTemplate, setDefaultTemplate] = useState("modern");
  const [toasts, setToasts] = useState([]);
  const [printTarget, setPrintTarget] = useState(null);

  const pushToast = useCallback((msg, type = "success") => {
    const id = uid();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const dismissToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  /* Supabase auth + data */
  const loadCvsFromDb = useCallback(async (uid) => {
    if (!supabase) return;
    const { data } = await supabase.from("cvs").select("*").eq("user_id", uid).order("updated_at", { ascending: false });
    if (data) setCvs(data.map((r) => ({ id: r.id, name: r.name, template: r.template, created: r.created_at, lastEdited: r.updated_at, exports: r.exports || 0, config: r.config || {}, data: r.data || {} })));
  }, []);

  const saveCvToDb = useCallback(async (cv) => {
    if (!supabase || !user) return;
    await supabase.from("cvs").upsert({ id: cv.id, user_id: user.id, name: cv.name, template: cv.template, data: cv.data, config: cv.config, exports: cv.exports || 0, updated_at: new Date().toISOString() }, { onConflict: "id" });
  }, [user]);

  const deleteCvFromDb = useCallback(async (id) => {
    if (!supabase) return;
    await supabase.from("cvs").delete().eq("id", id);
  }, []);

  /* load persisted state — check supabase session first, fallback to localStorage */
  useEffect(() => {
    (async () => {
      const s = await store.get(SETTINGS_KEY);
      if (s) { s.theme && setTheme(s.theme); s.accent && setAccent(s.accent); s.defaultTemplate && setDefaultTemplate(s.defaultTemplate); }
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const u = session.user;
          setUser({ id: u.id, name: u.user_metadata?.name || u.email?.split("@")[0], email: u.email });
          await loadCvsFromDb(u.id);
          setView("dashboard");
          setLoaded(true);
          return;
        }
      }
      // No session — leave user null so Landing page shows
      setLoaded(true);
    })();
  }, []); // eslint-disable-line

  /* listen for auth changes */
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") { setUser(null); setCvs([]); setActiveId(null); setView("landing"); }
    });
    return () => subscription?.unsubscribe();
  }, []);

  /* persist settings locally, CVs to supabase */
  const t1 = useRef(), t2 = useRef();
  useEffect(() => { if (!loaded) return; clearTimeout(t2.current); t2.current = setTimeout(() => store.set(SETTINGS_KEY, { theme, accent, defaultTemplate }), 400); }, [theme, accent, defaultTemplate, loaded]);

  /* debounced save active CV — supabase for logged-in, localStorage for guest */
  useEffect(() => {
    if (!loaded) return;
    const cv = cvs.find((c) => c.id === activeId);
    if (!cv) return;
    clearTimeout(t1.current);
    t1.current = setTimeout(() => {
      if (user?.id && !user?.guest) saveCvToDb(cv);
      // Guest CVs are session-only — not saved anywhere
    }, 800);
  }, [cvs, activeId, loaded, user, saveCvToDb]);

  /* print -> PDF */
  useEffect(() => {
    if (!printTarget) return;
    const cv = cvs.find((c) => c.id === printTarget);
    const prevTitle = document.title;
    if (cv) document.title = `${(cv.data.personalInfo.fullName || cv.name).replace(/\s+/g, "_")}_CV`;
    const done = () => { document.title = prevTitle; setPrintTarget(null); };
    window.addEventListener("afterprint", done, { once: true });
    const id = setTimeout(() => { window.print(); }, 120);
    setCvs((list) => list.map((c) => (c.id === printTarget ? { ...c, exports: (c.exports || 0) + 1 } : c)));
    return () => { clearTimeout(id); window.removeEventListener("afterprint", done); };
  }, [printTarget]); // eslint-disable-line

  /* CV handlers */
  const update = useCallback((fn) => {
    setCvs((list) => list.map((c) => {
      if (c.id !== activeId) return c;
      const draft = JSON.parse(JSON.stringify(c));
      fn(draft); draft.lastEdited = todayISO();
      return draft;
    }));
  }, [activeId]);

  const createCv = (template = defaultTemplate, withSample = true, open = true) => {
    const cv = newCv(`Untitled CV ${cvs.length + 1}`, withSample);
    cv.template = template;
    setCvs((l) => [cv, ...l]); setActiveId(cv.id);
    if (open) setView("builder");
    if (user?.id && !user?.guest) saveCvToDb(cv);
    pushToast("New CV created");
    return cv;
  };
  const openCv = (id) => { setActiveId(id); setView("builder"); };
  const duplicateCv = (id) => {
    const src = cvs.find((c) => c.id === id); if (!src) return;
    const copy = JSON.parse(JSON.stringify(src)); copy.id = uid(); copy.name = `${src.name} (copy)`; copy.created = todayISO(); copy.lastEdited = todayISO(); copy.exports = 0;
    setCvs((l) => [copy, ...l]); pushToast("CV duplicated");
  };
  const removeCv = (id) => { setCvs((l) => l.filter((c) => c.id !== id)); if (activeId === id) setActiveId(null); if (user?.id && !user?.guest) deleteCvFromDb(id); pushToast("CV deleted", "info"); };
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const startRename = (id) => { const c = cvs.find((x) => x.id === id); setRenaming(id); setRenameVal(c?.name || ""); };
  const commitRename = () => { setCvs((l) => l.map((c) => (c.id === renaming ? { ...c, name: renameVal.trim() || c.name, lastEdited: todayISO() } : c))); setRenaming(null); pushToast("Renamed"); };
  const renameActive = (name) => setCvs((l) => l.map((c) => (c.id === activeId ? { ...c, name, lastEdited: todayISO() } : c)));
  const setTemplate = (tpl) => update((x) => { x.template = tpl; });
  const exportCv = (id) => { setPrintTarget(id); pushToast("Opening print dialog…", "info"); };

  const useTemplate = (tpl) => {
    createCv(tpl, true);
  };

  const handleAuth = async ({ email, password, name, mode }) => {
    if (!supabase) return { error: "Auth not configured" };
    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) return { error: error.message };
      pushToast("Reset link sent — check your email", "info");
      return {};
    }
    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
      if (error) return { error: error.message };
      if (data?.user) {
        setUser({ id: data.user.id, name: name || email.split("@")[0], email });
        setView("dashboard");
        pushToast(`Welcome, ${name || email.split("@")[0]}!`);
      }
      return {};
    }
    // login
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data?.user) {
      const u = data.user;
      setUser({ id: u.id, name: u.user_metadata?.name || email.split("@")[0], email });
      await loadCvsFromDb(u.id);
      setView("dashboard");
      pushToast(`Welcome back, ${u.user_metadata?.name || email.split("@")[0]}!`);
    }
    return {};
  };
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); setUser(null); setCvs([]); setActiveId(null); setView("landing"); };
  const clearAll = () => { setCvs([]); setActiveId(null); setDefaultTemplate("modern"); store.set(CVS_KEY, []); pushToast("All data cleared", "info"); };

  const startBuild = () => {
    if (!user) setUser({ name: "Guest", email: "local session", guest: true });
    setView("templates");
  };

  const activeCv = cvs.find((c) => c.id === activeId);
  const selForTools = activeCv || cvs[0];

  const page = () => {
    switch (view) {
      case "dashboard": return <DashboardPage cvs={cvs} accent={accent} user={user} onNew={() => setView("templates")} onOpen={openCv} onDuplicate={duplicateCv} onRename={startRename} onDelete={removeCv} onExport={exportCv} goTemplates={() => setView("templates")} />;
      case "builder":
        return activeCv
          ? <BuilderPage cv={activeCv} update={update} setTemplate={setTemplate} rename={renameActive} onExport={() => exportCv(activeCv.id)} onBack={() => setView("dashboard")} accent={accent} pushToast={pushToast} />
          : <EmptyPage icon={Pencil} title="No CV open" body="Open a resume from your dashboard, or create a new one to start editing." cta="Choose a template" onCta={() => setView("templates")} />;
      case "templates": return <TemplatesPage cvs={cvs} accent={accent} defaultTemplate={defaultTemplate} onUse={useTemplate} />;
      case "ats": return <AtsCheckerPage cvs={cvs} activeId={activeId} onOpen={openCv} onNew={() => setView("templates")} />;
      case "jobmatch": return <JobMatchPage cvs={cvs} activeId={activeId} accent={accent} onNew={() => setView("templates")} />;
      case "settings": return <SettingsPage theme={theme} setTheme={setTheme} accent={accent} setAccent={setAccent} defaultTemplate={defaultTemplate} setDefaultTemplate={setDefaultTemplate} onClearAll={clearAll} />;
      case "auth": return (
        <div className="grid place-items-center anim-up" style={{ minHeight: "70vh" }}>
          <div className="card p-8 w-full max-w-[420px]">
            <h1 className="text-fg font-extrabold sa-display" style={{ fontSize: 24 }}>{authMode === "register" ? "Create your account" : authMode === "forgot" ? "Reset password" : "Welcome back"}</h1>
            <p className="text-muted text-[14px] mt-1.5 mb-5">{authMode === "register" ? "Free forever. No credit card." : authMode === "forgot" ? "We'll email you a reset link." : "Sign in to save your work to the cloud."}</p>
            <AuthFormInline mode={authMode} setMode={setAuthMode} onAuth={handleAuth} />
          </div>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className={cx("sa-root", theme === "dark" && "dark")} data-accent={accent}>
      <style>{STYLES}</style>

      <div className="screen-only">
        {!loaded ? (
          <div className="min-h-screen grid place-items-center" style={{ background: "var(--bg)" }}>
            <div className="flex flex-col items-center gap-3 anim-in"><span className="grid place-items-center bg-accent rounded-2xl shadow-soft" style={{ width: 52, height: 52 }}><FileText size={26} /></span><div className="text-[13px] text-faint">Loading your workspace…</div></div>
          </div>
        ) : view === "landing" ? (
          <Landing onStart={() => { if (!user) setUser({ name: "Guest", email: "local session", guest: true }); setView("templates"); }} goTemplates={() => { if (!user) setUser({ name: "Guest", email: "local session", guest: true }); setView("templates"); }} theme={theme} toggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} onLogin={() => { if (!user) setUser({ name: "Guest", email: "local session", guest: true }); setAuthMode("login"); setView("auth"); }} user={user} onLogout={signOut} onDashboard={() => setView("dashboard")} />
        ) : (
          <AppLayout view={view} setView={setView} theme={theme} toggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} user={user} onSignOut={signOut} onSignIn={() => { setAuthMode("login"); setView("auth"); }} onLogo={() => setView("landing")}>
            {user?.guest && view === "dashboard" && (
              <div className="card p-4 flex items-center justify-between gap-4 mb-6 anim-in" style={{ background: "var(--accent-soft)", borderColor: "var(--accent)" }}>
                <div className="flex items-center gap-3">
                  <ShieldCheck size={20} className="text-accent shrink-0" />
                  <div className="text-[13.5px] text-fg">You're using as <strong>Guest</strong> — your CVs are saved in this browser only. <strong>Sign up free</strong> to save to the cloud and access from any device.</div>
                </div>
                <Button variant="primary" size="sm" onClick={() => { setAuthMode("register"); setView("auth"); }}>Sign up</Button>
              </div>
            )}
            {page()}
          </AppLayout>
        )}
      </div>

      {/* print layer — selectable-text, ATS-safe */}
      {printTarget && (() => { const cv = cvs.find((c) => c.id === printTarget); return cv ? <div className="print-only"><ResumeDocument cv={cv} accent={accent} /></div> : null; })()}

      {/* rename modal */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Rename CV" max={420}>
        <Field label="CV name"><Input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commitRename()} /></Field>
        <div className="flex gap-2 justify-end mt-4"><Button variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button><Button variant="primary" onClick={commitRename}>Save</Button></div>
      </Modal>

      <div className="screen-only"><Toasts toasts={toasts} dismiss={dismissToast} /></div>
    </div>
  );
}
