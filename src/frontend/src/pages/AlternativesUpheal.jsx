import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Seo from '../components/Seo';

/**
 * /alternatives/upheal  —  Upheal alternatives listicle (F20, English-only).
 *
 * Follows docs/seo/CONTENT_RULES.md rules 1–7.
 * Competitor data verified 2026-07 against:
 *   - https://www.upheal.io/
 *   - https://www.mentalyc.com/pricing
 *   - https://twofold.ai/
 *   - https://www.heidihealth.com/
 *   - https://www.supanote.ai/
 */

const FAQ_ITEMS = [
  {
    q: 'What is the best alternative to Upheal for therapists?',
    a: 'There is no single best answer — pick by job. Mentalyc is the strongest privacy-first AI note-taker. Twofold and Supanote focus on speed and simplicity. Heidi is a fast generic transcription/notes assistant. PR-TOP is the only option here that owns the between-session channel via a Telegram client bot, not just documentation.',
  },
  {
    q: 'Is there a free alternative to Upheal?',
    a: 'Yes. PR-TOP has a free Trial tier with the client bot, diary, exercises and encrypted dashboard enabled. Mentalyc offers a limited free plan. Most session-notes competitors (Twofold, Heidi, Supanote) run short free trials rather than a permanent free tier.',
  },
  {
    q: 'Which Upheal alternative is best for EU / GDPR-first therapists?',
    a: 'PR-TOP is the most explicitly EU-native option: hosted on Hetzner (EU), application-layer encryption for Class A data, DPA by default, self-hosted analytics with no third-party trackers. Mentalyc emphasizes privacy but is US-based. Most other alternatives are US-market first.',
  },
  {
    q: 'Which alternative works with Telegram?',
    a: 'Only PR-TOP. Every other tool in this list is browser or mobile-app only. If your clients are in EU / CIS / LATAM markets where Telegram is dominant, PR-TOP is currently the only option that meets clients where they already are.',
  },
  {
    q: 'How often is this list updated?',
    a: 'Quarterly. Competitor pricing, features and positioning are re-verified against each vendor site every three months, and the comparison rows and the "Updated" date at the top are refreshed at the same time.',
  },
  {
    q: 'What did you not include in this list?',
    a: 'Enterprise-only tools (Eleos), pure practice-management suites without AI notes (SimplePractice, TherapyNotes) and dictation-only tools without therapy-specific templates. Those solve different problems and would make the list less useful.',
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
  headline: 'Upheal alternatives (2026) — Mentalyc, Twofold, Heidi, Supanote, PR-TOP',
  description:
    'Ranked list of Upheal alternatives for therapists in 2026: Mentalyc, Twofold, Heidi, Supanote, and PR-TOP for between-session continuity.',
  datePublished: '2026-07-06',
  dateModified: '2026-07-06',
  author: { '@type': 'Organization', name: 'PR-TOP' },
  publisher: { '@type': 'Organization', name: 'PR-TOP' },
  mainEntityOfPage: 'https://pr-top.com/alternatives/upheal',
};

const ITEMS = [
  {
    name: 'PR-TOP',
    tagline: 'Between-session assistant with a Telegram client bot',
    category: 'Between-session assistant + AI notes',
    priceFrom: 'Free Trial, then €9/mo Basic, €19/mo Pro',
    wins: 'Only option with a Telegram client channel (diary, exercises, crisis alerts). EU-hosted, GDPR-first, EN/RU/UK/ES.',
    loses: 'No billing or scheduling. AI-notes templates less deep than Upheal or Mentalyc.',
    bestFor: 'EU / CIS / LATAM therapists who want between-session continuity and a client channel in Telegram.',
    href: 'https://pr-top.com/',
    internal: true,
  },
  {
    name: 'Mentalyc',
    tagline: 'Privacy-first AI note-taker for therapists',
    category: 'AI session notes',
    priceFrom: 'From ~$39/mo (limited free tier)',
    wins: 'Strong privacy posture, mature clinical templates (SOAP/DAP/BIRP), well-known brand in US therapy circles.',
    loses: 'US-first, no client-facing channel, no messenger integration, English only.',
    bestFor: 'US-based therapists whose top priority is AI-drafted session notes with strong privacy claims.',
    href: 'https://www.mentalyc.com/',
    internal: false,
  },
  {
    name: 'Twofold',
    tagline: 'Fast AI notes with a light UI',
    category: 'AI session notes',
    priceFrom: 'From ~$29/mo',
    wins: 'Clean, opinionated UX; fast turnarounds on note drafts.',
    loses: 'Narrower feature set than Upheal or Mentalyc; no client-facing app; US-market first.',
    bestFor: 'Solo therapists who want AI notes with less UI friction than Upheal.',
    href: 'https://twofold.ai/',
    internal: false,
  },
  {
    name: 'Heidi',
    tagline: 'Generic clinical AI scribe (broader than therapy)',
    category: 'AI clinical scribe',
    priceFrom: 'Free tier + paid plans',
    wins: 'Fast, works across many clinical specialties, generous free tier.',
    loses: 'Not therapy-specific; user reports of reliability issues at scale; no client channel.',
    bestFor: 'Multidisciplinary practices that want one AI scribe across several clinical roles.',
    href: 'https://www.heidihealth.com/',
    internal: false,
  },
  {
    name: 'Supanote',
    tagline: 'AI notes with therapy-focused templates',
    category: 'AI session notes',
    priceFrom: 'From ~$25/mo',
    wins: 'Therapy-specific templates, competitive pricing, growing feature set.',
    loses: 'Smaller ecosystem than Upheal, no client channel, US-market first.',
    bestFor: 'Therapists who want a lower-cost AI-notes tool with therapy templates.',
    href: 'https://www.supanote.ai/',
    internal: false,
  },
];

export default function AlternativesUpheal() {
  return (
    <div className="min-h-screen bg-white">
      <Seo
        path="/alternatives/upheal"
        title="Upheal alternatives (2026): Mentalyc, Twofold, Heidi, Supanote, PR-TOP"
        description="Ranked Upheal alternatives for therapists in 2026. Honest comparison of Mentalyc, Twofold, Heidi, Supanote, and PR-TOP for between-session client engagement."
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
            Alternatives
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4">
            Upheal alternatives for therapists (2026)
          </h1>
          <p className="text-sm text-gray-500">
            Updated: July 2026 &middot; Reviewed by the PR-TOP team
          </p>
        </header>

        {/* Rule 1 — direct-answer block, 40-60 words. */}
        <div className="bg-primary/5 border-l-4 border-primary p-5 rounded-r-lg mb-10">
          <p className="text-gray-800 leading-relaxed">
            The best <strong>Upheal alternatives</strong> for therapists in 2026
            fall in two groups. For deeper AI session notes: <strong>Mentalyc</strong>,
            <strong> Twofold</strong>, <strong>Heidi</strong>, <strong>Supanote</strong>.
            For the space AI note-takers ignore — between-session client
            engagement via diary, exercises and crisis alerts inside Telegram —
            there is <strong>PR-TOP</strong>, which is EU-hosted and GDPR-first.
          </p>
        </div>

        {/* Rule 7 — wedge in top H2. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            How to pick
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            AI note-takers document your sessions. PR-TOP also stays with your
            clients between sessions — diary, exercises, crisis alerts — inside
            the messenger they already use every day. Decide first whether your
            bottleneck is <em>writing session notes</em> or <em>keeping context
            between sessions</em>, then pick from the group that matches.
          </p>
          <p className="text-gray-700 leading-relaxed">
            All prices below were verified against each vendor's live site in
            July 2026 and are refreshed quarterly.
          </p>
        </section>

        {/* Rule 3 — honest comparison table. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Comparison at a glance
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left text-gray-700">
                  <th className="p-3 border border-gray-200 font-semibold">Product</th>
                  <th className="p-3 border border-gray-200 font-semibold">Category</th>
                  <th className="p-3 border border-gray-200 font-semibold">Pricing (from)</th>
                  <th className="p-3 border border-gray-200 font-semibold">Best for</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {ITEMS.map((it, i) => (
                  <tr key={it.name} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="p-3 border border-gray-200 font-medium">{it.name}</td>
                    <td className="p-3 border border-gray-200">{it.category}</td>
                    <td className="p-3 border border-gray-200">{it.priceFrom}</td>
                    <td className="p-3 border border-gray-200">{it.bestFor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Sources: vendor pricing pages, July 2026. See per-item detail below
            for what each product wins and loses on.
          </p>
        </section>

        {ITEMS.map((it, idx) => (
          <section key={it.name} className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">
              {idx + 1}. {it.name}
            </h2>
            <p className="text-gray-500 italic mb-4">{it.tagline}</p>
            <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
              <li><strong>Category:</strong> {it.category}</li>
              <li><strong>Pricing (from):</strong> {it.priceFrom}</li>
              <li><strong>Where it wins:</strong> {it.wins}</li>
              <li><strong>Where it loses:</strong> {it.loses}</li>
              <li><strong>Best for:</strong> {it.bestFor}</li>
            </ul>
            <div className="mt-3">
              {it.internal ? (
                <Link
                  to="/compare/upheal"
                  className="text-sm text-primary underline hover:no-underline"
                >
                  See the full PR-TOP vs Upheal comparison &rarr;
                </Link>
              ) : (
                <a
                  href={it.href}
                  rel="nofollow noopener"
                  className="text-sm text-primary underline hover:no-underline"
                >
                  {it.name} website &rarr;
                </a>
              )}
            </div>
          </section>
        ))}

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
            Between-session continuity is what most of this list is missing
          </h2>
          <p className="text-gray-700 mb-4">
            Every other product on this page stops at documenting your sessions.
            If preserving client context across the week is your real problem,
            PR-TOP is the only option here that solves it. Free Trial, no card,
            no lock-in.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Start free trial
            </Link>
            <Link
              to="/compare/upheal"
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              PR-TOP vs Upheal (detail)
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
