# Smart ATS CV Builder — Project Handout

> Complete copy-paste content + technical brief for portfolio pages, documentation, or AI-assisted site building.
> Replace `[LIVE_DEMO_URL]` with your real link once deployed.

---

# Part 1 — Portfolio-Ready Copy

## Project Overview

**Smart ATS CV Builder** — an AI-powered resume builder that produces clean, selectable-text, ATS-friendly CVs with live scoring, job-description matching, and human-in-the-loop AI writing assistance.

Tagline: *Build a CV that actually passes the robots — and impresses the humans.*

Short description (2–3 sentences):
> A full-stack CV builder built with React and Vite. Users pick from 13 ATS-safe templates, edit 10 CV sections with drag-and-drop, get a transparent 0–100 ATS score, match their CV against any job description, and optionally use AI (via a secure serverless proxy) to improve summaries, rewrite bullets, and generate cover letters — with every suggestion reviewed before it is applied. CVs sync to Supabase for signed-in users; the whole app still works offline without the AI backend.

## Key Highlights

- **Zero-dependency PDF export** — print-CSS + A4 scaling produces selectable-text PDFs (no jsPDF/html2canvas); filename auto-set via `document.title`.
- **Transparent ATS engine** — a fully explainable, client-side rubric (0–100) with strengths, weaknesses, and actionable tips — not a mystery number.
- **Human-in-the-loop AI** — every AI result opens in a review box; nothing is auto-applied. Length/tone/custom-instruction controls included.
- **Provider-agnostic AI backend** — one env-var switch between OpenAI, Claude, Gemini, Groq, and OpenRouter; API keys never touch the frontend.
- **Graceful degradation** — deploy without any AI key and the app still offers offline bullet suggestions, rule-based ATS scoring, and keyword job-matching.
- **Full CRUD + cloud sync** — Supabase auth and JSONB persistence with debounced autosave; guest mode works fully client-side with zero setup.

## Tech Stack

- [React 18](https://react.dev/) — UI library (single-file architecture, ~2,600 lines, layered sections)
- [Vite 5](https://vite.dev/) — build tool & dev server
- [Tailwind CSS 3](https://tailwindcss.com/) — utility-first styling + CSS custom-property theming (dark mode, 3 accent themes)
- [Supabase](https://supabase.com/) — email/password auth + Postgres (single `cvs` table, JSONB data)
- [Vercel Serverless Functions](https://vercel.com/) — 6 AI API routes sharing a common prompt/client layer
- No UI framework, no PDF library, no router — vanilla where it counts.

## Features

1. **13 ATS-safe templates** — classic, modern, developer, engineering, executive, sidebar (2-col), bold, minimal, timeline, accentbar, photo, elegant, split (2-col); all single-purpose CSS skins with a shared render engine.
2. **Design controls** — 10 accent colors, 6 font overrides, 3 spacing modes, per-section visibility toggles, and drag-to-reorder sections, entries, and bullets.
3. **10 editable CV sections** — personal info (with photo upload), summary (live word-count meter), categorized skills, experience, projects, education, certifications, languages, achievements, volunteer work, plus user-defined custom sections.
4. **Live ATS score** — 0–100 heuristic covering contact completeness, summary quality, skills coverage, quantified bullets, action-verb usage, and formatting; shown on dashboard cards, in a dedicated checker page, and in a builder modal.
5. **Job Match analysis** — paste a job description to get matched/missing keyword chips and a match percentage; powered by an offline keyword engine (≈120-term tech lexicon + stopword filter) with an optional AI deep-dive.
6. **5 AI tools** — improve summary, improve bullets, generate bullets, analyze job description, generate cover letter. Each returns into a review box with Apply / Discard / Regenerate.
7. **Cover letter generation** — 3–4 paragraph letters grounded only in the candidate's real CV data; copy-to-clipboard or download as `.txt`.
8. **Dashboard & analytics** — total resumes, total exports, templates used, average ATS score; per-card live scores and export counters.
9. **Cloud sync** — sign up, and every CV autosaves to Supabase (debounced, 800 ms); guest sessions are fully local and private.
10. **Dark mode + theming** — class-based dark theme, 3 UI accent colors, animated landing page, responsive layouts (mobile slide-over nav, edit/preview tabs).

## Links

- **Live demo:** `[LIVE_DEMO_URL]`
- **Source code:** https://github.com/subzero7142856112-dotcom/smart-ats-cv-builder

## Project Structure

```
cv-builder-app/
├── src/
│   ├── App.jsx              # entire app: utils, engines, templates, pages (~2,600 lines)
│   ├── main.jsx             # entry
│   ├── index.css            # tailwind + design tokens
│   └── lib/supabase.js      # Supabase client (null-safe if unconfigured)
├── api/                     # Vercel serverless functions
│   ├── improve-summary.js
│   ├── improve-bullets.js
│   ├── generate-bullets.js
│   ├── analyze-job-description.js
│   ├── ats-score.js
│   └── generate-cover-letter.js
├── server/                  # shared backend logic (used by api/* and dev server)
│   ├── aiClient.js          # provider-agnostic AI client (openai/claude/gemini/groq/openrouter)
│   ├── prompts.js           # all prompt construction + ground rules (no fabrication)
│   ├── cvContext.js         # CV → compact facts context for prompts
│   └── respond.js           # request handler wrapper
├── dev-server.mjs           # local API server on :3001 (vite proxies /api here)
├── vite.config.js           # react plugin + /api proxy
├── vercel.json              # SPA rewrites, cache + security headers, region fra1
└── package.json             # scripts: dev, api, build, preview
```

---

# Part 2 — Technical Handout

*For developers, technical reviewers, or AI assistants building pages/docs from this project.*

## Architecture

**Frontend:** one `src/App.jsx` file organized in documented layers, in order:
1. **Utilities** — `uid()`, `cx()`, email/phone validators, date formatting, word counting.
2. **Pure engines** — `computeAts()`, `analyzeJobMatch()`, `extractKeywords()`, static `SUGGESTIONS` library. No React — testable pure functions.
3. **`ResumeDocument`** — theme-independent CV renderer with three layout engines (single-column, sidebar 2-col, split 2-col) + 13 template skins.
4. **Pages** — Landing / Auth / Dashboard / Builder / Templates / ATS / Job Match / Settings.
5. **App shell** — string-based view routing (no react-router), theme/accent via CSS variables, debounced persistence.

**State:** plain `useState` in the root component — `view`, `user`, `cvs[]`, `activeId`, `theme`, `accent`, `defaultTemplate`, `toasts`, `printTarget`. A CV object is `{ id, name, template, created, lastEdited, exports, config{...}, data{...} }` where `config` holds section order/visibility/accent/font/spacing and `data` holds all content as JSONB-friendly plain objects.

**Backend:** Vercel serverless functions in `api/` (one file per endpoint). All AI logic is shared via `server/`:
- `aiClient.js` — `chat()` and `chatJSON()`; OpenAI-compatible dialect reused for OpenAI/Groq/OpenRouter; native adapters for Claude (Messages API) and Gemini (generateContent). Typed errors: `AiConfigError`, `AiProviderError`.
- `prompts.js` — every prompt built in one place with hard ground rules: never invent employers, degrees, metrics, or achievements; only rephrase what the candidate supplied. Length guide (short/medium/detailed) and tone guide (formal/technical/creative) appended per request.
- `respond.js` — thin wrapper adding body parsing, method checks, and uniform JSON error responses.

**Local dev:** `vite.config.js` proxies `/api/*` → `http://localhost:3001`; `node --env-file=.env dev-server.mjs` hosts the same handlers Node-side with CORS. In production, Vercel serves `api/` as serverless functions and rewrites everything else to `index.html` (SPA fallback).

## AI Endpoints

| Endpoint | Input | Output |
|---|---|---|
| `POST /api/improve-summary` | summary, targetRole, cvData, length, tone, customInstructions | `improvedSummary` |
| `POST /api/improve-bullets` | bullets[], sectionType, targetRole, cvData, options | `improvedBullets[]` |
| `POST /api/generate-bullets` | role, company, sectionType, cvData, count, options | `generatedBullets[]` |
| `POST /api/analyze-job-description` | jobDescription, cvData | `matchScore, matchedKeywords[], missingKeywords[], recommendedSkills[], summarySuggestions[], bulletSuggestions[]` |
| `POST /api/generate-cover-letter` | cvData, jobDescription, companyName, targetRole | `coverLetter` |
| `POST /api/ats-score` | cvData, jobDescription? | `score, strengths[], weaknesses[], suggestions[]` (server-side variant; the frontend uses the offline engine) |

**Configuration (server env only):**
```
AI_API_KEY   = secret key
AI_PROVIDER  = openai | claude | gemini | groq | openrouter   (default: openai)
AI_MODEL     = e.g. gpt-4o-mini | claude-3-5-sonnet-latest | gemini-1.5-flash | llama-3.3-70b-versatile
```
Switching providers = changing two env vars, zero code changes. `chatJSON` appends a "valid JSON only" instruction and tolerantly parses fenced/prose-wrapped JSON.

**Security:** the API key lives only in serverless env vars. The frontend calls same-origin `/api/*` (or an optional `VITE_AI_API_BASE` override). No AI secrets are bundled into client JS.

## ATS Scoring Rubric (offline engine, `computeAts`)

Client-side, deterministic, explainable. Returns `{ score, strengths[], weaknesses[], tips[] }`.

| Category | Points | Criteria |
|---|---|---|
| Contact | 24 | email 8, phone 6, location 4, LinkedIn 4, GitHub/portfolio 2 |
| Summary | 12 | exists 6, 30–90 words 6 |
| Skills | 12 | exists 8, ≥8 keywords 4 |
| Experience | 18 | exists 8, quantified bullets (digits/%) 6, action-verb starts (40-verb lexicon) 4 |
| Projects | 12 | exists 8, has bullets 4 |
| Education | 8 | present |
| Formatting | 10 | no bullet >40 words 6, single-column/table-free layout 4 |
| Extras | 4 | certifications 2, languages 1, achievements 1 |

Color-coded UI ring: green ≥75, amber ≥50, red below. Optional job-keyword coverage check warns on missing terms.

## Job-Match Keyword Engine (offline)

`extractKeywords(text)`: tokenize → strip ~130 stopwords → match against a ~120-term tech lexicon (languages, frameworks, DBs, cloud/DevOps, testing, ML, hardware/EDA, design; multi-word phrases weighted ×3, lexicon hits ×3) → top 26 keywords. `analyzeJobMatch(cv, jd)` compares against the CV's full plain text and returns matched/missing chips + a percentage. Honest UX: suggests only adding terms "where they're true."

## Supabase Schema

Single table `cvs`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | client-generated `crypto.randomUUID()`, upsert conflict key |
| `user_id` | uuid | `auth.uid()`; every query is scoped `.eq("user_id", uid)` (expects RLS) |
| `name` | text | display name |
| `template` | text | template id |
| `data` | jsonb | all CV content |
| `config` | jsonb | order, visible, accentColor, fontOverride, spacing |
| `exports` | int | export counter |
| `updated_at` | timestamptz | set on every upsert, used for ordering |
| `created_at` | timestamptz | server-managed |

Auth: email/password `signUp` (name in `user_metadata.name`), `signInWithPassword`, `resetPasswordForEmail`, `signOut`, session restore via `getSession()` on boot + `onAuthStateChange`. If `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are missing, the client exports `null` and the app runs guest-only — no crash.

## Design System

- **Theming:** CSS custom properties; dark mode via `class`; 3 UI accents (`data-accent`: emerald/blue/gold); `color-scheme` respected.
- **`ScaledDoc` component:** renders the document at a fixed 794×1123 px (A4 @ 96 dpi) and CSS-transform-scales it to any container width, with a `ResizeObserver` correcting wrapper height. Used on the landing hero, dashboard cards, template gallery, and builder preview.
- **Print:** `.screen-only` / `.print-only` split; `@page { size: A4; margin: 0 }`; `document.title` set to `FullName_CV` so the browser's Save-as-PDF defaults to a clean filename. `afterprint` restores state.
- **Editing primitives:** `Repeater` (generic add/remove/drag-reorder with arm/disarm grip + move up/down), `BulletEditor` (per-bullet DnD + offline suggestions + AI assist), `TagInput` (chip entry, Enter/comma to add).
- **Feedback:** toast stack (success/info/error, 3.2 s), animated SVG `ProgressRing`, modal with Escape/backdrop close.
- **Responsive:** mobile slide-over nav, builder Edit/Preview tabs, sidebar/split CV layouts stack below 640 px.

## Privacy & Degradation

- Offline ATS scoring and job matching run entirely in the browser — resume content never leaves the device for these features.
- AI routes are opt-in; without a configured backend, AI buttons show a clear "backend not available" message while offline engines keep working.
- Guest CVs are intentionally session-only (never persisted). Signed-in CVs autosave to Supabase with an 800 ms debounce.
- Prompt ground rules forbid the model from fabricating metrics, employers, or credentials.

## Running Locally

```bash
npm install

# UI only (AI disabled, offline engines work)
npm run dev                # http://localhost:5173

# UI + AI backend
cp .env.example .env       # fill AI_API_KEY / AI_PROVIDER / AI_MODEL
npm run api                # node --env-file=.env dev-server.mjs → :3001
# vite proxies /api/* → :3001 automatically

# Or with Vercel CLI (same serverless handlers)
vercel dev
```

## Limitations & Future Work

Honest gaps worth mentioning (and good interview talking points):

- No JSON/CSV import-export of CVs yet.
- No Arabic/RTL or i18n — English-only UI.
- No global keyboard-shortcut palette (only Escape/Enter micro-interactions).
- Guest CVs are session-only, so a refresh loses guest work (by design, to keep zero-backend mode honest).
- Landing copy says "5 templates" while the app ships 13 (marketing copy lag).
- `api/ats-score.js` exists server-side but the frontend intentionally uses the offline engine.

Possible next steps: JSON import/export, RTL/Arabic locale, multi-CV versioning, real PDF filename via target="_blank" print flows, richer analytics, and per-job application tracking.

---

# Part 3 — Short Descriptions

Use whichever length fits the field on your portfolio site.

**One-liner:**
> AI-powered, ATS-safe CV builder with 13 templates, transparent resume scoring, job-description matching, and human-reviewed AI writing — built with React, Supabase, and Vercel serverless functions.

**~50 words:**
> Smart ATS CV Builder is a full-stack resume builder that produces ATS-friendly PDFs with selectable text. It features 13 templates, drag-and-drop editing, a transparent 0–100 ATS score, keyword job matching, and AI-assisted writing (summary, bullets, cover letters) that is always reviewed by the user before applying. Built with React, Supabase, and Vercel.

**~150 words:**
> Smart ATS CV Builder helps job seekers build resumes that survive applicant tracking systems. Users pick from 13 ATS-safe templates and edit ten sections with drag-and-drop reordering, categorized skill chips, and live previews. A transparent, rule-based ATS engine scores each CV from 0–100 with specific strengths, weaknesses, and fixes — no black box. A Job Match tool extracts keywords from any pasted job description and shows exactly which terms are matched or missing. Optional AI features (improve summary, rewrite/generate bullets, analyze jobs, write cover letters) run through a secure serverless proxy that supports OpenAI, Claude, Gemini, Groq, and OpenRouter via env vars — and every suggestion requires explicit user approval before it is applied. PDF export uses pure print-CSS for clean, selectable text with zero PDF dependencies. Signed-in users get cloud sync through Supabase auth and JSONB persistence; the app also runs fully offline in guest mode with no API keys. Built with React 18, Vite, Tailwind CSS, Supabase, and Vercel.
