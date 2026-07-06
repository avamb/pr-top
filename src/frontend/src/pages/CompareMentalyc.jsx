import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Seo from '../components/Seo';

/**
 * /compare/mentalyc  —  PR-TOP vs Mentalyc comparison (F21, English-only).
 *
 * Follows docs/seo/CONTENT_RULES.md (mirrors CompareUpheal structure):
 *   1. 40-60 word direct-answer block right below H1
 *   2. Single H1, clean H2/H3 hierarchy
 *   3. Honest feature/price <table>
 *   4. FAQ block + FAQPage JSON-LD
 *   5. Visible "Updated: July 2026" stamp + dateModified in JSON-LD
 *   6. Internal links to /, /alternatives/mentalyc, /security/gdpr,
 *      /security/data-sovereignty (both are privacy-first angles)
 *   7. PR-TOP wedge: Mentalyc ends at documentation; PR-TOP adds the
 *      client-facing between-session layer (diary + exercises + SOS + Telegram)
 *
 * Competitor data source (verified 2026-07):
 *   https://www.mentalyc.com/  https://www.mentalyc.com/pricing
 *   Mentalyc's own privacy angle: anonymized transcripts, no long-term
 *   audio storage, HIPAA-first. Acknowledged honestly below.
 */

const FAQ_ITEMS = [
  {
    q: 'Is PR-TOP a replacement for Mentalyc?',
    a: 'No. Mentalyc is an AI note-taker: it listens to sessions and drafts progress notes in clinical formats (SOAP, DAP, BIRP, GIRP). PR-TOP is a between-session assistant that also drafts notes, but its center of gravity is the client-facing channel — a Telegram bot for diary, exercises and crisis alerts. Many EU therapists use both.',
  },
  {
    q: 'Which is more private — Mentalyc or PR-TOP?',
    a: 'Both are privacy-first, but the models differ. Mentalyc anonymizes transcripts, deletes audio after processing, and is HIPAA-aligned on US infrastructure. PR-TOP is EU-hosted (Hetzner), GDPR-first with a DPA by default, and encrypts Class A data (diary, transcripts, private notes) at the application layer — so the database itself does not hold plaintext client content.',
  },
  {
    q: 'Does Mentalyc work with Telegram or offer a client-facing app?',
    a: 'No. Mentalyc is therapist-facing only: a web app that captures the session and produces the note. PR-TOP is the only comparable tool with a native client channel — clients keep a diary, receive exercises and can trigger an SOS directly inside Telegram, which most EU / CIS / LATAM clients already use daily.',
  },
  {
    q: 'Which is better for GDPR / EU compliance?',
    a: 'PR-TOP. Mentalyc has a solid privacy posture but is US-registered and US-hosted; GDPR compliance for EU therapists relies on standard contractual clauses. PR-TOP is EU-hosted, ships a Data Processing Addendum by default, keeps zero third-party trackers (self-hosted Umami analytics), and lets you export or wipe all encrypted client data on request.',
  },
  {
    q: 'What does PR-TOP not do that Mentalyc does?',
    a: 'Mentalyc has a deeper, more mature clinical-note template library (SOAP/DAP/BIRP/GIRP variants, treatment-plan generators, DSM/ICD prompts) and stronger integrations with US EHRs. PR-TOP’s note templates are simpler and provider-configurable, and it does not integrate with US EHRs. If your priority is depth of AI notes, Mentalyc wins.',
  },
  {
    q: 'Can I try PR-TOP without a credit card?',
    a: 'Yes. PR-TOP has a free Trial tier with the encrypted dashboard, Telegram client bot, diary, exercises and SOS enabled for a limited number of clients. No card is required and there is no automatic conversion to a paid plan — you upgrade only when you choose to.',
  },
];

const FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const ARTICLE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'PR-TOP vs Mentalyc — comparison for therapists (2026)',
  description:
    'Honest 2026 comparison of Mentalyc (privacy-first AI note-taker) and PR-TOP (therapist-controlled between-session assistant with Telegram client bot).',
  datePublished: '2026-07-06',
  dateModified: '2026-07-06',
  author: { '@type': 'Organization', name: 'PR-TOP' },
  publisher: { '@type': 'Organization', name: 'PR-TOP' },
  mainEntityOfPage: 'https://pr-top.com/compare/mentalyc',
};

export default function CompareMentalyc() {
  return (
    <div className="min-h-screen bg-white">
      <Seo
        localized={false}
        path="/compare/mentalyc"
        title="PR-TOP vs Mentalyc (2026) — honest comparison for therapists"
        description="Mentalyc is a privacy-first AI note-taker for therapists. PR-TOP adds the between-session layer: Telegram diary, exercises, SOS. EU-hosted."
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(ARTICLE_JSONLD)}</script>
        <script type="application/ld+json">{JSON.stringify(FAQ_JSONLD)}</script>
      </Helmet>

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-primary font-bold text-lg">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            PR-TOP
          </Link>
          <Link to="/" className="text-sm text-gray-600 hover:text-primary transition-colors">
            &larr; Back to home
          </Link>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-3">
            Comparison
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4">
            PR-TOP vs Mentalyc &mdash; comparison for therapists
          </h1>
          <p className="text-sm text-gray-500">
            Updated: July 2026 &middot; Reviewed by the PR-TOP team
          </p>
        </header>

        {/* Rule 1 — direct-answer block, 40-60 words. */}
        <div className="bg-primary/5 border-l-4 border-primary p-5 rounded-r-lg mb-10">
          <p className="text-gray-800 leading-relaxed">
            <strong>Mentalyc</strong> is a privacy-first AI note-taker for
            therapists, from about $39/mo, HIPAA-aligned and US-hosted.
            <strong> PR-TOP</strong> is a therapist-controlled between-session
            assistant: an encrypted dashboard plus a Telegram client bot for
            diary, exercises and one-tap crisis alerts. Both are privacy-first;
            they solve different jobs and many EU practices run them together.
          </p>
        </div>

        {/* Rule 7 — wedge in first H2. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Where each product stops
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Mentalyc ends at documentation: it turns the audio of a session into
            a clean progress note and stops there. PR-TOP also drafts notes, but
            its wedge is the space <em>between</em> sessions &mdash; a Telegram
            channel where clients keep a voice/text/video diary, receive
            exercises, and can trigger an SOS to your inbox. If your bottleneck
            is writing session notes, Mentalyc is a strong pick. If your
            bottleneck is preserving client context across the week and reducing
            double documentation, PR-TOP is built for that.
          </p>
          <p className="text-gray-700 leading-relaxed">
            The two are complementary. An EU practice can run Mentalyc (or any
            AI note-taker) for documentation and PR-TOP for the client-facing
            channel, because their scopes barely overlap.
          </p>
        </section>

        {/* Rule 7 — privacy contrast section (Mentalyc-specific). */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Two flavours of privacy-first
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Mentalyc’s approach: anonymize the transcript on ingest, avoid
            long-term audio storage, align with US HIPAA. PR-TOP’s approach:
            keep <em>everything</em> in the EU, encrypt Class A data (diary,
            transcripts, private notes) at the application layer so the database
            never holds plaintext, and ship a DPA by default. Both reduce the
            blast radius of a breach; they just do it from different angles.
          </p>
          <p className="text-gray-700 leading-relaxed">
            See{' '}
            <Link to="/security/encryption" className="text-primary underline hover:no-underline">
              PR-TOP’s encryption architecture
            </Link>
            {', '}
            <Link to="/security/gdpr" className="text-primary underline hover:no-underline">
              GDPR compliance
            </Link>
            {' and '}
            <Link to="/security/data-sovereignty" className="text-primary underline hover:no-underline">
              data sovereignty
            </Link>
            {' '}for the full picture.
          </p>
        </section>

        {/* Rule 3 — honest feature/price table. Data verified 2026-07 against
            https://www.mentalyc.com/ and https://www.mentalyc.com/pricing */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Feature and price comparison (2026)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left text-gray-700">
                  <th className="p-3 border border-gray-200 font-semibold">Category</th>
                  <th className="p-3 border border-gray-200 font-semibold">Mentalyc</th>
                  <th className="p-3 border border-gray-200 font-semibold">PR-TOP</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr>
                  <td className="p-3 border border-gray-200 font-medium">Category</td>
                  <td className="p-3 border border-gray-200">Privacy-first AI note-taker for therapists</td>
                  <td className="p-3 border border-gray-200">Between-session assistant + Telegram client bot</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-3 border border-gray-200 font-medium">Pricing (from)</td>
                  <td className="p-3 border border-gray-200">Limited free tier, then ~$39/mo</td>
                  <td className="p-3 border border-gray-200">Free Trial, then &euro;9/mo Basic, &euro;19/mo Pro</td>
                </tr>
                <tr>
                  <td className="p-3 border border-gray-200 font-medium">AI session notes</td>
                  <td className="p-3 border border-gray-200">Core product &mdash; mature templates (SOAP/DAP/BIRP/GIRP, treatment plans)</td>
                  <td className="p-3 border border-gray-200">Yes (Whisper + configurable providers), simpler templates</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-3 border border-gray-200 font-medium">Client-facing app</td>
                  <td className="p-3 border border-gray-200">No native client app</td>
                  <td className="p-3 border border-gray-200">Telegram bot (voice/text/video diary, exercises, SOS)</td>
                </tr>
                <tr>
                  <td className="p-3 border border-gray-200 font-medium">Between-session diary</td>
                  <td className="p-3 border border-gray-200">Not in scope</td>
                  <td className="p-3 border border-gray-200">Yes &mdash; voice / text / video, encrypted</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-3 border border-gray-200 font-medium">Crisis / SOS alerts</td>
                  <td className="p-3 border border-gray-200">Not in scope</td>
                  <td className="p-3 border border-gray-200">One-tap client SOS with multi-channel therapist notify</td>
                </tr>
                <tr>
                  <td className="p-3 border border-gray-200 font-medium">Privacy model</td>
                  <td className="p-3 border border-gray-200">Anonymized transcripts, HIPAA-aligned, no long-term audio storage</td>
                  <td className="p-3 border border-gray-200">Application-layer AES for Class A data (diary, transcripts, notes)</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-3 border border-gray-200 font-medium">Hosting / data residency</td>
                  <td className="p-3 border border-gray-200">US-hosted</td>
                  <td className="p-3 border border-gray-200">EU-only (Hetzner), self-hostable</td>
                </tr>
                <tr>
                  <td className="p-3 border border-gray-200 font-medium">GDPR posture</td>
                  <td className="p-3 border border-gray-200">Standard contractual clauses; US-registered</td>
                  <td className="p-3 border border-gray-200">EU-first; DPA by default; no third-party trackers</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-3 border border-gray-200 font-medium">Languages</td>
                  <td className="p-3 border border-gray-200">English (primary)</td>
                  <td className="p-3 border border-gray-200">English, Russian, Ukrainian, Spanish</td>
                </tr>
                <tr>
                  <td className="p-3 border border-gray-200 font-medium">Where it wins</td>
                  <td className="p-3 border border-gray-200">Depth of AI notes, mature clinical templates, strong US privacy story</td>
                  <td className="p-3 border border-gray-200">Between-session continuity, EU/GDPR, client channel in Telegram</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-3 border border-gray-200 font-medium">Where it loses</td>
                  <td className="p-3 border border-gray-200">No client channel, US-hosted, English-only, US-centric compliance</td>
                  <td className="p-3 border border-gray-200">Simpler note templates, no US-EHR integrations, no scheduling/billing</td>
                </tr>
                <tr>
                  <td className="p-3 border border-gray-200 font-medium">Best for</td>
                  <td className="p-3 border border-gray-200">US therapists whose top priority is privacy-conscious AI session notes</td>
                  <td className="p-3 border border-gray-200">EU/CIS/LATAM therapists wanting between-session context + a client channel</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Mentalyc figures verified against mentalyc.com/pricing in July 2026.
            Numbers refresh quarterly.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            When to choose Mentalyc
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
            <li>You are a US-based therapist whose top priority is privacy-conscious AI session notes.</li>
            <li>You want a mature template library (SOAP/DAP/BIRP/GIRP, treatment plans) out of the box.</li>
            <li>Your clients meet with you on Zoom or in person and you do not need a between-session engagement channel.</li>
            <li>HIPAA is your compliance frame of reference, not GDPR.</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            When to choose PR-TOP
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
            <li>You want your clients to keep a real-time diary (voice, text, video) between sessions.</li>
            <li>You want a one-tap crisis / SOS channel from the client’s phone to your inbox.</li>
            <li>You want to assign exercises and see whether the client actually did them.</li>
            <li>You are in the EU or CIS and prefer GDPR-first, EU-hosted software with a DPA by default.</li>
            <li>You want your interface (and your clients’ interface) in Russian, Ukrainian or Spanish, not only English.</li>
          </ul>
        </section>

        <section className="mb-10" id="faq">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            {FAQ_ITEMS.map((item) => (
              <div key={item.q}>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-gray-700 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-4 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Try PR-TOP alongside your current tools
          </h2>
          <p className="text-gray-700 mb-4">
            The free Trial takes about ten minutes to set up. No credit card. If
            you decide it does not fit your workflow, you can export your data
            and leave with no lock-in.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Start free trial
            </Link>
            <Link
              to="/alternatives/mentalyc"
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              See other Mentalyc alternatives
            </Link>
            <Link
              to="/security/gdpr"
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              How PR-TOP handles GDPR
            </Link>
          </div>
        </section>
      </article>

      <footer className="bg-gray-900 text-white/60 text-center py-6 text-xs">
        &copy; {new Date().getFullYear()} PR-TOP. All rights reserved.
      </footer>
    </div>
  );
}
