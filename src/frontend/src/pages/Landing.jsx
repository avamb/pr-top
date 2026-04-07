import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import AccordionItem from '../components/AccordionItem';
import { trackUmamiEvent } from '../utils/umami';
import PublicAssistantChatButton from '../components/PublicAssistantChatButton';
import PublicAssistantChatPanel from '../components/PublicAssistantChatPanel';

/* ───────── Feature Highlights (icons only, text from i18n) ───────── */
const highlightIcons = [
  /* 1. DocumentTextIcon — Less Documentation Routine */
  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
  /* 2. ArrowPathIcon — Between-Session Continuity */
  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992" /></svg>,
  /* 3. ShieldCheckIcon — Data Security */
  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
  /* 4. HandRaisedIcon — Personal Boundary Protection */
  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.05 4.575a1.575 1.575 0 10-3.15 0v3m3.15-3v-1.5a1.575 1.575 0 013.15 0v1.5m-3.15 0l.075 5.925m3.075-5.925v-1.5a1.575 1.575 0 013.15 0v1.5m-3.15 0l.075 5.925M13.2 3.075a1.575 1.575 0 013.15 0v3.9M13.2 3.075v3.9m3.15-.975v2.55m0 0l.075 5.925m-3.225-5.55v3.375m0 0l-.075 4.56a2.475 2.475 0 01-.467 1.39l-.695.87a2.82 2.82 0 01-2.21 1.08H8.558a3.483 3.483 0 01-2.787-1.39L4.91 16.22a2.174 2.174 0 01-.44-1.31V8.385a1.575 1.575 0 013.15 0v3.24" /></svg>,
  /* 5. MicrophoneIcon — Quick Notes on the Go */
  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>,
  /* 6. ChatBubbleLeftRightIcon — Telegram */
  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>,
];

const featureKeys = [
  { titleKey: 'landing.feature1Title', descKey: 'landing.feature1Desc' },
  { titleKey: 'landing.feature2Title', descKey: 'landing.feature2Desc' },
  { titleKey: 'landing.feature3Title', descKey: 'landing.feature3Desc' },
  { titleKey: 'landing.feature4Title', descKey: 'landing.feature4Desc' },
  { titleKey: 'landing.feature5Title', descKey: 'landing.feature5Desc' },
  { titleKey: 'landing.feature6Title', descKey: 'landing.feature6Desc' },
];

/* ───────── FAQ Section ───────── */
const faqKeys = [
  { q: 'landing.faqQ1', a: 'landing.faqA1' },
  { q: 'landing.faqQ2', a: 'landing.faqA2' },
  { q: 'landing.faqQ3', a: 'landing.faqA3' },
  { q: 'landing.faqQ4', a: 'landing.faqA4' },
  { q: 'landing.faqQ5', a: 'landing.faqA5' },
];

function FaqSection({ t }) {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <section id="faq" aria-label="FAQ" className="py-20 bg-surface">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-text">
            {t('landing.faqTitle')}
          </h2>
        </div>
        <div>
          {faqKeys.map((fk, i) => (
            <AccordionItem
              key={i}
              id={`faq-${i}`}
              title={t(fk.q)}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            >
              {t(fk.a)}
            </AccordionItem>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════ */
/*                Landing Page                 */
/* ═══════════════════════════════════════════ */
export default function Landing() {
  const { t } = useTranslation();
  const pricingRef = useRef(null);
  const pricingTrackedRef = useRef(false);
  const burnoutRef = useRef(null);

  // Fade-in animation for burnout section on scroll
  useEffect(() => {
    const el = burnoutRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('opacity-100', 'translate-y-0');
          el.classList.remove('opacity-0', 'translate-y-8');
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Track scroll-to-pricing when pricing section enters viewport
  useEffect(() => {
    const el = pricingRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !pricingTrackedRef.current) {
          pricingTrackedRef.current = true;
          trackUmamiEvent('scroll-to-pricing');
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ───────── Pricing Data ───────── */
  const tiers = [
    {
      name: 'Trial',
      price: t('landing.free'),
      period: t('landing.days14'),
      highlight: false,
      features: [
        'Up to 3 clients',
        '5 sessions / month',
        'Transcription & summary',
        'Basic exercise library',
        'SOS alerts',
        'Client timeline',
        'Basic web dashboard',
      ],
    },
    {
      name: 'Basic',
      price: '$19',
      period: t('landing.perMonth'),
      highlight: false,
      features: [
        'Up to 10 clients',
        '20 sessions / month',
        'Transcription & summary',
        'Full exercise library',
        'SOS alerts',
        'Client timeline',
        'Basic web dashboard',
      ],
    },
    {
      name: 'Pro',
      price: '$49',
      period: t('landing.perMonth'),
      highlight: true,
      features: [
        'Up to 30 clients',
        '60 sessions / month',
        'Transcription & summary',
        'Full + custom exercises',
        'Natural-language queries',
        'SOS alerts',
        'Full analytics dashboard',
      ],
    },
    {
      name: 'Premium',
      price: '$99',
      period: t('landing.perMonth'),
      highlight: false,
      features: [
        'Unlimited clients',
        'Unlimited sessions',
        'Transcription & summary',
        'Full + custom exercises',
        'Natural-language queries',
        'Priority support',
        'Full analytics + export',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ─── Skip to content ─── */}
      <a href="#main-content" className="skip-to-content">
        {t('nav.skipToContent')}
      </a>

      {/* ─── Navbar ─── */}
      <nav aria-label="Main navigation" className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <span className="text-xl font-bold text-primary tracking-tight">{t('brand')}</span>
          <div className="flex items-center gap-4">
            <LanguageSwitcher compact />
            <Link to="/login" onClick={() => trackUmamiEvent('click-login')} className="text-sm font-medium text-secondary hover:text-text transition-colors min-h-[44px] flex items-center">
              {t('nav.login')}
            </Link>
            <Link
              to="/register"
              onClick={() => trackUmamiEvent('click-register')}
              className="text-sm font-semibold px-4 py-2.5 rounded-lg bg-primary text-white hover:bg-primary-600 transition-colors min-h-[44px] flex items-center"
            >
              {t('nav.register')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Main Content ─── */}
      <main id="main-content">

      {/* ─── Hero ─── */}
      <section aria-label="Hero" className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text content */}
            <div className="text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-text leading-tight tracking-tight">
                {t('landing.heroTitle1')}
                <br />
                <span className="text-primary">{t('landing.heroTitle2')}</span>
              </h1>
              <p className="mt-6 max-w-2xl mx-auto lg:mx-0 text-lg sm:text-xl text-secondary leading-relaxed">
                {t('landing.heroDesc')}
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link
                  to="/register"
                  onClick={() => trackUmamiEvent('click-register', { location: 'hero' })}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 rounded-lg bg-primary text-white font-semibold text-base hover:bg-primary-600 transition-colors shadow-lg shadow-primary/20"
                >
                  {t('landing.startTrial')}
                </Link>
                <a
                  href="#features"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 rounded-lg border border-primary/30 text-primary font-semibold text-base hover:bg-primary-50 transition-colors"
                >
                  {t('landing.learnMore')}
                </a>
              </div>
            </div>

            {/* Right: Hero illustration */}
            <div className="flex justify-center lg:justify-end" data-testid="hero-illustration">
              <svg
                className="w-full max-w-md lg:max-w-lg"
                viewBox="0 0 500 400"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label="Therapist dashboard illustration"
              >
                {/* Background card / dashboard mockup */}
                <rect x="60" y="40" width="380" height="280" rx="20" fill="#F4F7F6" stroke="#1F8A83" strokeWidth="2" opacity="0.8" />
                {/* Header bar */}
                <rect x="60" y="40" width="380" height="50" rx="20" fill="#163A43" opacity="0.95" />
                <rect x="60" y="70" width="380" height="20" fill="#163A43" opacity="0.95" />
                {/* Header dots */}
                <circle cx="90" cy="65" r="6" fill="#fff" opacity="0.6" />
                <circle cx="110" cy="65" r="6" fill="#fff" opacity="0.6" />
                <circle cx="130" cy="65" r="6" fill="#fff" opacity="0.6" />

                {/* Sidebar */}
                <rect x="60" y="90" width="100" height="230" fill="#ECE6DD" />
                {/* Sidebar items */}
                <rect x="75" y="110" width="70" height="8" rx="4" fill="#1F8A83" opacity="0.5" />
                <rect x="75" y="130" width="55" height="8" rx="4" fill="#1F8A83" opacity="0.3" />
                <rect x="75" y="150" width="65" height="8" rx="4" fill="#1F8A83" opacity="0.3" />
                <rect x="75" y="170" width="50" height="8" rx="4" fill="#1F8A83" opacity="0.3" />
                <rect x="75" y="190" width="60" height="8" rx="4" fill="#1F8A83" opacity="0.3" />

                {/* Main content area - client cards */}
                <rect x="175" y="100" width="250" height="60" rx="10" fill="#fff" stroke="#D9E2E0" strokeWidth="1.5" />
                <circle cx="200" cy="130" r="15" fill="#A8C9BE" />
                <rect x="225" y="118" width="80" height="8" rx="4" fill="#163A43" opacity="0.6" />
                <rect x="225" y="134" width="120" height="6" rx="3" fill="#1F8A83" opacity="0.3" />

                <rect x="175" y="170" width="250" height="60" rx="10" fill="#fff" stroke="#D9E2E0" strokeWidth="1.5" />
                <circle cx="200" cy="200" r="15" fill="#1F8A83" opacity="0.5" />
                <rect x="225" y="188" width="90" height="8" rx="4" fill="#163A43" opacity="0.6" />
                <rect x="225" y="204" width="100" height="6" rx="3" fill="#1F8A83" opacity="0.3" />

                <rect x="175" y="240" width="250" height="60" rx="10" fill="#fff" stroke="#D9E2E0" strokeWidth="1.5" />
                <circle cx="200" cy="270" r="15" fill="#163A43" opacity="0.4" />
                <rect x="225" y="258" width="70" height="8" rx="4" fill="#163A43" opacity="0.6" />
                <rect x="225" y="274" width="110" height="6" rx="3" fill="#1F8A83" opacity="0.3" />

                {/* Status indicators on cards */}
                <circle cx="405" cy="125" r="6" fill="#10B981" />
                <circle cx="405" cy="195" r="6" fill="#10B981" />
                <circle cx="405" cy="265" r="6" fill="#A8C9BE" />

                {/* Chat bubble overlay */}
                <rect x="320" y="310" width="140" height="70" rx="12" fill="#1F8A83" opacity="0.95" />
                <path d="M340 380 L350 395 L360 380" fill="#1F8A83" opacity="0.95" />
                <rect x="340" y="325" width="100" height="6" rx="3" fill="#fff" opacity="0.7" />
                <rect x="340" y="338" width="80" height="6" rx="3" fill="#fff" opacity="0.5" />
                <rect x="340" y="351" width="90" height="6" rx="3" fill="#fff" opacity="0.5" />

                {/* Shield / security icon */}
                <g transform="translate(45, 290)">
                  <path d="M20 5 L35 12 L35 25 C35 35 28 42 20 45 C12 42 5 35 5 25 L5 12 Z" fill="#1F8A83" opacity="0.9" />
                  <path d="M15 25 L19 29 L27 20" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </g>
              </svg>
            </div>
          </div>
        </div>
        {/* Decorative gradient */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-40 right-0 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-20 left-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl" />
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" aria-label="Features" className="py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-text">
              {t('landing.featuresTitle')}
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-secondary text-lg">
              {t('landing.featuresDesc')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featureKeys.map((fk, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-surface"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary-50 mb-4">
                  {highlightIcons[i]}
                </div>
                <h3 className="text-lg font-semibold text-text mb-2">{t(fk.titleKey)}</h3>
                <p className="text-secondary text-sm leading-relaxed">{t(fk.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Anti-Burnout ─── */}
      <section aria-label="Anti-Burnout" className="py-20 bg-gradient-to-b from-teal-50 to-white">
        <div
          ref={burnoutRef}
          className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center opacity-0 translate-y-8 transition-all duration-700 ease-out"
        >
          <svg className="w-12 h-12 mx-auto mb-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          </svg>
          <h2 className="text-3xl sm:text-4xl font-bold text-text mb-6">
            {t('landing.burnoutTitle')}
          </h2>
          <p className="text-lg text-secondary leading-relaxed">
            {t('landing.burnoutText')}
          </p>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <FaqSection t={t} />

      {/* ─── Pricing ─── */}
      <section id="pricing" ref={pricingRef} aria-label="Pricing" className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-text">
              {t('landing.pricingTitle')}
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-secondary text-lg">
              {t('landing.pricingDesc')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-6 flex flex-col ${
                  tier.highlight
                    ? 'bg-primary text-white shadow-xl shadow-primary/25 ring-2 ring-primary scale-[1.03]'
                    : 'bg-white text-text shadow-sm border border-surface'
                }`}
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-text text-xs font-bold px-3 py-1 rounded-full shadow">
                    {t('landing.mostPopular')}
                  </span>
                )}
                <h3 className={`text-lg font-semibold ${tier.highlight ? 'text-white' : 'text-text'}`}>
                  {tier.name}
                </h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className={`text-sm ${tier.highlight ? 'text-white/70' : 'text-secondary'}`}>
                    {tier.period}
                  </span>
                </div>
                <ul className="mt-6 space-y-3 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <svg
                        className={`w-5 h-5 shrink-0 mt-0.5 ${tier.highlight ? 'text-white/80' : 'text-success'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className={tier.highlight ? 'text-white/90' : ''}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  onClick={() => trackUmamiEvent('click-register', { location: 'pricing', tier: tier.name })}
                  className={`mt-8 block text-center py-2.5 min-h-[44px] flex items-center justify-center rounded-lg font-semibold text-sm transition-colors ${
                    tier.highlight
                      ? 'bg-white text-primary hover:bg-white/90'
                      : 'bg-primary text-white hover:bg-primary-600'
                  }`}
                >
                  {tier.price === t('landing.free') ? t('landing.startTrial') : t('nav.register')}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      </main>

      {/* ─── Footer ─── */}
      <footer className="bg-text text-white/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand */}
            <div>
              <span className="text-xl font-bold text-white">{t('brand')}</span>
              <p className="mt-3 text-sm leading-relaxed">
                {t('landing.footerDesc')}
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">{t('landing.footerProduct')}</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">{t('landing.features')}</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">{t('landing.pricing')}</a></li>
                <li><Link to="/register" className="hover:text-white transition-colors">{t('landing.signUp')}</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">{t('nav.login')}</Link></li>
              </ul>
            </div>

            {/* Security */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">{t('landing.footerSecurity')}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/security/encryption" className="hover:text-white transition-colors">{t('landing.encryption')}</Link></li>
                <li><Link to="/security/gdpr" className="hover:text-white transition-colors">{t('landing.gdpr')}</Link></li>
                <li><Link to="/security/audit-log" className="hover:text-white transition-colors">{t('landing.auditLogging')}</Link></li>
                <li><Link to="/security/data-sovereignty" className="hover:text-white transition-colors">{t('landing.dataSovereignty')}</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">{t('landing.footerContact')}</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="mailto:support@pr-top.com" className="hover:text-white transition-colors">support@pr-top.com</a></li>
                <li><Link to="/privacy" className="hover:text-white transition-colors">{t('landing.privacyPolicy')}</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">{t('landing.termsOfService')}</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-10 pt-6 text-center text-xs text-white/40">
            {t('landing.copyright', { year: new Date().getFullYear() })}
          </div>
        </div>
      </footer>
      {/* Public chat FAB + panel */}
      <PublicAssistantChatButton />
      <PublicAssistantChatPanel />
    </div>
  );
}
