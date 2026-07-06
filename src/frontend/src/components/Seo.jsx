import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Seo — per-route SEO meta component (SEO Foundation F3 + Localization F13).
 *
 * Emits (all indexable public marketing pages):
 *   - <html lang="{active locale}">        (F13)
 *   - <title>                              (localized when *Key provided)
 *   - <meta name="description">            (localized when *Key provided)
 *   - <link rel="canonical" ...>           (locale-aware canonical URL)
 *   - <link rel="alternate" hreflang="en|ru|uk|es|x-default">  (F13)
 *   - <meta name="robots">
 *   - Open Graph tags (og:title, og:description, og:url, og:type, og:image)
 *   - Twitter Card tags (twitter:card, twitter:title, twitter:description, twitter:image)
 *
 * Props:
 *   - title          (string, required unless titleKey)       fallback title.
 *   - description    (string, required unless descriptionKey) fallback description.
 *   - titleKey       (string, optional)   i18n key for localized <title>.
 *   - descriptionKey (string, optional)   i18n key for localized <meta description>.
 *   - path           (string, optional)   English-base canonical suffix (no locale prefix).
 *                                         Defaults to location.pathname with any /ru|/uk|/es
 *                                         prefix stripped.
 *   - noindex        (bool, optional)     emit robots=noindex,nofollow and skip hreflang.
 *   - ogType         (string, optional)   og:type; defaults to 'website'.
 *   - ogImage        (string, optional)   og:image + twitter:image absolute URL.
 *   - twitterCard    (string, optional)   twitter:card; defaults to 'summary_large_image'.
 *   - canonicalHost  (string, optional)   canonical host; defaults to 'https://pr-top.com'.
 *
 * Canonical / hreflang URL scheme (F13, keyed off SEO_PLAN.md §3):
 *   - English lives at the root:            /  /privacy  /security/gdpr  ...
 *   - Each non-EN locale mirrors the tree:  /ru/  /ru/privacy  /ru/security/gdpr  ...
 *     (The root of a locale keeps a trailing slash: /ru/, /uk/, /es/.)
 *   - x-default points to the English URL.
 */

const HREFLANG_LOCALES = ['en', 'ru', 'uk', 'es'];
const LOCALE_PREFIX_RE = /^\/(ru|uk|es)(\/.*)?$/;

function stripLocalePrefix(pathname) {
  const m = pathname.match(LOCALE_PREFIX_RE);
  if (!m) return pathname;
  return m[2] && m[2] !== '' ? m[2] : '/';
}

function localizePath(locale, basePath) {
  if (locale === 'en') return basePath;
  return basePath === '/' ? `/${locale}/` : `/${locale}${basePath}`;
}

export default function Seo({
  title,
  description,
  titleKey,
  descriptionKey,
  path,
  noindex = false,
  ogType = 'website',
  ogImage = 'https://pr-top.com/images/og-default.png',
  ogImageWidth = 1200,
  ogImageHeight = 630,
  twitterCard = 'summary_large_image',
  canonicalHost = 'https://pr-top.com',
  // Set localized={false} on pages that exist ONLY in English (e.g. the
  // /compare/* tree): forces an EN canonical + lang and skips hreflang, so
  // we never advertise locale URLs that don't exist.
  localized = true,
}) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const rawPath = typeof path === 'string' ? path : location.pathname;
  const basePath = stripLocalePrefix(rawPath);

  const activeLocale =
    localized && HREFLANG_LOCALES.includes(i18n.language) ? i18n.language : 'en';
  const canonicalPath = localizePath(activeLocale, basePath);
  const canonicalUrl = `${canonicalHost}${canonicalPath}`;

  // Localize title/description via i18n keys when provided; fall back to raw
  // strings so pre-F13 callers keep working.
  const effectiveTitle = titleKey ? t(titleKey, { defaultValue: title }) : title;
  const effectiveDescription = descriptionKey
    ? t(descriptionKey, { defaultValue: description })
    : description;

  const robotsContent = noindex ? 'noindex,nofollow' : 'index,follow';

  // Only emit hreflang alternates on indexable pages that actually have
  // locale variants. Noindex/private routes and EN-only pages skip them.
  const alternateLinks = noindex || !localized
    ? null
    : [
        ...HREFLANG_LOCALES.map((loc) => (
          <link
            key={`hreflang-${loc}`}
            rel="alternate"
            hrefLang={loc}
            href={`${canonicalHost}${localizePath(loc, basePath)}`}
          />
        )),
        <link
          key="hreflang-x-default"
          rel="alternate"
          hrefLang="x-default"
          href={`${canonicalHost}${localizePath('en', basePath)}`}
        />,
      ];

  return (
    <Helmet>
      <html lang={activeLocale} />
      <title>{effectiveTitle}</title>
      <meta name="description" content={effectiveDescription} />
      <link rel="canonical" href={canonicalUrl} />
      <meta name="robots" content={robotsContent} />

      {alternateLinks}

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={effectiveTitle} />
      <meta property="og:description" content={effectiveDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:locale" content={activeLocale} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content={String(ogImageWidth)} />
      <meta property="og:image:height" content={String(ogImageHeight)} />

      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={effectiveTitle} />
      <meta name="twitter:description" content={effectiveDescription} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}
