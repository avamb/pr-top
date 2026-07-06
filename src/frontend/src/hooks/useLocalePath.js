import { useTranslation } from 'react-i18next';
import { LOCALES } from '../seo/routes.mjs';

/**
 * Returns a function that prefixes an internal path with the active locale
 * ("/privacy" -> "/ru/privacy") so navigation keeps the visitor inside the
 * language tree they are browsing. English (root tree) returns paths as-is.
 *
 * Only use for routes that exist in every locale (the PUBLIC_ROUTES tree,
 * including /compare/* and /alternatives/*). App/auth routes (/login,
 * /register, ...) are not locale-prefixed and must not be wrapped.
 */
export default function useLocalePath() {
  const { i18n } = useTranslation();
  const locale = LOCALES.includes(i18n.language) ? i18n.language : null;
  return (path) => {
    if (!locale) return path;
    return path === '/' ? `/${locale}` : `/${locale}${path}`;
  };
}
