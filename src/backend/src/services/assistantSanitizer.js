// Assistant Input Sanitizer & Prompt Injection Protection
// Strips role markers, detects injection patterns, and enforces output guardrails.

const { logger } = require('../utils/logger');

// === Injection Detection Patterns ===

// Common prompt injection phrases (case-insensitive matching)
const INJECTION_PATTERNS = [
  // Direct instruction override attempts
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/i,
  /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i,
  /override\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i,
  // Role playing / identity change
  /you\s+are\s+now\s+(a|an|the)\s+/i,
  /pretend\s+(to\s+be|you\s*(?:'re|are))\s/i,
  /act\s+as\s+(a|an|if)\s/i,
  /roleplay\s+as/i,
  /new\s+identity/i,
  /from\s+now\s+on\s+you\s+(are|will|must|should)/i,
  // System prompt extraction
  /(?:show|reveal|display|print|output|tell)\s+(?:me\s+)?(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?|rules?|guidelines?)/i,
  /what\s+(?:is|are)\s+(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?|rules?|guidelines?)/i,
  /repeat\s+(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?)/i,
  // Jailbreak keywords
  /\bdan\s*mode\b/i,
  /\bdev(?:eloper)?\s*mode\b/i,
  /\bjailbreak\b/i,
  /\bunfiltered\s*mode\b/i,
  /\bdo\s+anything\s+now\b/i,
  // Code execution attempts
  /(?:run|execute|eval)\s+(?:this\s+)?(?:code|command|script|sql|query)/i,
  /(?:modify|edit|change|delete|create|write)\s+(?:the\s+)?(?:code|file|database|source)/i,
  // Encoding bypass attempts
  /base64\s*(?:decode|encode)/i,
  /\bhex\s*(?:decode|encode)/i,
  // Token smuggling markers
  /\[SYSTEM\]/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
];

// Role markers to strip from user input
const ROLE_MARKERS = [
  /```system\b/gi,
  /```assistant\b/gi,
  /```user\b/gi,
  /\bsystem:\s*/gi,
  /\bassistant:\s*/gi,
  /\[system\]/gi,
  /\[assistant\]/gi,
  /\[user\]/gi,
  /<\|system\|>/gi,
  /<\|assistant\|>/gi,
  /<\|user\|>/gi,
  /<<SYS>>/gi,
  /<\/SYS>/gi,
  /<\|im_start\|>system/gi,
  /<\|im_start\|>assistant/gi,
  /<\|im_start\|>user/gi,
  /<\|im_end\|>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
];

/**
 * Sanitize user input by stripping role markers and special tokens.
 * @param {string} input - Raw user message
 * @returns {string} Sanitized message
 */
function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input;

  // Strip role markers
  for (const marker of ROLE_MARKERS) {
    sanitized = sanitized.replace(marker, '');
  }

  // Remove excessive whitespace left after stripping
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n').trim();

  return sanitized;
}

/**
 * Detect prompt injection attempts in user input.
 * @param {string} input - User message (can be pre-sanitized or raw)
 * @returns {{ isInjection: boolean, pattern?: string, confidence: 'high'|'medium'|'low' }}
 */
function detectInjection(input) {
  if (!input || typeof input !== 'string') return { isInjection: false };

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      const matchResult = input.match(pattern);
      return {
        isInjection: true,
        pattern: matchResult ? matchResult[0] : 'unknown',
        confidence: 'high'
      };
    }
  }

  // Medium confidence: check for suspicious structural patterns
  // Multiple "you must" / "you will" directives
  const directiveCount = (input.match(/you\s+(must|will|shall|should|have\s+to)\b/gi) || []).length;
  if (directiveCount >= 3) {
    return {
      isInjection: true,
      pattern: `multiple directives (${directiveCount})`,
      confidence: 'medium'
    };
  }

  return { isInjection: false };
}

/**
 * Get a rejection message for detected injection in the user's locale.
 * @param {string} locale - User's locale (en, ru, es, uk)
 * @returns {string} Polite rejection message
 */
function getInjectionRejection(locale) {
  const messages = {
    en: "I'm sorry, but I can only help with questions about using the PR-TOP platform. Could you please rephrase your question about the platform's features or functionality?",
    ru: "Извините, но я могу помочь только с вопросами по использованию платформы PR-TOP. Не могли бы вы переформулировать свой вопрос о функциях или возможностях платформы?",
    es: "Lo siento, solo puedo ayudar con preguntas sobre el uso de la plataforma PR-TOP. ¿Podría reformular su pregunta sobre las funciones o características de la plataforma?",
    uk: "Вибачте, але я можу допомогти лише з питаннями щодо використання платформи PR-TOP. Чи не могли б ви переформулювати своє запитання про функції або можливості платформи?"
  };
  return messages[locale] || messages.en;
}

/**
 * Simple language detection based on character ranges and common words.
 * Returns the detected language code or the default locale.
 * @param {string} text - User message text
 * @param {string} defaultLocale - Fallback locale
 * @returns {string} Detected language code (en, ru, es, uk)
 */
function detectLanguage(text, defaultLocale) {
  if (!text || typeof text !== 'string') return defaultLocale || 'en';

  const cleaned = text.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').trim();
  if (!cleaned) return defaultLocale || 'en';

  // Count Cyrillic characters
  const cyrillicCount = (cleaned.match(/[\u0400-\u04FF]/g) || []).length;
  const latinCount = (cleaned.match(/[a-z]/g) || []).length;
  const totalLetters = cyrillicCount + latinCount;

  if (totalLetters === 0) return defaultLocale || 'en';

  const cyrillicRatio = cyrillicCount / totalLetters;

  // If mostly Cyrillic, determine which Cyrillic language
  if (cyrillicRatio > 0.5) {
    // Ukrainian-specific characters: і, ї, є, ґ
    const ukrainianChars = (cleaned.match(/[іїєґ]/g) || []).length;
    if (ukrainianChars > 0) return 'uk';

    // Otherwise default to Russian for Cyrillic text
    return 'ru';
  }

  // If mostly Latin, check for Spanish indicators
  if (latinCount > 0) {
    // Spanish-specific patterns
    const spanishIndicators = (cleaned.match(/[áéíóúñ¿¡]/g) || []).length;
    const spanishWords = ['cómo', 'qué', 'dónde', 'cuándo', 'por qué', 'puedo', 'necesito', 'quiero', 'hola', 'gracias', 'ayuda'];
    const hasSpanishWord = spanishWords.some(w => cleaned.includes(w));

    if (spanishIndicators > 0 || hasSpanishWord) return 'es';
  }

  // Default to English for Latin text, or the default locale
  return latinCount > cyrillicCount ? 'en' : (defaultLocale || 'en');
}

// === Output Guardrail: Secret Redaction ===
//
// Feature #436 (S3): redact anything that resembles a credential BEFORE the
// reply is sent to the client OR cached. Cheap, independent safety net that
// complements input sanitization / prompt injection defenses.
//
// Redacted patterns:
//   - OpenAI-style API keys:  sk-[A-Za-z0-9-_]{20,}
//   - Anthropic-style keys:   sk-ant-[A-Za-z0-9-_]{20,} (matched by above too)
//   - Bearer tokens:          "Bearer <token>"
//   - Env-style assignments:  *_API_KEY=..., *_SECRET=..., *_TOKEN=..., PASSWORD=...
//   - JWTs:                   eyJ<base64>.<base64>.<base64>
//   - Long hex/base64 blobs:  >=32 chars of [A-Fa-f0-9] or base64url alphabet
//
// Every match is replaced with the literal string "[REDACTED]".

const REDACTION = '[REDACTED]';

// Ordered so that the most specific patterns match first (before the generic
// long-hex/base64 catch-all).
const OUTPUT_REDACTION_PATTERNS = [
  // OpenAI-style API keys (also covers sk-ant-, sk-proj-, sk-or-, etc.)
  { name: 'openai_key', re: /sk-[A-Za-z0-9_-]{20,}/g },
  // Bearer tokens in Authorization-style strings
  { name: 'bearer_token', re: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/g },
  // Env-style assignments: FOO_API_KEY=..., FOO_SECRET=..., FOO_TOKEN=..., PASSWORD=...
  // Redact only the value portion, keep the key name so the message still reads.
  {
    name: 'env_assignment',
    re: /\b((?:[A-Z][A-Z0-9_]*_)?(?:API_KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY))\s*=\s*['"]?[^\s'"]+['"]?/g,
    replacement: (_m, key) => `${key}=${REDACTION}`,
  },
  // JWTs: three dot-separated base64url segments, first begins with "eyJ"
  { name: 'jwt', re: /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g },
  // Long hex blob (>=32 chars).  Word-bounded to avoid mid-word matches.
  { name: 'long_hex', re: /\b[A-Fa-f0-9]{32,}\b/g },
  // Long base64/base64url blob (>=32 chars).  Requires at least one non-hex char
  // to avoid double-matching hex blobs and to skip plain English words.
  {
    name: 'long_base64',
    re: /\b(?=[A-Za-z0-9+/_-]{32,}\b)[A-Za-z0-9+/_-]*[+/_-][A-Za-z0-9+/_-]{20,}\b/g,
  },
];

/**
 * Redact anything that looks like a secret from assistant output.
 *
 * Safe to call on empty / non-string values (returns them unchanged).
 * Idempotent: calling twice yields the same result.
 *
 * @param {string} text - Assistant reply text (fully accumulated, not a chunk).
 * @returns {string} Text with secret-shaped substrings replaced by "[REDACTED]".
 */
function sanitizeOutput(text) {
  if (!text || typeof text !== 'string') return text || '';

  let out = text;
  for (const { re, replacement } of OUTPUT_REDACTION_PATTERNS) {
    // Reset lastIndex — patterns use the /g flag and are module-level singletons.
    re.lastIndex = 0;
    if (typeof replacement === 'function') {
      out = out.replace(re, replacement);
    } else {
      out = out.replace(re, REDACTION);
    }
  }

  return out;
}

module.exports = {
  sanitizeInput,
  sanitizeOutput,
  detectInjection,
  getInjectionRejection,
  detectLanguage,
  INJECTION_PATTERNS,
  ROLE_MARKERS,
  OUTPUT_REDACTION_PATTERNS,
};
