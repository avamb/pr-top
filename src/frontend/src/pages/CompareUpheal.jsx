import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Seo from '../components/Seo';

/**
 * /compare/upheal  —  PR-TOP vs Upheal comparison (F20, English-only).
 *
 * Follows docs/seo/CONTENT_RULES.md:
 *   1. 40-60 word direct-answer block right below H1
 *   2. Single H1, clean H2/H3 hierarchy
 *   3. Honest feature/price <table>
 *   4. FAQ block + FAQPage JSON-LD
 *   5. Visible "Updated: July 2026" stamp + dateModified in JSON-LD
 *   6. Internal links to / and to sibling /alternatives/upheal
 *   7. PR-TOP wedge (diary + exercises + crisis alerts + Telegram) in top H2s
 *
 * Competitor data source (verified 2026-07): https://www.upheal.io/pricing
 */

const FAQ_ITEMS = [
  {
    q: 'Is PR-TOP a replacement for Upheal?',
    a: 'Not directly. Upheal is an AI-native EHR built around session documentation, scheduling and billing. PR-TOP is a between-session assistant: it does not replace an EHR. Many EU therapists use PR-TOP alongside a lightweight local practice-management tool because their compliance context is GDPR, not US HIPAA.',
  },
  {
    q: 'Which is cheaper — Upheal or PR-TOP?',
    a: 'PR-TOP starts free (Trial), then Basic is €9/mo and Pro €19/mo. Upheal starts at about $29/mo and scales up per feature set. On a like-for-like AI-notes-only comparison Upheal has more depth; on total client-engagement surface (bot + diary + exercises + alerts) PR-TOP is broader for less money.',
  },
  {
    q: 'Does Upheal work with Telegram?',
    a: 'No. Upheal is a browser + mobile app that sits between the therapist and their session recordings. PR-TOP is Telegram-native for the client side: clients keep a diary, receive exercises, and can trigger a crisis alert directly inside the messenger they already use every day.',
  },
  {
    q: 'Is Upheal GDPR-compliant for EU therapists?',
    a: 'Upheal publishes a GDPR page and a DPA, but hosting and go-to-market are US-centric. PR-TOP is EU-hosted (Hetzner), ships a Data Processing Addendum by default, encrypts Class A data (diary entries, transcripts, private notes) at the application layer, and runs self-hosted analytics with no third-party trackers.',
  },
  {
    q: 'What does PR-TOP not do that Upheal does?',
    a: 'PR-TOP does not currently ship insurance billing, calendar/scheduling with automated reminders, or a US-market EHR feature set. If those are your top priorities, Upheal (or SimplePractice) is the better fit. PR-TOP focuses on the between-session channel and encrypted client context, not full practice management.',
  },
  {
    q: 'Can I try PR-TOP without a credit card?',
    a: 'Yes. PR-TOP has a free Trial tier with all core features enabled for a limited number of clients. There is no credit card required to start, and no automatic conversion to a paid plan — you choose when to upgrade.',
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
  headline: 'PR-TOP vs Upheal — comparison for therapists (2026)',
  description:
    'Honest 2026 comparison of Upheal (AI-native EHR for session notes) and PR-TOP (therapist-controlled between-session assistant with Telegram client bot).',
  datePublished: '2026-07-06',
  dateModified: '2026-07-06',
  author: { '@type': 'Organization', name: 'PR-TOP' },
  publisher: { '@type': 'Organization', name: 'PR-TOP' },
  mainEntityOfPage: 'https://pr-top.com/compare/upheal',
};

export default function CompareUpheal() {
  return (
    <div className="min-h-screen bg-white">
      <Seo
        localized={false}
        path="/compare/upheal"
        title="PR-TOP vs Upheal (2026) — honest comparison for therapists"
        description="Upheal is an AI-native session-notes EHR from ~$29/mo. PR-TOP is a between-session assistant with Telegram client bot, diary, crisis alerts."
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
            ← Back to home
          </Link>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-3">
            Comparison
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4">
            PR-TOP vs Upheal — comparison for therapists
          </h1>
          <p className="text-sm text-gray-500">
            Updated: July 2026 &middot; Reviewed by the PR-TOP team
          </p>
        </header>

        {/* Rule 1 — direct-answer block, 40-60 words. */}
        <div className="bg-primary/5 border-l-4 border-primary p-5 rounded-r-lg mb-10">
          <p className="text-gray-800 leading-relaxed">
            <strong>Upheal</strong> is an AI-native EHR for therapists built around
            session notes, scheduling and billing, from roughly $29/mo and
            US-market-oriented. <strong>PR-TOP</strong> is a therapist-controlled
            between-session assistant: an encrypted dashboard plus a Telegram
            client bot for diary, exercises and one-tap crisis alerts. GDPR-first,
            EU-hosted, four languages (EN/RU/UK/ES). Different jobs — many
            practices use both.
          </p>
        </div>

        {/* Rule 7 — wedge in first H2. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Different jobs, not a head-to-head
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            AI note-takers like Upheal document your sessions. PR-TOP also stays
            with your clients <em>between</em> sessions — diary, exercises,
            crisis alerts — inside the messenger they already use every day
            (Telegram). If your main pain point is writing session notes faster,
            Upheal is a strong choice. If your main pain point is preserving
            client context and reducing double-documentation across the week,
            PR-TOP is built for exactly that.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Both products can coexist: an EU practice can run Upheal (or a local
            EHR) for documentation and PR-TOP for the client-facing channel,
            because their scopes barely overlap.
          </p>
        </section>

        {/* Rule 3 — honest feature/price table. Data verified 2026-07 against
            https://www.upheal.io/ and https://www.upheal.io/pricing */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Feature and price comparison (2026)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left text-gray-700">
                  <th className="p-3 border border-gray-200 font-semibold">Category</th>
                  <th className="p-3 border border-gray-200 font-semibold">Upheal</th>
                  <th className="p-3 border border-gray-200 font-semibold">PR-TOP</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr>
                  <td className="p-3 border border-gray-200 font-medium">Category</td>
                  <td className="p-3 border border-gray-200">AI-native session-notes EHR</td>
                  <td className="p-3 border border-gray-200">Between-session assistant + Telegram client bot</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-3 border border-gray-200 font-medium">Pricing (from)</td>
                  <td className="p-3 border border-gray-200">~$29/mo (Starter), scales up per feature</td>
                  <td className="p-3 border border-gray-200">Free Trial, then €9/mo Basic, €19/mo Pro</td>
                </tr>
                <tr>
                  <td className="p-3 border border-gray-200 font-medium">AI session notes</td>
                  <td className="p-3 border border-gray-200">Core product — deep, mature, SOAP/DAP/etc.</td>
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
                  <td className="p-3 border border-gray-200">Yes — voice / text / video, encrypted</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-3 border border-gray-200 font-medium">Crisis / SOS alerts</td>
                  <td className="p-3 border border-gray-200">Not in scope</td>
                  <td className="p-3 border border-gray-200">One-tap client SOS with multi-channel therapist notify</td>
                </tr>
                <tr>
                  <td className="p-3 border border-gray-200 font-medium">Scheduling &amp; billing</td>
                  <td className="p-3 border border-gray-200">Yes (calendar, invoicing, US insurance flow)</td>
                  <td className="p-3 border border-gray-200">Not included — pair with a local EHR</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-3 border border-gray-200 font-medium">Encryption model</td>
                  <td className="p-3 border border-gray-200">TLS + at-rest; enterprise-grade</td>
                  <td className="p-3 border border-gray-200">Application-layer AES for Class A data (diary, transcripts, notes)</td>
                </tr>
                <tr>
                  <td className="p-3 border border-gray-200 font-medium">Hosting / data residency</td>
                  <td className="p-3 border border-gray-200">US-centric</td>
                  <td className="p-3 border border-gray-200">EU-only (Hetzner)</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-3 border border-gray-200 font-medium">Languages</td>
                  <td className="p-3 border border-gray-200">English (primary)</td>
                  <td className="p-3 border border-gray-200">English, Russian, Ukrainian, Spanish</td>
                </tr>
                <tr>
                  <td className="p-3 border border-gray-200 font-medium">Where it wins</td>
                  <td className="p-3 border border-gray-200">Depth of AI notes, EHR features, US-market fit</td>
                  <td className="p-3 border border-gray-200">Between-session continuity, EU/GDPR, client channel</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-3 border border-gray-200 font-medium">Where it loses</td>
                  <td className="p-3 border border-gray-200">No client channel, US-centric compliance context, higher price</td>
                  <td className="p-3 border border-gray-200">No billing/scheduling, notes templates less deep than Upheal</td>
                </tr>
                <tr>
                  <td className="p-3 border border-gray-200 font-medium">Best for</td>
                  <td className="p-3 border border-gray-200">US-based practices needing a full AI-notes EHR</td>
                  <td className="p-3 border border-gray-200">EU/CIS/LATAM therapists wanting between-session context + a client channel</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Upheal figures verified against upheal.io/pricing in July 2026.
            Numbers refresh quarterly.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            When to choose Upheal
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
            <li>You are a US-based practice that needs AI-generated notes in SOAP/DAP/BIRP formats out of the box.</li>
            <li>You want scheduling, invoicing and (optionally) insurance flows in one tool.</li>
            <li>Your clients meet with you on Zoom or in person and you do not need a between-session engagement channel.</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            When to choose PR-TOP
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
            <li>You want your clients to keep a real-time diary (voice, text, video) between sessions.</li>
            <li>You want a one-tap crisis / SOS channel from the client's phone to your inbox.</li>
            <li>You want to assign exercises and see whether the client actually did them.</li>
            <li>You are in the EU or CIS and prefer GDPR-first, EU-hosted software with a DPA by default.</li>
            <li>You want your interface (and your clients' interface) in Russian, Ukrainian or Spanish, not only English.</li>
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
              to="/alternatives/upheal"
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              See other Upheal alternatives
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
