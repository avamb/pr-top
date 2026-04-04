/**
 * Format a timestamp string in the user's configured timezone.
 * Falls back to browser locale if no timezone is provided.
 *
 * @param {string|Date} dateInput - ISO 8601 date string or Date object
 * @param {object} [options] - Options
 * @param {string} [options.timezone] - IANA timezone (e.g. 'America/New_York')
 * @param {boolean} [options.dateOnly] - If true, only show date (no time)
 * @param {boolean} [options.relative] - If true, show relative time for recent dates
 * @returns {string} Formatted date string
 */
export function formatDate(dateInput, options = {}) {
  if (!dateInput) return '';

  var date;
  try {
    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      // SQLite datetime('now') returns UTC timestamps like '2026-04-04 15:00:00'
      // without a 'Z' suffix or timezone offset. JavaScript new Date() parses
      // such strings as LOCAL time, causing a shift equal to the user's UTC offset.
      // Normalize by replacing the space with 'T' and appending 'Z' so that
      // new Date() treats it as UTC.
      var normalized = dateInput;
      if (!/[Z+\-]\d{0,4}:?\d{0,2}$/.test(dateInput.trim()) && /^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}/.test(dateInput.trim())) {
        normalized = dateInput.trim().replace(' ', 'T');
        if (!normalized.endsWith('Z')) {
          normalized += 'Z';
        }
      }
      date = new Date(normalized);
    } else {
      date = new Date(dateInput);
    }
    if (isNaN(date.getTime())) return String(dateInput);
  } catch (e) {
    return String(dateInput);
  }

  var tz = options.timezone;
  var localeOptions = {};

  if (tz) {
    try {
      // Validate the timezone by trying to use it
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      localeOptions.timeZone = tz;
    } catch (e) {
      // Invalid timezone, fall back to browser default
    }
  }

  if (options.dateOnly) {
    return date.toLocaleDateString(undefined, localeOptions);
  }

  return date.toLocaleString(undefined, localeOptions);
}

/**
 * Get the user's configured timezone from localStorage.
 * @returns {string|undefined} The timezone string or undefined
 */
export function getUserTimezone() {
  try {
    var stored = localStorage.getItem('user');
    if (stored) {
      var user = JSON.parse(stored);
      return user.timezone || undefined;
    }
  } catch (e) {
    // ignore
  }
  return undefined;
}

/**
 * Format date using the stored user timezone.
 * Convenience wrapper combining getUserTimezone + formatDate.
 */
export function formatUserDate(dateInput, options = {}) {
  var tz = getUserTimezone();
  return formatDate(dateInput, { ...options, timezone: tz });
}

/**
 * Format date only (no time) using the stored user timezone.
 */
export function formatUserDateOnly(dateInput) {
  return formatUserDate(dateInput, { dateOnly: true });
}
