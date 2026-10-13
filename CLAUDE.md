# Project notes

## Keep the landing page in sync with the app

The public landing page (`src/routes/Landing.tsx`, shown at `/`) describes the app with hand-written copy and
hard-coded data. It does not update itself. Whenever you change the app, check whether the landing page still
tells the truth, and update it in the same change. In particular:

- **New or changed exam category** (e.g. adding S): add or update its row in `LANDING_CATEGORIES` in
  `src/lib/landingSamples.ts` (name, number of questions, test size, score needed, time limit). The values are
  copied from `public/data/questions-<X>.json` (`questions.length` and `passing`).
- **Changed question data**: the sample questions in `LANDING_SAMPLES` (same file) are copies of real questions
  from the data bundles. If the source question, its options, correct answer or image changes, update the copy.
  Each sample needs an explanation in `public/explanations/<X>/q-<id>.html`.
- **Changed Practice screen**: `public/landing/practice-areas.webp` is a screenshot of the Practice screen with
  "Vybrat oblasti" selected. Retake it (signed in, so no guest locks show) when that screen changes visibly.
- **Changed features or guest limits**: the feature texts and the notes about what works without an account
  (weak-spot practice, readiness estimate, saved progress) must match what guests and signed-in users actually get.
- **Changed sign-in options** (Google/Seznam SSO, registration): `src/components/AuthOptions.tsx` is shared by the
  landing page and `/login`; flip `ready` on a provider only once its backend works.
- **Changed routes**: the landing page links into the app under `/app`.
