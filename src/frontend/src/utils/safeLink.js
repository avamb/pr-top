/**
 * Markdown link sanitising for assistant chat messages (LLM output is
 * untrusted). Only http:, https:, mailto: and same-site relative "/path" URLs
 * become links; anything else (javascript:, data:, vbscript:, protocol-relative
 * "//host", ...) is rendered as plain text.
 */

/**
 * @param {string} url - raw URL from the markdown link
 * @returns {{ href: string, external: boolean } | null} null when unsafe
 */
export function sanitizeLinkUrl(url) {
  if (typeof url !== 'string') return null;
  // Browsers ignore whitespace/control characters inside the scheme
  // ("java<TAB>script:"): strip them before checking.
  // eslint-disable-next-line no-control-regex
  const href = url.replace(/[\u0000- \u007f-\u009f]+/g, '');
  if (!href) return null;
  if (/^https?:\/\/[^/\\]/i.test(href) || /^mailto:\S/i.test(href)) {
    return { href, external: true };
  }
  // Relative site path: "/x" but not "//host" or "/\host"
  if (/^\/(?![/\\])/.test(href)) {
    return { href, external: false };
  }
  return null;
}
