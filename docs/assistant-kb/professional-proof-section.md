<!-- audience: public -->

# Professional proof section on the landing page

PR-TOP's landing page includes a "Professional Proof" section that shows
verified social-proof facts about the platform — real numbers, professional
associations, expert advisors, and testimonials from consenting users.

## What the section contains

When the product owner has supplied verified, consent-approved facts, the
section can display up to four types of proof:

1. **Traction numbers** — verified usage figures (for example, "50+ therapists"
   or "200+ sessions transcribed"). Each number has a short label translated
   into English, Russian, Ukrainian, and Spanish.

2. **Professional associations** — organisations that have listed, reviewed, or
   endorsed PR-TOP. Links to the association's website are included only when the
   association itself publicly references PR-TOP.

3. **Expert advisors** — psychologists, supervisors, or researchers who have
   advised on the product and given explicit written consent to be named, along
   with a short attributed quote.

4. **Testimonials** — short quotes from paying subscribers who have given written
   consent to have their words published. Each testimonial shows the author's
   first name, professional credential, and the month and year they gave consent.

## When the section does not appear

The section is intentionally hidden until real facts are available. If the
`docs/seo/TRUST_FACTS.md` file has not been filled by the product owner, or if no
facts have been copied to `src/frontend/src/data/trustFacts.js`, the section
simply does not render in the HTML output — no placeholder quotes, no stock
"5-star" widgets, no fake logos.

This is a deliberate design decision: a missing section is preferable to a
misleading one.

## The "only real facts" rule

The PR-TOP codebase enforces a strict no-fabrication mandate for the
Professional Proof section:

- **Testimonials** must come from real, paying users with documented written
  consent dated before the publication date.
- **Numbers** must be verifiable by the product owner from actual usage data
  (analytics, database counts, billing records).
- **Association mentions** require evidence of the relationship (email, public
  listing, official documentation).
- **Advisor quotes** require the advisor's written consent to name them and to
  publish the specific quote.

Any code that adds placeholder or example content to the proof section is
rejected during code review. The `trustFacts.js` data file contains only
commented-out examples for reference, all clearly marked "DO NOT UNCOMMENT."

## How to add facts (for the product owner)

1. Open `docs/seo/TRUST_FACTS.md` and fill in the relevant tables with your
   verified data.
2. Copy each entry into `src/frontend/src/data/trustFacts.js`, following
   the type annotations in the file.
3. Run `npm run build --prefix src/frontend` to verify the section renders
   with your new content.
4. Commit both `docs/seo/TRUST_FACTS.md` and `src/frontend/src/data/trustFacts.js`.

The section goes live on the next deployment.

## Localization

All user-facing copy in the proof section is localized. The section heading
("Trusted by practitioners" in English) and sub-category labels ("In numbers",
"Professional recognition", "Expert advisors", "From the practice") are managed
in the standard `src/frontend/src/i18n/{en,ru,uk,es}.json` files under the
`landing.proof.*` key namespace.

Testimonial and advisor quote text is stored per-locale inside `trustFacts.js`
itself (a `{ en, ru, uk, es }` object on each entry). When the active language
does not have a translation, the English text is shown as a fallback.

## Frequently asked questions

**Q: Why is the professional proof section missing from the landing page?**
A: The section only renders when the product owner has filled in verified,
consent-approved data in `docs/seo/TRUST_FACTS.md` and copied it to the
`trustFacts.js` data file. If neither has been done, the section is deliberately
omitted. There is no bug; the design prefers an empty page over a misleading one.

**Q: Can I see testimonials from PR-TOP users before signing up?**
A: Testimonials from paying users (with their written consent) will appear in
the "Professional Proof" section of the landing page once the product owner has
gathered and published them. Until then, the section is hidden. You can read the
FAQ section on the landing page and ask the assistant specific questions about
how the platform works instead.

**Q: Are the traction numbers on the landing page real?**
A: Yes — or they do not appear at all. The platform's code explicitly forbids
placeholder numbers. Any statistic shown in the Professional Proof section has
been verified by the product owner from actual usage data (analytics, billing
records, or database counts) and is documented in the internal `TRUST_FACTS.md`
file.

**Q: How can I tell if a testimonial has real user consent?**
A: Every testimonial in the system is accompanied by a consent date stored in
the `trustFacts.js` data file. The consent date is not displayed publicly, but
it is recorded to confirm that the user agreed to publication before the quote
was added to the site.

**Q: Does PR-TOP show logos of partner companies?**
A: The platform does not use logos or visual brand marks in the proof section —
only text names of associations and their website URLs (when the association
publicly lists PR-TOP). This avoids implying endorsements that have not been
formally granted.

**Q: Is the professional proof section available in Russian, Ukrainian, and Spanish?**
A: Yes. All section labels (headings, category titles) are fully translated. For
testimonials and advisor quotes, the product owner supplies the text in each
locale when filling in `docs/seo/TRUST_FACTS.md`. If a particular quote has not been
translated, the English version is shown as a fallback.

**Q: Where is the professional proof section located on the landing page?**
A: The social-proof section (numbers, associations, advisors, testimonials) appears
after the "Technology inside PR-TOP" block and before the FAQ accordion (`id="professional-proof"`).
A separate company information block (`id="legal-entity"`) showing the legal entity
details — ABH TEAM OÜ, registry code 14162982, jurisdiction, address — appears
between the Pricing section and the page footer. This block is always visible and
does not depend on owner-supplied social proof.

**Q: What company information is shown on the landing page?**
A: A "About the company" / "О компании" block between Pricing and the footer shows
the legal entity facts approved for publication: the company name (ABH TEAM OÜ),
the Estonian registry code (14162982) with a link to the public e-Business Register
record, the jurisdiction (Estonia — European Union), the registered address
(Narva mnt 5, 10117 Tallinn, Estonia), the year of operation (since 2016), and the
support/privacy contact (support@pr-top.com). Personal surnames and personal
identification codes are not published anywhere on the site.

**Q: What happens if the product owner removes a testimonial (e.g., because the user withdrew consent)?**
A: The product owner removes the entry from `docs/seo/TRUST_FACTS.md` and from
`src/frontend/src/data/trustFacts.js`, then deploys. The testimonial is removed
from the live page within minutes of deployment. If removing the last remaining
entry in all four categories, the entire section disappears from the page.
