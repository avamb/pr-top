import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

/**
 * Seo — per-route SEO meta component (SEO Foundation F3).
 *
 * Emits:
 *   - <title>
 *   - <meta name="description">
 *   - <link rel="canonical" href="https://pr-top.com{path}">
 *   - <meta name="robots">
 *   - Open Graph tags (og:title, og:description, og:url, og:type, og:image)
 *   - Twitter Card tags (twitter:card, twitter:title, twitter:description, twitter:image)
 *
 * Props:
 *   - title          (string, required)      -> <title> + og:title + twitter:title
 *   - description    (string, required)      -> meta description + og:description + twitter:description
 *   - path           (string, optional)      -> canonical URL suffix; defaults to current pathname
 *   - noindex        (bool, optional)        -> emits robots=noindex,nofollow; otherwise index,follow
 *   - ogType         (string, optional)      -> og:type; defaults to 'website'
 *   - ogImage        (string, optional)      -> og:image + twitter:image; defaults to the absolute
 *                                                URL of /images/og-default.png (1200×630 PNG)
 *   - twitterCard    (string, optional)      -> twitter:card; defaults to 'summary_large_image'
 *   - canonicalHost  (string, optional)      -> canonical host; defaults to 'https://pr-top.com'
 */
export default function Seo({
  title,
  description,
  path,
  noindex = false,
  ogType = 'website',
  ogImage = 'https://pr-top.com/images/og-default.png',
  ogImageWidth = 1200,
  ogImageHeight = 630,
  twitterCard = 'summary_large_image',
  canonicalHost = 'https://pr-top.com',
}) {
  const location = useLocation();
  const effectivePath = typeof path === 'string' ? path : location.pathname;
  const canonicalUrl = `${canonicalHost}${effectivePath}`;
  const robotsContent = noindex ? 'noindex,nofollow' : 'index,follow';

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      <meta name="robots" content={robotsContent} />

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content={String(ogImageWidth)} />
      <meta property="og:image:height" content={String(ogImageHeight)} />

      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}
