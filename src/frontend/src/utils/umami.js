/**
 * Umami Analytics utility - privacy-first, cookieless event tracking.
 *
 * Sends custom events to Umami if the tracking script is loaded.
 * Silently no-ops if Umami is not configured or blocked by AdBlock.
 *
 * @see https://umami.is/docs/track-events
 */

/**
 * Track a custom event in Umami.
 * @param {string} eventName - Event name (e.g., 'click-register', 'scroll-to-pricing')
 * @param {object} [eventData] - Optional event data payload
 */
export function trackUmamiEvent(eventName, eventData) {
  try {
    if (typeof window !== 'undefined' && typeof window.umami !== 'undefined') {
      window.umami.track(eventName, eventData);
    }
  } catch (e) {
    // Silently ignore - analytics should never break the app
  }
}
