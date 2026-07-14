/**
 * trustFacts.js — Professional Proof data for the PR-TOP landing page.
 *
 * SOURCE OF TRUTH: docs/seo/TRUST_FACTS.md
 * ─────────────────────────────────────────────────────────────────────
 * MANDATE: All entries in this file MUST come from docs/seo/TRUST_FACTS.md,
 * filled in by the product owner with verified, consent-approved facts.
 *
 * STRICTLY FORBIDDEN:
 *   - Placeholder or example testimonials
 *   - Fabricated numbers (e.g. "1000+ therapists" without evidence)
 *   - Invented association names or logos
 *   - Any data not explicitly provided by the product owner in docs/seo/TRUST_FACTS.md
 *
 * If all arrays below are empty AND legalEntity is null, the proof sections will NOT
 * render on the landing page. That is the correct behavior until real facts
 * are available.
 *
 * How to add real facts:
 *   1. Owner fills docs/seo/TRUST_FACTS.md with verified data.
 *   2. Developer copies the data into the arrays below (following the types).
 *   3. Run `npm run build --prefix src/frontend` to verify rendering.
 *   4. Commit docs/seo/TRUST_FACTS.md and src/frontend/src/data/trustFacts.js.
 */

/**
 * @typedef {{ en: string; ru: string; uk: string; es: string }} LocaleString
 */

/**
 * Traction numbers visible to visitors.
 * Each entry becomes a stat block in the proof section.
 *
 * @type {Array<{ value: string; label: LocaleString }>}
 */
export const numbers = [
  // Example (DO NOT UNCOMMENT — fill from TRUST_FACTS.md only):
  // { value: "50+", label: { en: "therapists", ru: "терапевтов", uk: "терапевтів", es: "terapeutas" } },
];

/**
 * Professional associations that have listed or endorsed PR-TOP.
 * Include URL only if the association's website publicly references PR-TOP.
 *
 * @type {Array<{ name: string; url?: string }>}
 */
export const associations = [
  // Example (DO NOT UNCOMMENT — fill from TRUST_FACTS.md only):
  // { name: "European Association for Psychotherapy", url: "https://..." },
];

/**
 * Expert advisors who have explicitly consented to be named.
 *
 * @type {Array<{ name: string; credential: string; quote: LocaleString }>}
 */
export const advisors = [
  // Example (DO NOT UNCOMMENT — fill from TRUST_FACTS.md only):
  // { name: "Dr. Anna M.", credential: "PhD, Clinical Psychologist", quote: { en: "...", ru: "...", uk: "...", es: "..." } },
];

/**
 * Testimonials from paying users who have given written consent to publish.
 * Do NOT include beta testimonials without explicit publication consent.
 *
 * @type {Array<{ quote: LocaleString; author: string; credential: string; consentDate: string }>}
 */
export const testimonials = [
  // Example (DO NOT UNCOMMENT — fill from TRUST_FACTS.md only):
  // { quote: { en: "...", ru: "...", uk: "...", es: "..." }, author: "Elena K.", credential: "Psychologist, Moscow", consentDate: "2026-01-15" },
];

/**
 * Legal entity data for the company block on the landing page.
 * Source: docs/seo/TRUST_FACTS.md — only rows with publish: yes
 *
 * HARD RULES (from owner, 2026-07-14):
 *   - No personal surnames anywhere on the site
 *   - No personal identification codes
 *   - No testimonials (none available as of 2026-07-14)
 */
export const legalEntity = {
  /** Company name — do NOT translate */
  name: 'ABH TEAM OÜ',
  /** Registry code in Estonian Commercial Register — do NOT translate */
  registryCode: '14162982',
  /** Public link to the e-Business Register record */
  registryLink: 'https://ariregister.rik.ee/eng/company/14162982',
  /** Jurisdiction — do NOT translate */
  jurisdiction: 'Estonia — European Union',
  /** Registered address — do NOT translate */
  address: 'Narva mnt 5, 10117 Tallinn, Estonia',
  /** Year of first register entry */
  operatingSince: '2016',
  /** Public support / privacy contact */
  contact: 'support@pr-top.com',
};

/**
 * Returns true if at least one fact category has entries.
 * Used by ProfessionalProofSection to decide whether to render at all.
 */
export function hasTrustFacts() {
  return (
    numbers.length > 0 ||
    associations.length > 0 ||
    advisors.length > 0 ||
    testimonials.length > 0
  );
}
