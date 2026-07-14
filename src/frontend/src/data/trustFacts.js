/**
 * trustFacts.js — Professional Proof data for the PR-TOP landing page.
 *
 * SOURCE OF TRUTH: docs/TRUST_FACTS.md
 * ─────────────────────────────────────────────────────────────────────
 * MANDATE: All entries in this file MUST come from docs/TRUST_FACTS.md,
 * filled in by the product owner with verified, consent-approved facts.
 *
 * STRICTLY FORBIDDEN:
 *   - Placeholder or example testimonials
 *   - Fabricated numbers (e.g. "1000+ therapists" without evidence)
 *   - Invented association names or logos
 *   - Any data not explicitly provided by the product owner in TRUST_FACTS.md
 *
 * If all arrays below are empty, the "Professional Proof" section will NOT
 * render on the landing page. That is the correct behavior until real facts
 * are available.
 *
 * How to add real facts:
 *   1. Owner fills docs/TRUST_FACTS.md with verified data.
 *   2. Developer copies the data into the arrays below (following the types).
 *   3. Run `npm run build --prefix src/frontend` to verify rendering.
 *   4. Commit both docs/TRUST_FACTS.md and src/frontend/src/data/trustFacts.js.
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
