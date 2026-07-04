# PR-TOP.com — SEO Audit Assessment & Expert Conclusion

**Date:** 2026-07-04
**Scope:** https://pr-top.com/ + repository https://github.com/avamb/pr-top
**Purpose:** Independent verification of the Hermes agent's SEO audit, expert conclusion, and the basis for [SEO_PLAN.md](SEO_PLAN.md).

---

## 1. Independently verified facts (checked live on 2026-07-04)

| # | Fact | Verification method | Status |
|---|------|--------------------|--------|
| 1 | `https://pr-top.com/robots.txt` returns the landing page HTML, not a robots.txt | Direct fetch | **Confirmed** |
| 2 | `https://pr-top.com/sitemap.xml` returns the landing page HTML, not XML | Direct fetch | **Confirmed** |
| 3 | No `<link rel="canonical">` on the site | Raw HTML of `/` inspected via curl | **Confirmed** |
| 4 | No Open Graph / Twitter Card tags | Raw HTML | **Confirmed** |
| 5 | No JSON-LD structured data | Raw HTML | **Confirmed** |
| 6 | No hreflang | Raw HTML | **Confirmed** |
| 7 | Pure SPA: `<div id="root"></div>` is empty, all content is JS-rendered | Raw HTML | **Confirmed** |
| 8 | `<title>` and `meta description` exist | Raw HTML | **Confirmed** |
| 9 | Repo is React 18 + Vite SPA behind nginx with `try_files $uri /index.html` fallback | `src/frontend/nginx.conf`, `nginx/locations.conf` | **Confirmed** |

**Root cause of #1–#2 (more precise than the Hermes audit):** `src/frontend/public/` simply contains no `robots.txt` / `sitemap.xml`. Vite copies `public/*` into `dist/` root, and nginx `try_files $uri` would serve them if they existed. This is a 10-minute fix (add two files), **not** an nginx architecture problem. Explicit nginx `location` blocks are still recommended as belt-and-braces.

---

## 2. What the Hermes audit got right

- All technical findings are factually accurate (verified above).
- The phased structure (technical foundation → indexable pages → prerender → content → links) is the correct general order.
- schema.org recommendations (Organization, WebSite, SoftwareApplication, FAQPage) are appropriate.
- The point about separating marketing pages from app pages and noindexing auth/admin is correct.

## 3. What the Hermes audit missed or got wrong (expert corrections)

1. **The single most important strategic problem was missed: language is invisible to Google.**
   Language is selected via `localStorage` / `navigator.language` (`src/frontend/src/i18n/index.js`), with **no URL-based locales**. Googlebot crawls with no stored preference → **Google only ever sees the English version**, while the Phase-1 target market is Russian/Ukrainian-speaking therapists. Hermes mentioned hreflang as a checklist item but did not notice that the current i18n architecture makes hreflang *impossible* — locale-in-URL routing (`/ru/`, `/uk/`, `/es/`) is a prerequisite. This is the highest-leverage SEO change for this product.

2. **Zero-keyword title and H1 not flagged.**
   `PR-TOP — A service that will take your PRACTICE to the TOP level` contains no phrase anyone searches for. Titles/H1 must carry commercial keywords ("AI assistant for therapists", "дневник клиента психолога", etc.). Highest ROI-per-hour item in the whole plan.

3. **"The site is poorly indexable because it's an SPA" is overstated.**
   Google renders JavaScript reliably (with a rendering-queue delay); Bing partially; **Yandex renders JS poorly** — and Yandex matters for the CIS/diaspora segment. Prerendering is strongly recommended (P1) but is not the emergency; the emergency is robots.txt/sitemap/meta (P0, hours of work).

4. **Yandex ignored entirely.**
   Primary market includes CIS + Russian-speaking diaspora → Yandex Webmaster registration and JS-independent HTML (prerender) are required. Nuance: in Ukraine Yandex is banned — for the UA segment, Google only.

5. **Soft-404 problem not mentioned.** The SPA returns HTTP 200 + index.html for *any* URL. Google classifies these as soft-404s, wasting crawl budget and polluting reports. Mitigated by prerender + strict sitemap; fully fixed by returning real 404s for unknown paths.

6. **Suggested URLs partly don't exist and contain a typo.** `/pricing`, `/faq` are currently sections of the landing page, not routes (`src/frontend/src/App.jsx:83-95`); `/telegrams-bot-for-therapists` is a typo. The plan must first extract these into real routes.

7. **No measurement baseline, no keyword research step, and off-page advice too generic.** "Backlinks from relevant resources" is not actionable. For this niche the actual channels are: B17.ru, psy.su and similar RU psychologist directories, professional Telegram/VK communities, therapist training institutes and supervision schools, Product Hunt / G2 / Capterra for EN, vc.ru / Habr for RU tech-adjacent audience.

8. **Render-blocking third-party fonts** (`fonts.googleapis.com` in `index.html`) not flagged — hurts LCP and is a GDPR irritant for a privacy-positioned product.

## 4. Expert conclusion

The Hermes audit is factually sound and usable as a technical checklist, but it is a **generic tech-SEO list, not a strategy**. Its priorities treat all gaps as equal. My assessment:

- **P0 (days):** robots.txt, sitemap.xml, canonical, meta robots, OG/Twitter, static JSON-LD, keyword-bearing title/H1/description, search-console registrations. Cheap, mechanical, unblocks everything else.
- **P1 (1–2 weeks):** prerendering of public routes (JS-independent HTML) and extraction of pricing/FAQ into real routes. Required for Yandex, accelerates Google, enables real 404s.
- **P2 (2–4 weeks):** locale-in-URL (`/ru/`, `/uk/`, `/es/`) + hreflang + localized keyword-researched titles. **This is the strategic centerpiece** — without it the RU/UA-first go-to-market has no organic channel at all.
- **P3 (ongoing):** use-case landing pages, content, and niche-specific link building / community promotion.

The full executable plan is in [SEO_PLAN.md](SEO_PLAN.md).
