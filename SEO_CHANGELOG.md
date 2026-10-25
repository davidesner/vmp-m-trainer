# SEO changelog

Every change that could move search traffic: what changed, where, why, and what to look at afterwards.
Compare the 28 days after a change with the 28 days before it in Search Console (and Seznam Webmaster),
using untouched pages as a control for seasonality.

| Date | Change | URLs | Hypothesis | Metric to check |
|---|---|---|---|---|
| 2026-10-15 | Added generated static pages: hub, 3 category pages, 14 topic pages, 792 question pages with explanations and sources; sitemap generated from the same list; links from the landing page category table and footer | `/kapitanske-zkousky`, `/testy/*`, `/otazky/**`, `/sitemap.xml` | Searches for "kapitánské zkoušky", "otázky VMP", "testy VMP <kategorie>" and specific questions (signs, lights) find a matching page | Indexed pages (GSC, Seznam), impressions and clicks on the new URLs, queries per page |
| 2026-10-15 | Unknown paths return a real 404 (static `404.html`, noindex) instead of 200 with the app shell; the SPA rewrite in `vercel.json` now lists only the app's routes | any unknown URL, e.g. `/foo-bar` | No soft-404s in Search Console; broken links point visitors to the hub and category pages | GSC Pages report: "Soft 404" and "Not found (404)" counts |
| 2026-10-15 | Seznam Webmaster API reindex requested for `/`, hub, 3 category and 14 topic pages; IndexNow key file added for a one-time ping of all sitemap URLs (Seznam, Bing) | all sitemap URLs | New domain gets crawled sooner than by discovery alone | Seznam Webmaster "Objevené robotem" / "V indexu", Bing indexed pages |
| 2026-10-25 | Question images get their displayed width and height in the HTML (no layout shift while loading); the image on a single-question page loads eagerly with high priority instead of lazily | `/otazky/**` | Lighthouse flagged CLS 0.094 and a lazy-loaded LCP image on question pages; fixing both keeps Core Web Vitals green for the long-tail pages | PageSpeed mobile CLS and LCP for a question page with an image (e.g. `/otazky/m/zvukove-signaly/331`); GSC Core Web Vitals report |
