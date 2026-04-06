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

module.exports = {
  sanitizeInput,
  detectInjection,
  getInjectionRejection,
  detectLanguage,
  INJECTION_PATTERNS,
  ROLE_MARKERS
};
