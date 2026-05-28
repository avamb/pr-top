import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import LandingLayout from '../components/LandingLayout';
import ConfirmHero from '../components/landing/ConfirmHero';
import ConfirmPainHooks from '../components/landing/ConfirmPainHooks';
import ConfirmHowItWorks from '../components/landing/ConfirmHowItWorks';
import ConfirmDemo from '../components/landing/ConfirmDemo';
import ConfirmPriceCard from '../components/landing/ConfirmPriceCard';
import ConfirmFAQ from '../components/landing/ConfirmFAQ';
import ConfirmSignupForm from '../components/landing/ConfirmSignupForm';
import { trackUmamiEvent } from '../utils/umami';

/**
 * Set or update a <meta> tag by name/property.
 */
function setMeta(attr, attrVal, content) {
  let el = document.querySelector(`meta[${attr}="${attrVal}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, attrVal);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  return el;
}

/**
 * Set or update a <link> tag (rel=alternate + hreflang).
 */
function setHreflang(hreflang, href) {
  let el = document.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'alternate');
    el.setAttribute('hreflang', hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  return el;
}

/**
 * LandingConfirm — standalone /confirm landing page.
 *
 * Routes: /confirm (EN default), /ru/confirm, /es/confirm, /uk/confirm
 *
 * Renders OUTSIDE the main AppLayout (no sidebar, no user menu, no guards).
 * Uses LandingLayout which provides only a minimal top bar + footer.
 *
 * @param {string} [locale] - explicit locale override (e.g. 'ru', 'es', 'uk')
 */
export default function LandingConfirm({ locale }) {
  const { t, i18n } = useTranslation();
  const signupRef = useRef(null);
  const viewTrackedRef = useRef(false);

  // Apply locale from route param (handles SPA navigation between locale routes).
  // On fresh page loads, the correct language is already set by i18n/index.js
  // which reads the URL before React renders. This effect handles the case where
  // the user navigates within the SPA (e.g. LanguageSwitcher link).
  useEffect(() => {
    if (!locale) return;
    const supported = ['en', 'ru', 'es', 'uk'];
    if (!supported.includes(locale)) return;
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
      localStorage.setItem('app_language', locale);
    }
  }, [locale]); // eslint-disable-line react-hooks/exhaustive-deps

  // SEO: update document title and meta tags
  useEffect(() => {
    const prevTitle = document.title;
    document.title = t('landingConfirm.meta.title');

    const metaDesc = setMeta('name', 'description', t('landingConfirm.meta.description'));
    const metaRobots = setMeta('name', 'robots', 'index,follow');

    // Open Graph
    const ogType = setMeta('property', 'og:type', 'website');
    const ogTitle = setMeta('property', 'og:title', t('landingConfirm.meta.ogTitle'));
    const ogDesc = setMeta('property', 'og:description', t('landingConfirm.meta.ogDescription'));
    const ogImage = setMeta('property', 'og:image', 'https://pr-top.com/og-confirm.png');
    const ogUrl = setMeta('property', 'og:url',
      `https://app.pr-top.com${locale && locale !== 'en' ? `/${locale}` : ''}/confirm`);

    // Twitter Card
    const twCard = setMeta('name', 'twitter:card', 'summary_large_image');
    const twTitle = setMeta('name', 'twitter:title', t('landingConfirm.meta.ogTitle'));
    const twDesc = setMeta('name', 'twitter:description', t('landingConfirm.meta.ogDescription'));
    const twImage = setMeta('name', 'twitter:image', 'https://pr-top.com/og-confirm.png');

    // Hreflang links
    const hreflangs = [
      { hreflang: 'en', href: 'https://app.pr-top.com/confirm' },
      { hreflang: 'ru', href: 'https://app.pr-top.com/ru/confirm' },
      { hreflang: 'es', href: 'https://app.pr-top.com/es/confirm' },
      { hreflang: 'uk', href: 'https://app.pr-top.com/uk/confirm' },
      { hreflang: 'x-default', href: 'https://app.pr-top.com/confirm' },
    ];
    const hrefEls = hreflangs.map(hl => setHreflang(hl.hreflang, hl.href));

    return () => {
      // Restore on unmount
      document.title = prevTitle;
      [metaDesc, metaRobots, ogType, ogTitle, ogDesc, ogImage, ogUrl,
       twCard, twTitle, twDesc, twImage].forEach(el => el?.remove?.());
      hrefEls.forEach(el => el?.remove?.());
    };
  }, [t, locale, i18n.language]);

  // Fire Umami view event on mount (once)
  useEffect(() => {
    if (!viewTrackedRef.current) {
      viewTrackedRef.current = true;
      trackUmamiEvent('confirm_landing_view', { locale: i18n.language });
    }
  }, [i18n.language]);

  const scrollToSignup = () => {
    if (signupRef.current) {
      signupRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <LandingLayout>
        {/* ─── 7 Sections ─── */}
        <ConfirmHero onCtaClick={scrollToSignup} />
        <ConfirmPainHooks />
        <ConfirmHowItWorks />
        <ConfirmDemo />
        <ConfirmPriceCard onCtaClick={scrollToSignup} />
        <ConfirmFAQ />
        <ConfirmSignupForm formRef={signupRef} defaultLanguage={locale || i18n.language || 'en'} />
      </LandingLayout>

      {/* ─── Sticky CTA bar (mobile) ─── */}
      <StickyCtaBar onCtaClick={scrollToSignup} />
    </>
  );
}

/**
 * StickyCtaBar — thin band at the bottom of the viewport (mobile-first).
 * Single primary action: scroll to signup form.
 * Shown on mobile/tablet only (lg:hidden).
 */
function StickyCtaBar({ onCtaClick }) {
  const { t } = useTranslation();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-primary shadow-lg border-t border-primary-600">
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-center">
        <button
          onClick={onCtaClick}
          className="flex items-center gap-2 text-white font-bold text-sm px-6 py-2.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
          {t('landingConfirm.stickyCta')}
        </button>
      </div>
    </div>
  );
}
