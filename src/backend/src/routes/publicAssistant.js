// Public Assistant Chat API - No authentication required
// For anonymous visitors on the landing page (limited to 5 messages per session)

const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');
const aiProviders = require('../services/aiProviders');
const { buildAssistantSystemPrompt } = require('../services/assistantPrompt');
const assistantCache = require('../services/assistantCache');
const assistantKnowledge = require('../services/assistantKnowledge');
const { sanitizeInput, detectInjection, getInjectionRejection, detectLanguage } = require('../services/assistantSanitizer');

const MAX_MESSAGES_PER_SESSION = 5;

// === Rate Limiting for public chat ===
// IP-based: max 10 messages per minute
const publicRateLimitMap = new Map();
const PUBLIC_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const PUBLIC_RATE_LIMIT_MAX = 10;

function checkPublicRateLimit(ip) {
  const now = Date.now();
  const key = String(ip || 'unknown');

  if (!publicRateLimitMap.has(key)) {
    publicRateLimitMap.set(key, []);
  }

  const timestamps = publicRateLimitMap.get(key);
  const cutoff = now - PUBLIC_RATE_LIMIT_WINDOW_MS;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= PUBLIC_RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetIn: Math.ceil((timestamps[0] + PUBLIC_RATE_LIMIT_WINDOW_MS - now) / 1000) };
  }

  timestamps.push(now);
  return { allowed: true, remaining: PUBLIC_RATE_LIMIT_MAX - timestamps.length };
}

// Periodic cleanup (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const cutoff = now - PUBLIC_RATE_LIMIT_WINDOW_MS * 2;
  for (const [key, timestamps] of publicRateLimitMap.entries()) {
    if (timestamps.length === 0 || timestamps[timestamps.length - 1] < cutoff) {
      publicRateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Helper: get or create viewer session
function getOrCreateViewerSession(db, uuid, ip, userAgent, language) {
  const existing = db.exec(
    'SELECT id, message_count, email, user_id FROM viewer_sessions WHERE uuid = ?',
    [uuid]
  );

  if (existing.length > 0 && existing[0].values.length > 0) {
    const [id, messageCount, email, userId] = existing[0].values[0];
    return { id, messageCount, isNew: false, email, userId };
  }

  // Create new session
  const fingerprint = `${ip}|${(userAgent || '').substring(0, 100)}`;
  db.run(
    "INSERT INTO viewer_sessions (uuid, ip, fingerprint, user_agent, language, created_at, last_active, message_count) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), 0)",
    [uuid, ip || null, fingerprint, (userAgent || '').substring(0, 500), language || 'en']
  );
  const idResult = db.exec('SELECT last_insert_rowid()');
  const id = idResult[0].values[0][0];
  saveDatabaseAfterWrite();
  return { id, messageCount: 0, isNew: true };
}

// Helper: save public chat exchange to analytics tables
function savePublicChatExchange(db, viewerSessionId, sanitized, assistantReply, fromCache, language, conversationId) {
  try {
    let convId = conversationId;

    if (!convId) {
      // Create a new conversation with therapist_id = 0 (anonymous)
      db.run(
        "INSERT INTO assistant_conversations (therapist_id, started_at, last_message_at, page_context, language, message_count) VALUES (0, datetime('now'), datetime('now'), 'landing', ?, 2)",
        [language]
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

    // Update viewer session
    db.run(
      "UPDATE viewer_sessions SET message_count = message_count + 1, last_active = datetime('now') WHERE id = ?",
      [viewerSessionId]
    );

    saveDatabaseAfterWrite();
    return convId;
  } catch (err) {
    logger.warn('[PublicAssistant] Analytics save error: ' + err.message);
    return conversationId;
  }
}

// POST /api/assistant/public-chat
router.post('/public-chat', async (req, res) => {
  try {
    const { message, session_uuid, language, stream, conversation_id } = req.body;
    const useSSE = stream === true || req.headers.accept === 'text/event-stream';
    const uiLocale = language || req.headers['x-locale'] || 'en';
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
    }

    // Validate session UUID
    if (!session_uuid || typeof session_uuid !== 'string' || session_uuid.length < 10 || session_uuid.length > 100) {
      return res.status(400).json({ error: 'Valid session_uuid is required' });
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

    // Get or create viewer session
    const session = getOrCreateViewerSession(db, session_uuid, clientIp, userAgent, uiLocale);

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

    // Check message limit
    if (session.messageCount >= effectiveLimit) {
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
          show_cta: false,
          show_register: true
        });
      }

      // Anonymous - show lead capture CTA
      const limitMessages = {
        en: 'You have reached the message limit for anonymous chat. Please register for a free trial to continue the conversation!',
        ru: 'Вы достигли лимита сообщений для анонимного чата. Зарегистрируйтесь для бесплатного пробного периода, чтобы продолжить!',
        es: 'Has alcanzado el limite de mensajes para el chat anonimo. Registrate para una prueba gratuita para continuar la conversacion!',
        uk: 'Ви досягли ліміту повідомлень для анонімного чату. Зареєструйтесь для безкоштовного пробного періоду, щоб продовжити!'
      };
      const limitMsg = limitMessages[detectedLang] || limitMessages.en;

      return res.status(403).json({
        error: 'message_limit_reached',
        message: limitMsg,
        limit: MAX_MESSAGES_PER_SESSION,
        show_cta: true
      });
    }

    // Language detection
    const detectedLanguage = detectLanguage(sanitized, uiLocale);

    let assistantReply;
    let fromCache = false;

    // Check cache for similar questions (only for first message)
    if (session.messageCount === 0) {
      const cacheResult = assistantCache.findCachedAnswer(sanitized);
      if (cacheResult.hit) {
        assistantReply = cacheResult.answer;
        fromCache = true;
        logger.info(`[PublicAssistant] Serving cached answer (id: ${cacheResult.cached_id})`);
      }
    }

    // If cached, return immediately
    if (fromCache) {
      const convId = savePublicChatExchange(db, session.id, sanitized, assistantReply, true, detectedLanguage, conversation_id || null);

      if (useSSE) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: assistantReply })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', conversation_id: convId, language: detectedLanguage, cached: true, messages_remaining: effectiveLimit - session.messageCount - 1 })}\n\n`);
        return res.end();
      }

      return res.json({
        response: assistantReply,
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
      const kbResults = await assistantKnowledge.search(sanitized, 3);
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
          max_tokens: 1500,
          purpose: 'assistant',
          provider: activeAssistant.providerName,
          model: activeAssistant.model
        }, db);

        for await (const chunk of streamGen) {
          if (chunk.text) {
            fullText += chunk.text;
            res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk.text })}\n\n`);
          }
          if (chunk.done && chunk.fullText) {
            fullText = chunk.fullText;
          }
        }

        assistantReply = fullText || '';
        assistantCache.storeCachedAnswer(sanitized, assistantReply);

        const convId = savePublicChatExchange(db, session.id, sanitized, assistantReply, false, detectedLanguage, conversation_id || null);
        const remaining = effectiveLimit - session.messageCount - 1;

        res.write(`data: ${JSON.stringify({ type: 'done', conversation_id: convId, language: detectedLanguage, cached: false, has_rag_context: hasRagContext, messages_remaining: remaining })}\n\n`);
        res.end();
      } catch (aiError) {
        logger.error('[PublicAssistant] AI streaming error: ' + aiError.message);
        const fallbacks = {
          ru: 'Извините, сейчас я не могу ответить. Попробуйте позже.',
          es: 'Lo siento, no puedo responder ahora. Intenta mas tarde.',
          uk: 'Вибачте, зараз я не можу відповісти. Спробуйте пізніше.'
        };
        const fallbackMsg = fallbacks[detectedLanguage] || 'Sorry, I cannot respond right now. Please try again later.';

        const convId = savePublicChatExchange(db, session.id, sanitized, fallbackMsg, false, detectedLanguage, conversation_id || null);

        res.write(`data: ${JSON.stringify({ type: 'chunk', text: fallbackMsg })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', conversation_id: convId, language: detectedLanguage, cached: false, has_rag_context: hasRagContext, messages_remaining: effectiveLimit - session.messageCount - 1 })}\n\n`);
        res.end();
      }
      return;
    }

    // Non-streaming JSON Path
    try {
      const result = await aiProviders.chat(aiMessages, {
        temperature: 0.7,
        max_tokens: 1500,
        purpose: 'assistant',
        provider: activeAssistant.providerName,
        model: activeAssistant.model
      }, db);
      assistantReply = result.text;
      assistantCache.storeCachedAnswer(sanitized, assistantReply);
    } catch (aiError) {
      logger.error('[PublicAssistant] AI provider error: ' + aiError.message);
      const fallbacks = {
        ru: 'Извините, сейчас я не могу ответить. Попробуйте позже.',
        es: 'Lo siento, no puedo responder ahora. Intenta mas tarde.',
        uk: 'Вибачте, зараз я не можу відповісти. Спробуйте пізніше.'
      };
      assistantReply = fallbacks[detectedLanguage] || 'Sorry, I cannot respond right now. Please try again later.';
    }

    const convId = savePublicChatExchange(db, session.id, sanitized, assistantReply, false, detectedLanguage, conversation_id || null);
    const remaining = effectiveLimit - session.messageCount - 1;

    res.json({
      response: assistantReply,
      conversation_id: convId,
      language: detectedLanguage,
      cached: false,
      has_rag_context: hasRagContext,
      messages_remaining: remaining
    });

  } catch (error) {
    logger.error('[PublicAssistant] Chat error: ' + error.message);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

module.exports = router;
