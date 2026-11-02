// Public Assistant Chat API - No authentication required
// For anonymous visitors on the landing page (limited to 5 messages per session)

const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');
const aiProviders = require('../services/aiProviders');
const { buildAssistantSystemPrompt } = require('../services/assistantPrompt');
const assistantCache = require('../services/assistantCache');
const assistantKnowledge = require('../services/assistantKnowledge');
const { sanitizeInput, sanitizeOutput, detectInjection, getInjectionRejection, detectLanguage } = require('../services/assistantSanitizer');

const { getClientIp } = require('../utils/clientIp');
const { checkSpendingLimit, logUsage, calculateCost } = require('../services/aiUsageLogger');

const MAX_MESSAGES_PER_SESSION = 5;

function envPositiveInt(name, fallback) {
  const n = parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// H9: ids are server-issued, so the per-session cap can only be dodged by starting
// new sessions. Three independent limits bound that. All are read per request so
// they can be tuned via env without a code change.
//  1) Per IP: max NEW sessions created from one IP in the last 24h (only applied
//     when a new session would be created - never to an existing session, so
//     CGNAT / office users who already have a session are not locked out).
//     The IP comes from utils/clientIp (CF-Connecting-IP, else req.ip) - never from
//     a client-controlled X-Forwarded-For. CF-Connecting-IP is only trustworthy
//     while the origin is firewalled to Cloudflare, hence (2) and (3).
//  2) Global, IP-independent: max new sessions / max messages per rolling 24h.
//  3) Global monthly USD budget for public-chat LLM calls (0 = unlimited), in
//     addition to the platform-wide checkSpendingLimit().
const ipDailyMaxNewSessions = () => envPositiveInt('PUBLIC_ASSISTANT_IP_DAILY_MAX', 50);
const globalDailyMaxSessions = () => envPositiveInt('PUBLIC_ASSISTANT_GLOBAL_DAILY_SESSIONS', 2000);
const globalDailyMaxMessages = () => envPositiveInt('PUBLIC_ASSISTANT_GLOBAL_DAILY_MESSAGES', 10000);
const publicMonthlyLimitUsd = () => {
  const n = parseFloat(process.env.PUBLIC_ASSISTANT_MONTHLY_LIMIT_USD || '0');
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const PUBLIC_USAGE_OPERATION = 'public_assistant';
// ai_usage_log.therapist_id sentinel for anonymous public-chat calls (same
// convention as audit_logs.actor_id = 0).
const PUBLIC_USAGE_USER_ID = 0;

// === Rate Limiting for public chat ===
// Feature #438 (S5) — Public-bot economics guard.
//
// Three layers, cheap and independent, all in addition to the existing
// per-session hard message-count cap enforced downstream:
//   1) IP-based:      max PUBLIC_RATE_LIMIT_MAX messages per 60s (spam control).
//   2) Per-session:   max PUBLIC_SESSION_RATE_LIMIT_MAX per 60s per session_uuid
//                     (a single browser tab cannot fan out cost via IP rotation).
//   3) Per-lead:      max PUBLIC_LEAD_RATE_LIMIT_MAX per 60s per email
//                     (a lead cannot burn tokens across many session UUIDs).
// Cheap approximation of a cost guard: token budget is bounded above by
// max_tokens (600 for the public bot), so message-rate ≈ cost-rate.
const publicRateLimitMap = new Map();
const publicSessionRateLimitMap = new Map();
const publicLeadRateLimitMap = new Map();

const PUBLIC_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const PUBLIC_RATE_LIMIT_MAX = 10;
const PUBLIC_SESSION_RATE_LIMIT_MAX = 6;
const PUBLIC_LEAD_RATE_LIMIT_MAX = 8;

function _checkBucket(map, key, max) {
  const now = Date.now();
  const k = String(key || 'unknown');

  if (!map.has(k)) {
    map.set(k, []);
  }
  const timestamps = map.get(k);
  const cutoff = now - PUBLIC_RATE_LIMIT_WINDOW_MS;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= max) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((timestamps[0] + PUBLIC_RATE_LIMIT_WINDOW_MS - now) / 1000)
    };
  }

  timestamps.push(now);
  return { allowed: true, remaining: max - timestamps.length };
}

function checkPublicRateLimit(ip) {
  return _checkBucket(publicRateLimitMap, ip, PUBLIC_RATE_LIMIT_MAX);
}
function checkPublicSessionRateLimit(sessionUuid) {
  return _checkBucket(publicSessionRateLimitMap, sessionUuid, PUBLIC_SESSION_RATE_LIMIT_MAX);
}
function checkPublicLeadRateLimit(email) {
  if (!email) return { allowed: true, remaining: PUBLIC_LEAD_RATE_LIMIT_MAX };
  return _checkBucket(publicLeadRateLimitMap, String(email).toLowerCase(), PUBLIC_LEAD_RATE_LIMIT_MAX);
}

// Periodic cleanup (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const cutoff = now - PUBLIC_RATE_LIMIT_WINDOW_MS * 2;
  for (const map of [publicRateLimitMap, publicSessionRateLimitMap, publicLeadRateLimitMap]) {
    for (const [key, timestamps] of map.entries()) {
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] < cutoff) {
        map.delete(key);
      }
    }
  }
}, 5 * 60 * 1000);

// Helper: look up a viewer session by the id the client presented, or create a
// new one. Session ids are server-issued (H9): an unknown, malformed or missing id
// is NOT adopted - a fresh crypto-random uuid is generated and returned to the
// client, so a client cannot mint ids to reset its message count.
function findViewerSession(db, claimedUuid) {
  if (typeof claimedUuid === 'string' && claimedUuid.length >= 10 && claimedUuid.length <= 100) {
    const existing = db.exec(
      'SELECT id, message_count, email, user_id FROM viewer_sessions WHERE uuid = ?',
      [claimedUuid]
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      const [id, messageCount, email, userId] = existing[0].values[0];
      return { id, uuid: claimedUuid, messageCount, isNew: false, email, userId };
    }
  }
  return null;
}

function createViewerSession(db, ip, userAgent, language) {
  const uuid = crypto.randomUUID();
  const fingerprint = `${ip}|${(userAgent || '').substring(0, 100)}`;
  db.run(
    "INSERT INTO viewer_sessions (uuid, ip, fingerprint, user_agent, language, created_at, last_active, message_count) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), 0)",
    [uuid, ip || null, fingerprint, (userAgent || '').substring(0, 500), language || 'en']
  );
  const idResult = db.exec('SELECT last_insert_rowid()');
  const id = idResult[0].values[0][0];
  saveDatabaseAfterWrite();
  return { id, uuid, messageCount: 0, isNew: true };
}

function scalar(db, sql, params) {
  const res = db.exec(sql, params || []);
  return res.length && res[0].values.length ? Number(res[0].values[0][0]) || 0 : 0;
}

// Sessions created from this IP in the last 24h.
function newSessionsFromIp(db, ip) {
  return scalar(db, "SELECT COUNT(*) FROM viewer_sessions WHERE ip = ? AND created_at >= datetime('now', '-1 day')", [ip]);
}

// IP-independent global usage over the last 24h.
function globalNewSessions24h(db) {
  return scalar(db, "SELECT COUNT(*) FROM viewer_sessions WHERE created_at >= datetime('now', '-1 day')");
}
function globalMessages24h(db) {
  return scalar(db,
    "SELECT COUNT(*) FROM assistant_messages am JOIN assistant_conversations ac ON ac.id = am.conversation_id " +
    "WHERE am.role = 'user' AND ac.page_context = 'landing' AND am.created_at >= datetime('now', '-1 day')");
}

// Public-chat LLM spend this calendar month (USD), from ai_usage_log.
function publicSpendThisMonth(db) {
  const now = new Date();
  const monthStart = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
  return scalar(db,
    'SELECT COALESCE(SUM(cost_usd), 0) FROM ai_usage_log WHERE therapist_id = ? AND operation = ? AND timestamp >= ?',
    [PUBLIC_USAGE_USER_ID, PUBLIC_USAGE_OPERATION, monthStart]);
}

// Rough token estimate (~4 chars/token) for providers/streams that report none.
function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

// Record a public-chat LLM call so checkSpendingLimit() and the admin usage UI
// account for it. Never throws.
function recordPublicUsage(provider, model, inTokens, outTokens, estimated) {
  try {
    const cost = calculateCost(model, inTokens, outTokens);
    logUsage(PUBLIC_USAGE_USER_ID, provider || 'unknown', model || 'unknown', PUBLIC_USAGE_OPERATION,
      inTokens, outTokens, cost, null, { estimated: !!estimated });
  } catch (e) {
    logger.warn('[PublicAssistant] usage log failed: ' + e.message);
  }
}

const ANON_LIMIT_MESSAGES = {
  en: 'You have reached the message limit for anonymous chat. Please register for a free trial to continue the conversation!',
  ru: 'Вы достигли лимита сообщений для анонимного чата. Зарегистрируйтесь для бесплатного пробного периода, чтобы продолжить!',
  es: 'Has alcanzado el limite de mensajes para el chat anonimo. Registrate para una prueba gratuita para continuar la conversacion!',
  uk: 'Ви досягли ліміту повідомлень для анонімного чату. Зареєструйтесь для безкоштовного пробного періоду, щоб продовжити!'
};

// Shown when an IP-independent / IP-new-session cap is hit. Deliberately NOT the
// registration CTA: registering would not help, and it would funnel capped
// visitors into the lead form.
const TRY_LATER_MESSAGES = {
  en: 'The assistant is very busy right now. Please try again later.',
  ru: 'Ассистент сейчас сильно загружен. Пожалуйста, попробуйте позже.',
  es: 'El asistente esta muy ocupado ahora mismo. Intentalo de nuevo mas tarde.',
  uk: 'Асистент зараз дуже завантажений. Будь ласка, спробуйте пізніше.'
};

const ASSISTANT_UNAVAILABLE_MESSAGES = {
  en: 'The assistant is temporarily unavailable. Please try again later.',
  ru: 'Ассистент временно недоступен. Пожалуйста, попробуйте позже.',
  es: 'El asistente no esta disponible temporalmente. Intentalo de nuevo mas tarde.',
  uk: 'Асистент тимчасово недоступний. Будь ласка, спробуйте пізніше.'
};

// Helper: save public chat exchange to analytics tables
function savePublicChatExchange(db, viewerSessionId, sanitized, assistantReply, fromCache, language, conversationId) {
  try {
    let convId = conversationId;

    // conversation_id comes from the client: continue it only if it is a landing
    // conversation that was created by THIS viewer session. (auth.js may later
    // re-parent it to the registered viewer user; viewer_session_id stays.)
    if (convId) {
      const owned = db.exec(
        "SELECT 1 FROM assistant_conversations WHERE id = ? AND page_context = 'landing' AND viewer_session_id = ?",
        [Number.isInteger(convId) ? convId : -1, viewerSessionId]
      );
      if (!owned.length || !owned[0].values.length) convId = null;
    }

    if (!convId) {
      // Create a new conversation with therapist_id = 0 (anonymous), bound to
      // the viewer session that created it.
      db.run(
        "INSERT INTO assistant_conversations (therapist_id, started_at, last_message_at, page_context, language, message_count, viewer_session_id) VALUES (0, datetime('now'), datetime('now'), 'landing', ?, 2, ?)",
        [language, viewerSessionId]
      );
      const convIdResult = db.exec('SELECT last_insert_rowid()');
      convId = convIdResult[0].values[0][0];
    } else {
      db.run(
        "UPDATE assistant_conversations SET last_message_at = datetime('now'), message_count = message_count + 2 WHERE id = ?",
        [convId]
      );
    }

    // Save messages
    db.run(
      "INSERT INTO assistant_messages (conversation_id, role, content, is_cached, tokens_used, tags, created_at) VALUES (?, 'user', ?, 0, 0, 'question', datetime('now'))",
      [convId, sanitized]
    );
    db.run(
      "INSERT INTO assistant_messages (conversation_id, role, content, is_cached, tokens_used, tags, created_at) VALUES (?, 'assistant', ?, ?, 0, NULL, datetime('now'))",
      [convId, assistantReply, fromCache ? 1 : 0]
    );

    // viewer_sessions.message_count was already reserved atomically before the
    // reply was generated (see the handler), so it is not incremented here.
    saveDatabaseAfterWrite();
    return convId;
  } catch (err) {
    logger.warn('[PublicAssistant] Analytics save error: ' + err.message);
    return null; // never echo a client-supplied conversation_id back
  }
}

// POST /api/assistant/public-chat
router.post('/public-chat', async (req, res) => {
  // Message reserved on viewer_sessions.message_count; given back (outer catch)
  // if the request dies before any reply was produced.
  let reservedSessionId = null;
  let replyProduced = false;
  try {
    const { message, session_uuid, language, stream, conversation_id } = req.body;
    const useSSE = stream === true || req.headers.accept === 'text/event-stream';
    const uiLocale = language || req.headers['x-locale'] || 'en';
    // H9: trusted client IP (CF-Connecting-IP, else req.ip) - not X-Forwarded-For.
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
    }

    // session_uuid is optional and only a lookup hint: ids are issued by the
    // server (see getOrCreateViewerSession) and returned in every reply.
    if (session_uuid !== undefined && session_uuid !== null && typeof session_uuid !== 'string') {
      return res.status(400).json({ error: 'session_uuid must be a string' });
    }

    // IP-based rate limiting
    const rateCheck = checkPublicRateLimit(clientIp);
    if (!rateCheck.allowed) {
      logger.warn(`[PublicAssistant] Rate limit exceeded for IP ${clientIp}`);
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait before sending more messages.',
        retry_after: rateCheck.resetIn
      });
    }

    // Prompt injection detection
    const sanitized = sanitizeInput(message.trim());
    const injectionResult = detectInjection(sanitized);
    if (injectionResult.isInjection) {
      logger.warn(`[PublicAssistant] Prompt injection detected from IP ${clientIp}: pattern="${injectionResult.pattern}"`);
      const detectedLang = detectLanguage(sanitized, uiLocale);
      const rejectionMessage = getInjectionRejection(detectedLang);

      if (useSSE) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: rejectionMessage })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', language: detectedLang, cached: false })}\n\n`);
        return res.end();
      }

      return res.json({
        response: rejectionMessage,
        language: detectedLang,
        cached: false
      });
    }

    const db = getDatabase();

    // AI spend limit (H9): the same platform-wide monthly cap the other AI paths
    // honour. Checked on every message, before anything that can cost tokens
    // (embedding for the cache/RAG lookup, LLM call).
    const spend = checkSpendingLimit();
    if (spend && spend.allowed === false) {
      logger.warn('[PublicAssistant] AI spending limit reached - refusing public chat message');
      const unavailableLang = detectLanguage(sanitized, uiLocale);
      return res.status(503).json({
        error: ASSISTANT_UNAVAILABLE_MESSAGES[unavailableLang] || ASSISTANT_UNAVAILABLE_MESSAGES.en,
        code: 'assistant_unavailable'
      });
    }

    // Optional global monthly USD budget for the public bot (0 = unlimited).
    const publicLimit = publicMonthlyLimitUsd();
    if (publicLimit > 0 && publicSpendThisMonth(db) >= publicLimit) {
      logger.warn('[PublicAssistant] public-chat monthly budget reached - refusing message');
      const budgetLang = detectLanguage(sanitized, uiLocale);
      res.set('Retry-After', '3600');
      return res.status(503).json({
        error: ASSISTANT_UNAVAILABLE_MESSAGES[budgetLang] || ASSISTANT_UNAVAILABLE_MESSAGES.en,
        code: 'assistant_unavailable'
      });
    }

    const tryLater = (reason) => {
      logger.warn(`[PublicAssistant] ${reason} - asking visitor to try later`);
      const lang = detectLanguage(sanitized, uiLocale);
      res.set('Retry-After', '3600');
      return res.status(503).json({
        error: TRY_LATER_MESSAGES[lang] || TRY_LATER_MESSAGES.en,
        code: 'public_assistant_busy'
      });
    };

    // IP-independent global daily message cap (CF-Connecting-IP spoofing cannot
    // dodge it).
    if (globalMessages24h(db) >= globalDailyMaxMessages()) {
      return tryLater('global daily message cap reached');
    }

    // Get the viewer session. Only when a NEW session would be created do the
    // new-session caps apply (global, then per IP); existing sessions - including
    // leads - are never blocked by them.
    let session = findViewerSession(db, session_uuid);
    if (!session) {
      if (globalNewSessions24h(db) >= globalDailyMaxSessions()) {
        return tryLater('global daily new-session cap reached');
      }
      if (newSessionsFromIp(db, clientIp) >= ipDailyMaxNewSessions()) {
        return tryLater(`per-IP new-session cap reached for ${clientIp}`);
      }
      session = createViewerSession(db, clientIp, userAgent, uiLocale);
    }

    // Per-session burst guard (Feature #438 S5), keyed by the SERVER-issued id.
    const sessionRateCheck = checkPublicSessionRateLimit(session.uuid);
    if (!sessionRateCheck.allowed) {
      logger.warn(`[PublicAssistant] Session rate limit exceeded for session ${session.uuid}`);
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait before sending more messages.',
        retry_after: sessionRateCheck.resetIn,
        session_uuid: session.uuid
      });
    }

    // Determine effective message limit based on lead status
    let effectiveLimit = MAX_MESSAGES_PER_SESSION; // 5 for anonymous
    let isLead = false;
    let leadVerified = false;

    if (session.email) {
      // Check leads table for extended limits
      try {
        const leadResult = db.exec(
          'SELECT id, verified, extra_messages_limit FROM leads WHERE email = ?',
          [session.email]
        );
        if (leadResult.length > 0 && leadResult[0].values.length > 0) {
          const [, verified, extraLimit] = leadResult[0].values[0];
          isLead = true;
          leadVerified = !!verified;
          effectiveLimit = MAX_MESSAGES_PER_SESSION + (extraLimit || 10);
        }
      } catch (e) {
        logger.warn('[PublicAssistant] Lead lookup error: ' + e.message);
      }
    }

    // Feature #438 (S5): per-lead guard — closes multi-session token-burn loophole.
    if (session.email) {
      const leadRateCheck = checkPublicLeadRateLimit(session.email);
      if (!leadRateCheck.allowed) {
        logger.warn(`[PublicAssistant] Lead rate limit exceeded for email ${session.email}`);
        return res.status(429).json({
          error: 'Rate limit exceeded. Please wait before sending more messages.',
          retry_after: leadRateCheck.resetIn
        });
      }
    }

    // Check the message limit and reserve this message in one synchronous step,
    // so concurrent requests cannot all pass the check before any of them counts.
    db.run(
      "UPDATE viewer_sessions SET message_count = message_count + 1, last_active = datetime('now') WHERE id = ? AND message_count < ?",
      [session.id, effectiveLimit]
    );
    const reserved = db.getRowsModified() > 0;
    if (reserved) {
      reservedSessionId = session.id;
      saveDatabaseAfterWrite();
    }
    if (!reserved) {
      const detectedLang = detectLanguage(sanitized, uiLocale);

      if (isLead) {
        // Lead has used all extended messages
        const limitMessages = {
          en: 'You have used all your available messages. Register for a free trial to get full access to the platform!',
          ru: 'Вы использовали все доступные сообщения. Зарегистрируйтесь для бесплатного пробного периода, чтобы получить полный доступ!',
          es: 'Has usado todos tus mensajes disponibles. Registrate para una prueba gratuita y obtener acceso completo!',
          uk: 'Ви використали всі доступні повідомлення. Зареєструйтесь для безкоштовного пробного періоду, щоб отримати повний доступ!'
        };
        const limitMsg = limitMessages[detectedLang] || limitMessages.en;
        return res.status(403).json({
          error: 'message_limit_reached',
          message: limitMsg,
          limit: effectiveLimit,
          session_uuid: session.uuid,
          show_cta: false,
          show_register: true
        });
      }

      // Anonymous - show lead capture CTA
      const limitMsg = ANON_LIMIT_MESSAGES[detectedLang] || ANON_LIMIT_MESSAGES.en;

      return res.status(403).json({
        error: 'message_limit_reached',
        message: limitMsg,
        limit: MAX_MESSAGES_PER_SESSION,
        session_uuid: session.uuid,
        show_cta: true
      });
    }

    // Language detection
    const detectedLanguage = detectLanguage(sanitized, uiLocale);

    let assistantReply;
    let fromCache = false;

    // Feature #440 (S7): check the cache on EVERY message (not just the first).
    // The previous `session.messageCount === 0` guard meant a rephrased or
    // repeated question later in the same session still called the LLM. Public
    // bot always searches the 'public' audience so 'user'-scoped seeds (kept
    // for the signed-in bot) can never leak. Locale is passed so an English
    // seed is not served for a Russian question — fall through to the LLM.
    {
      const cacheResult = await assistantCache.findCachedAnswer(sanitized, 'public', detectedLanguage);
      if (cacheResult.hit) {
        assistantReply = cacheResult.answer;
        fromCache = true;
        logger.info(`[PublicAssistant] Serving cached answer (id: ${cacheResult.cached_id}, seed=${!!cacheResult.is_seed})`);
      }
    }

    // If cached, return immediately
    if (fromCache) {
      // Output guardrail (feature #436): redact secret-shaped strings from the
      // cached reply before it leaves the server. Cached entries were sanitized
      // at store time, but re-sanitize defensively in case older entries slipped
      // through.
      assistantReply = sanitizeOutput(assistantReply);
      replyProduced = true;
      const convId = savePublicChatExchange(db, session.id, sanitized, assistantReply, true, detectedLanguage, conversation_id || null);

      if (useSSE) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: assistantReply })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', session_uuid: session.uuid, conversation_id: convId, language: detectedLanguage, cached: true, messages_remaining: effectiveLimit - session.messageCount - 1 })}\n\n`);
        return res.end();
      }

      return res.json({
        response: assistantReply,
        session_uuid: session.uuid,
        conversation_id: convId,
        language: detectedLanguage,
        cached: true,
        messages_remaining: effectiveLimit - session.messageCount - 1
      });
    }

    // RAG: Search knowledge base
    let ragContext = '';
    let hasRagContext = false;
    try {
      // S2 (feature #435): scope RAG to 'public'-tagged chunks ONLY. The
      // anonymous landing-page bot must never see 'user'-audience how-to docs.
      const kbResults = await assistantKnowledge.search(sanitized, 3, 'public');
      if (kbResults.length > 0) {
        const contextParts = kbResults
          .filter(r => r.similarity > 0.1)
          .map(r => `[Source: ${r.source_file} (${r.source_type})]\n${r.chunk_text}`);
        if (contextParts.length > 0) {
          ragContext = '\n\n## RELEVANT PLATFORM DOCUMENTATION\n' +
            'Use the following context to help answer the user\'s question:\n\n' +
            contextParts.join('\n\n---\n\n');
          hasRagContext = true;
        }
      }
    } catch (ragError) {
      logger.warn('[PublicAssistant] RAG search error: ' + ragError.message);
    }

    // Build system prompt (public/visitor context) using viewer-specific prompts
    let systemPrompt = buildAssistantSystemPrompt({
      pageContext: 'landing',
      locale: detectedLanguage,
      plan: 'visitor',
      role: 'visitor',
      shouldPromptFeedback: false,
      db: db,
      messageCount: session.messageCount
    }) + ragContext + '\n\nIMPORTANT: This is an anonymous visitor on the landing page. They are NOT a registered user. Keep answers concise and helpful. Encourage them to register for a free trial if they want to use the platform. Do not discuss specific client data or admin features in detail.';

    // When RAG context is empty, instruct the AI not to hallucinate
    if (!hasRagContext) {
      const noKnowledgeFallbacks = {
        en: '\n\nIMPORTANT: No relevant documentation was found in the knowledge base for this query. You MUST NOT guess or invent features that may not exist. If the question is about a specific platform feature, workflow, or setting, say that you don\'t have detailed information about this topic in your current knowledge base and suggest the visitor register for a free trial to explore the platform.',
        ru: '\n\nВАЖНО: В базе знаний не найдена релевантная документация по этому запросу. Вы НЕ ДОЛЖНЫ угадывать или придумывать функции, которых может не существовать. Если вопрос касается конкретной функции платформы, скажите, что у вас нет подробной информации по этой теме, и предложите посетителю зарегистрироваться для пробного периода.',
        es: '\n\nIMPORTANTE: No se encontró documentación relevante en la base de conocimientos para esta consulta. NO DEBE adivinar ni inventar funciones que pueden no existir. Si la pregunta es sobre una función específica de la plataforma, diga que no tiene información detallada sobre este tema y sugiera al visitante registrarse para una prueba gratuita.',
        uk: '\n\nВАЖЛИВО: У базі знань не знайдено релевантної документації для цього запиту. Ви НЕ ПОВИННІ вгадувати або вигадувати функції, яких може не існувати. Якщо питання стосується конкретної функції платформи, скажіть, що у вас немає детальної інформації з цієї теми, і запропонуйте відвідувачу зареєструватися для пробного періоду.'
      };
      systemPrompt += noKnowledgeFallbacks[detectedLanguage] || noKnowledgeFallbacks.en;
    }

    // Build messages (just the current exchange for public chat - no history beyond conversation)
    const aiMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: sanitized }
    ];

    const activeAssistant = aiProviders.getActiveAssistantProvider(db);

    // SSE Streaming Path
    if (useSSE) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      try {
        let fullText = '';
        const streamGen = aiProviders.chatStream(aiMessages, {
          temperature: 0.7,
          // Feature #438 (S5): FAQ-length answers only for the anonymous
          // public bot. 600 is enough for a 2–3 paragraph reply; capping here
          // bounds per-question cost. Authenticated therapist assistant keeps
          // 1500 (see src/backend/src/routes/assistant.js).
          max_tokens: 600,
          purpose: 'assistant',
          provider: activeAssistant.providerName,
          model: activeAssistant.model
        }, db);

        // Feature #436 output guardrail: buffer the accumulated stream and run
        // sanitizeOutput ONCE before flushing. Streaming raw chunks would risk
        // leaking a secret split across chunk boundaries (e.g. "sk-" in one
        // chunk, the rest in the next). We accept a small UX cost (typing
        // indicator instead of token-by-token render) to guarantee no
        // credential ever reaches the wire unredacted.
        for await (const chunk of streamGen) {
          if (chunk.text) {
            fullText += chunk.text;
          }
          if (chunk.done && chunk.fullText) {
            fullText = chunk.fullText;
          }
        }

        assistantReply = sanitizeOutput(fullText || '');
        replyProduced = true;
        // Streams report no usage: log an estimate so the spend limit sees the call.
        recordPublicUsage(activeAssistant.providerName, activeAssistant.model,
          estimateTokens(systemPrompt) + estimateTokens(sanitized), estimateTokens(fullText), true);
        // Emit the sanitized reply as a single chunk before the terminal done event.
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: assistantReply })}\n\n`);
        // Feature #438 (S5): pass hasRagContext as the 3rd arg — without it,
        // storeCachedAnswer's poisoning guard skips the write and the cache
        // never populates. Sanitized reply is stored so a later cache hit
        // cannot leak stale credentials.
        await assistantCache.storeCachedAnswer(sanitized, assistantReply, hasRagContext, { audience: 'public', locale: detectedLanguage });

        const convId = savePublicChatExchange(db, session.id, sanitized, assistantReply, false, detectedLanguage, conversation_id || null);
        const remaining = effectiveLimit - session.messageCount - 1;

        res.write(`data: ${JSON.stringify({ type: 'done', session_uuid: session.uuid, conversation_id: convId, language: detectedLanguage, cached: false, has_rag_context: hasRagContext, messages_remaining: remaining })}\n\n`);
        res.end();
      } catch (aiError) {
        logger.error('[PublicAssistant] AI streaming error: ' + aiError.message);
        const fallbacks = {
          ru: 'Извините, сейчас я не могу ответить. Попробуйте позже.',
          es: 'Lo siento, no puedo responder ahora. Intenta mas tarde.',
          uk: 'Вибачте, зараз я не можу відповісти. Спробуйте пізніше.'
        };
        const fallbackMsg = fallbacks[detectedLanguage] || 'Sorry, I cannot respond right now. Please try again later.';

        replyProduced = true; // a fallback notice was delivered (message stays counted, as before)
        const convId = savePublicChatExchange(db, session.id, sanitized, fallbackMsg, false, detectedLanguage, conversation_id || null);

        res.write(`data: ${JSON.stringify({ type: 'chunk', text: fallbackMsg })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', session_uuid: session.uuid, conversation_id: convId, language: detectedLanguage, cached: false, has_rag_context: hasRagContext, messages_remaining: effectiveLimit - session.messageCount - 1 })}\n\n`);
        res.end();
      }
      return;
    }

    // Non-streaming JSON Path
    try {
      const result = await aiProviders.chat(aiMessages, {
        temperature: 0.7,
        // Feature #438 (S5): FAQ-length cap for the anonymous public bot.
        max_tokens: 600,
        purpose: 'assistant',
        provider: activeAssistant.providerName,
        model: activeAssistant.model
      }, db);
      // Feature #436 output guardrail: sanitize BEFORE both caching and send.
      assistantReply = sanitizeOutput(result.text);
      replyProduced = true;
      {
        const hasUsage = Number.isFinite(result.input_tokens) && Number.isFinite(result.output_tokens) &&
          (result.input_tokens + result.output_tokens) > 0;
        recordPublicUsage(result.provider || activeAssistant.providerName, result.model || activeAssistant.model,
          hasUsage ? result.input_tokens : estimateTokens(systemPrompt) + estimateTokens(sanitized),
          hasUsage ? result.output_tokens : estimateTokens(result.text), !hasUsage);
      }
      // Feature #438 (S5): pass hasRagContext as the 3rd arg (previously
      // dropped, which silently disabled cache population entirely).
      await assistantCache.storeCachedAnswer(sanitized, assistantReply, hasRagContext, { audience: 'public', locale: detectedLanguage });
    } catch (aiError) {
      logger.error('[PublicAssistant] AI provider error: ' + aiError.message);
      const fallbacks = {
        ru: 'Извините, сейчас я не могу ответить. Попробуйте позже.',
        es: 'Lo siento, no puedo responder ahora. Intenta mas tarde.',
        uk: 'Вибачте, зараз я не можу відповісти. Спробуйте пізніше.'
      };
      assistantReply = fallbacks[detectedLanguage] || 'Sorry, I cannot respond right now. Please try again later.';
      replyProduced = true; // fallback notice delivered (message stays counted, as before)
    }

    const convId = savePublicChatExchange(db, session.id, sanitized, assistantReply, false, detectedLanguage, conversation_id || null);
    const remaining = effectiveLimit - session.messageCount - 1;

    res.json({
      response: assistantReply,
      session_uuid: session.uuid,
      conversation_id: convId,
      language: detectedLanguage,
      cached: false,
      has_rag_context: hasRagContext,
      messages_remaining: remaining
    });

  } catch (error) {
    logger.error('[PublicAssistant] Chat error: ' + error.message);
    // No reply was produced: give the reserved message back so a server-side
    // failure does not eat one of the visitor's few free messages.
    if (reservedSessionId !== null && !replyProduced) {
      try {
        getDatabase().run(
          'UPDATE viewer_sessions SET message_count = MAX(message_count - 1, 0) WHERE id = ?',
          [reservedSessionId]
        );
        saveDatabaseAfterWrite();
      } catch (refundErr) {
        logger.warn('[PublicAssistant] message refund failed: ' + refundErr.message);
      }
    }
    if (res.headersSent) {
      try { res.end(); } catch (_) { /* socket already gone */ }
    } else {
      res.status(500).json({ error: 'Failed to process message' });
    }
  }
});

module.exports = router;
