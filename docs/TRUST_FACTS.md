# TRUST_FACTS.md — Professional Proof Data for PR-TOP Landing Page

**IMPORTANT: Only fill in facts you can verify and that you have consent to publish.**
This file is the ONLY allowed source of social proof for the PR-TOP landing page.
Inventing testimonials, fabricating numbers, or adding placeholder logos is strictly
prohibited. If this file is empty or has no filled entries, the "Professional Proof"
section will not render on the landing page at all.

After filling this file, copy the data to `src/frontend/src/data/trustFacts.js`
following the format described in each section below.

---

## 1. Numbers / Traction

Real usage numbers or milestones you can stand behind publicly.
Example: "50+ therapists", "200+ sessions transcribed", "4 countries".

Leave this block empty if you have no verified numbers yet.

```js
// In trustFacts.js → numbers: []
// Format: { value: "50+", label: { en: "...", ru: "...", uk: "...", es: "..." } }
```

**Owner fills here:**

| value | EN label | RU label | UK label | ES label |
|-------|----------|----------|----------|----------|
|       |          |          |          |          |

---

## 2. Associations / Endorsements

Professional associations that list, endorse, or have vetted PR-TOP.
Only include if you have documentation of the relationship.

```js
// In trustFacts.js → associations: []
// Format: { name: "...", url: "https://..." }
```

**Owner fills here:**

| Organization name | URL |
|-------------------|-----|
|                   |     |

---

## 3. Expert Advisors

Professionals (psychologists, supervisors, researchers) who have advised on
the product, with their explicit written consent to be named.

```js
// In trustFacts.js → advisors: []
// Format: { name: "...", credential: "...", quote: { en: "...", ru: "...", uk: "...", es: "..." } }
```

**Owner fills here:**

| Full name | Credential / title | Quote (EN) | Quote (RU) | Quote (UK) | Quote (ES) | Consent date |
|-----------|-------------------|------------|------------|------------|------------|--------------|
|           |                   |            |            |            |            |              |

---

## 4. Testimonials

Real testimonials from paying users who have given written consent to publish.
Do NOT include anything from beta testers who did not consent to publication.

```js
// In trustFacts.js → testimonials: []
// Format: { quote: { en: "...", ru: "...", uk: "...", es: "..." }, author: "...", credential: "...", consentDate: "YYYY-MM-DD" }
```

**Owner fills here:**

| Quote (EN) | Author (first name + profession) | Credential | Consent date |
|------------|----------------------------------|------------|--------------|
|            |                                  |            |              |

---

## How to publish filled facts

1. Fill the tables above.
2. Open `src/frontend/src/data/trustFacts.js`.
3. Populate the arrays from the tables above (follow the JSDoc types in the file).
4. Run `npm run build --prefix src/frontend` to verify the section renders.
5. Commit both files together.

The landing page checks `trustFacts.js` at build time. If all arrays are empty,
the "Professional Proof" section is silently omitted from the HTML output.
