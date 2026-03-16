import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { trackUmamiEvent } from '../utils/umami';

/* ───────── Feature Highlights (icons only, text from i18n) ───────── */
const highlightIcons = [
  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>,
  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>,
  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>,
  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" /></svg>,
  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
];

const featureKeys = [
  { titleKey: 'landing.feature1Title', descKey: 'landing.feature1Desc' },
  { titleKey: 'landing.feature2Title', descKey: 'landing.feature2Desc' },
  { titleKey: 'landing.feature3Title', descKey: 'landing.feature3Desc' },
  { titleKey: 'landing.feature4Title', descKey: 'landing.feature4Desc' },
  { titleKey: 'landing.feature5Title', descKey: 'landing.feature5Desc' },
  { titleKey: 'landing.feature6Title', descKey: 'landing.feature6Desc' },
];

/* ═══════════════════════════════════════════ */
/*                Landing Page                 */
/* ═══════════════════════════════════════════ */
export default function Landing() {
  const { t } = useTranslation();
  const pricingRef = useRef(null);
  const pricingTrackedRef = useRef(false);

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
        'Transcription & AI summary',
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
        'Transcription & AI summary',
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
        'Transcription & AI summary',
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
        'Transcription & AI summary',
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
                {t('landing.heroDesc')}
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
                <li><a href="mailto:support@pr-top.app" className="hover:text-white transition-colors">support@pr-top.app</a></li>
                <li><Link to="/privacy" className="hover:text-white transition-colors">{t('landing.privacyPolicy')}</Link></li>
                <li><span>{t('landing.termsOfService')}</span></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-10 pt-6 text-center text-xs text-white/40">
            {t('landing.copyright', { year: new Date().getFullYear() })}
          </div>
        </div>
      </footer>
    </div>
  );
}
