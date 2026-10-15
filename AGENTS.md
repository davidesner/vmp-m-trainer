# Project notes

## Keep the landing page in sync with the app

The public landing page (`src/routes/Landing.tsx`, shown at `/`) describes the app with hand-written copy and
hard-coded data. It does not update itself. Whenever you change the app, check whether the landing page still
tells the truth, and update it in the same change. In particular:

- **New or changed exam category** (e.g. adding S): add or update its row in `LANDING_CATEGORIES` in
  `src/lib/landingSamples.ts` (name, number of questions, test size, score needed, time limit). The values are
  copied from `public/data/questions-<X>.json` (`questions.length` and `passing`).
  Also update the categories listed in the `<meta name="description">` in `index.html`.
  Check the exam facts in `src/lib/landingFaq.ts` (FAQ answers) against https://sps.gov.cz/dok-os/zkousky too.
- **Changed question data**: the sample questions in `LANDING_SAMPLES` (same file) are copies of real questions
  from the data bundles. If the source question, its options, correct answer or image changes, update the copy.
  Each sample needs an explanation in `public/explanations/<X>/q-<id>.html`.
- **Changed Practice screen**: `public/landing/practice-areas.webp` is a screenshot of the Practice screen with
  "Vybrat oblasti" selected. Retake it (signed in, so no guest locks show) when that screen changes visibly.
- **Changed features or guest limits**: the feature texts and the notes about what works without an account
  (weak-spot practice, readiness estimate, saved progress) must match what guests and signed-in users actually get.
  The account and guest notes shown next to the sign-in options live in `src/lib/accountCopy.ts`, shared with `/login`.
- **Changed sign-in options** (Google/Seznam SSO, registration): `src/components/AuthOptions.tsx` is shared by the
  landing page and `/login`. A provider's button is enabled when `/api/auth/config` reports it configured
  (`GOOGLE_*` / `SEZNAM_*` env vars); the backend is `server/auth/oauth.ts` and `server/auth/identities.ts`.
- **Changed routes**: the landing page links into the app under `/app`.
  `vercel.json` rewrites only the routes in `src/App.tsx` to `spa.html` (`/app/*` plus the listed top-level paths);
  any other path gets the generated `404.html` with status 404. A new top-level route must be added there.

## Public SEO pages are generated, not written

`scripts/build-seo-pages.mjs` runs at the end of `pnpm build` and writes static, JavaScript-free pages into `dist/`:
`/kapitanske-zkousky` (hub), `/testy/<kat>` (one per category), `/otazky/<kat>/<oblast>` (all questions of a topic
with the correct answer) and `/otazky/<kat>/<oblast>/<id>` (one question with its explanation), plus `dist/sitemap.xml`.
Everything comes from `public/data/questions-*.json`, `public/explanations/<kat>/q-<id>.html` (+ `.meta.json`) and
the SPS source URLs in `scripts/test-configs.mjs`, so changed or new questions, topics, categories and explanations
need no edits there. Only `CATEGORY_NOTES` (one hand-written sentence per category, mirrors `src/lib/landingFaq.ts`)
and the hub copy are hand-written; keep them true when exam rules change.

- Preview without a full build: `node scripts/build-seo-pages.mjs --out /tmp/seo --relative`, then open
  `/tmp/seo/kapitanske-zkousky/index.html` (images load from the live site).
- New top-level URL prefixes for these pages must be added to the rewrites in `vercel.json` (and excluded from the
  SPA catch-all there). Do not add a hand-written `public/sitemap.xml`; the generator owns it.
- Log SEO-relevant changes (titles, page types, URL changes) in `SEO_CHANGELOG.md` so their effect can be measured.
