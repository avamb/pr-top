// Assistant Chat API Routes
// Provides chat endpoint for therapist-facing AI assistant
// Features: prompt injection protection, RAG context, cached answers, rate limiting

const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { authenticate } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const aiProviders = require('../services/aiProviders');
const { buildAssistantSystemPrompt } = require('../services/assistantPrompt');
const assistantCache = require('../services/assistantCache');
const assistantKnowledge = require('../services/assistantKnowledge');
const { sanitizeInput, detectInjection, getInjectionRejection, detectLanguage } = require('../services/assistantSanitizer');

// === Message tagging for analytics ===
function tagMessage(content) {
  if (!content || typeof content !== 'string') return null;
  const lower = content.toLowerCase();

  // Feature request patterns
  if (/(?:can you add|i wish|it would be nice|please add|feature request|could you implement|i need|i want)/i.test(lower)) {
    return 'feature_request';
  }
  // Difficulty/problem patterns
  if (/(?:doesn't work|not working|can't find|where is|how do i|i'm stuck|error|problem|issue|broken|bug|confused)/i.test(lower)) {
    return 'difficulty';
  }
  // Feedback patterns
  if (/(?:great|love|thank|awesome|perfect|excellent|good job|well done|amazing)/i.test(lower)) {
    return 'feedback';
  }
  // Default: question
  return 'question';
}

// All routes require authentication
router.use(authenticate);

// === Rate Limiting ===
// In-memory rate limiter: max 30 messages per minute per therapist
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30;

function checkRateLimit(therapistId) {
  const now = Date.now();
  const key = String(therapistId);

  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, []);
  }

  const timestamps = rateLimitMap.get(key);
  // Remove expired entries
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetIn: Math.ceil((timestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000) };
  }

  timestamps.push(now);
  return { allowed: true, remaining: RATE_LIMIT_MAX - timestamps.length };
}

// Periodic cleanup of stale rate limit entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS * 2;
  for (const [key, timestamps] of rateLimitMap.entries()) {
    if (timestamps.length === 0 || timestamps[timestamps.length - 1] < cutoff) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

// POST /api/assistant/chat - Send a message to the assistant
router.post('/chat', async (req, res) => {
  try {
    const { message, chat_id, page_context, language } = req.body;
    const uiLocale = language || req.headers['x-locale'] || req.user.language || 'en';

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
    }

    // Rate limit check
    const rateCheck = checkRateLimit(req.user.id);
    if (!rateCheck.allowed) {
      logger.warn(`[Assistant] Rate limit exceeded for therapist ${req.user.id}`);
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait before sending more messages.',
        retry_after: rateCheck.resetIn
      });
    }

    // === Prompt Injection Protection ===
    // Step 1: Sanitize input (strip role markers, special tokens)
    const sanitized = sanitizeInput(message.trim());

    // Step 2: Detect injection patterns
    const injectionResult = detectInjection(sanitized);
    if (injectionResult.isInjection) {
      logger.warn(`[Assistant] Prompt injection detected from therapist ${req.user.id}: pattern="${injectionResult.pattern}", confidence=${injectionResult.confidence}`);

      // Detect language for the rejection message
      const detectedLang = detectLanguage(sanitized, uiLocale);
      const rejectionMessage = getInjectionRejection(detectedLang);

      return res.json({
        chat_id: chat_id || null,
        response: rejectionMessage,
        language: detectedLang,
        cached: false,
        messages: chat_id ? undefined : [
          { role: 'user', content: sanitized, timestamp: new Date().toISOString() },
          { role: 'assistant', content: rejectionMessage, timestamp: new Date().toISOString() }
        ]
      });
    }

    const db = getDatabase();

    // Get user's subscription plan for context
    let plan = 'trial';
    try {
      const subResult = db.exec(
        "SELECT plan FROM subscriptions WHERE therapist_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
        [req.user.id]
      );
      if (subResult.length > 0 && subResult[0].values.length > 0) {
        plan = subResult[0].values[0][0];
      }
    } catch (e) {
      // ignore
    }

    // Load or create chat
    let messages = [];
    let activeChatId = chat_id;

    if (activeChatId) {
      // Load existing chat
      const chatResult = db.exec(
        'SELECT messages FROM assistant_chats WHERE id = ? AND therapist_id = ?',
        [activeChatId, req.user.id]
      );
      if (chatResult.length > 0 && chatResult[0].values.length > 0) {
        try {
          messages = JSON.parse(chatResult[0].values[0][0]);
        } catch (e) {
          messages = [];
        }
      } else {
        // Chat not found, create new
        activeChatId = null;
      }
    }

    // Add sanitized user message
    messages.push({ role: 'user', content: sanitized, timestamp: new Date().toISOString() });

    // === Language Detection ===
    // Detect language from user's message, fall back to UI locale
    const detectedLanguage = detectLanguage(sanitized, uiLocale);

    let assistantReply;
    let fromCache = false;

    // Check cache for similar questions (only for standalone questions, not mid-conversation)
    if (messages.filter(m => m.role === 'user').length <= 1) {
      const cacheResult = assistantCache.findCachedAnswer(sanitized);
      if (cacheResult.hit) {
        assistantReply = cacheResult.answer;
        fromCache = true;
        logger.info(`[Assistant] Serving cached answer (id: ${cacheResult.cached_id}, similarity: ${cacheResult.similarity?.toFixed(3)})`);
      }
    }

    if (!fromCache) {
      // === RAG: Search knowledge base for relevant context ===
      let ragContext = '';
      try {
        const kbResults = assistantKnowledge.search(sanitized, 3);
        if (kbResults.length > 0) {
          const contextParts = kbResults
            .filter(r => r.similarity > 0.1)
            .map(r => `[Source: ${r.source_file} (${r.source_type})]\n${r.chunk_text}`);
          if (contextParts.length > 0) {
            ragContext = '\n\n## RELEVANT PLATFORM DOCUMENTATION\n' +
              'Use the following context to help answer the user\'s question:\n\n' +
              contextParts.join('\n\n---\n\n');
            logger.info(`[Assistant] RAG: found ${contextParts.length} relevant knowledge chunks`);
          }
        }
      } catch (ragError) {
        logger.warn('[Assistant] RAG search error: ' + ragError.message);
      }

      // Build system prompt with context + RAG
      const systemPrompt = buildAssistantSystemPrompt({
        pageContext: page_context || '',
        locale: detectedLanguage,
        plan: plan
      }) + ragContext;

      // Prepare messages for AI (system + conversation history, limit to last 20 messages)
      const aiMessages = [
        { role: 'system', content: systemPrompt }
      ];

      // Add conversation history (last 20 messages to stay within token limits)
      const recentMessages = messages.slice(-20);
      for (const msg of recentMessages) {
        aiMessages.push({ role: msg.role, content: msg.content });
      }

      // Call AI provider (using assistant-specific provider config)
      try {
        const activeAssistant = aiProviders.getActiveAssistantProvider(db);
        const result = await aiProviders.chat(aiMessages, {
          temperature: 0.7,
          max_tokens: 1024,
          purpose: 'assistant',
          provider: activeAssistant.providerName,
          model: activeAssistant.model
        }, db);
        assistantReply = result.text;

        // Store Q&A in cache for future similar questions
        assistantCache.storeCachedAnswer(sanitized, assistantReply);
      } catch (aiError) {
        logger.error('[Assistant] AI provider error: ' + aiError.message);
        // Provide a fallback response
        const fallbacks = {
          ru: 'Извините, сейчас я не могу ответить. AI-провайдер не настроен или недоступен. Обратитесь к администратору.',
          es: 'Lo siento, no puedo responder ahora. El proveedor de IA no está configurado o no está disponible. Contacte al administrador.',
          uk: 'Вибачте, зараз я не можу відповісти. AI-провайдер не налаштований або недоступний. Зверніться до адміністратора.'
        };
        assistantReply = fallbacks[detectedLanguage] || 'Sorry, I cannot respond right now. The AI provider is not configured or unavailable. Please contact your administrator.';
      }
    }

    // Add assistant response
    messages.push({ role: 'assistant', content: assistantReply, timestamp: new Date().toISOString() });

    // Save to legacy assistant_chats table
    if (activeChatId) {
      db.run(
        "UPDATE assistant_chats SET messages = ?, page_context = ?, updated_at = datetime('now') WHERE id = ? AND therapist_id = ?",
        [JSON.stringify(messages), page_context || null, activeChatId, req.user.id]
      );
    } else {
      db.run(
        "INSERT INTO assistant_chats (therapist_id, messages, page_context) VALUES (?, ?, ?)",
        [req.user.id, JSON.stringify(messages), page_context || null]
      );
      const idResult = db.exec('SELECT last_insert_rowid()');
      activeChatId = idResult[0].values[0][0];
    }

    // === Save to analytics tables (assistant_conversations + assistant_messages) ===
    try {
      let conversationId = req.body._conversation_id || null;

      // Simple tag detection for analytics
      const userTag = tagMessage(sanitized);

      if (!conversationId && messages.filter(m => m.role === 'user').length <= 1) {
        // New conversation
        db.run(
          "INSERT INTO assistant_conversations (therapist_id, started_at, last_message_at, page_context, language, message_count) VALUES (?, datetime('now'), datetime('now'), ?, ?, 2)",
          [req.user.id, page_context || null, detectedLanguage]
        );
        const convIdResult = db.exec('SELECT last_insert_rowid()');
        conversationId = convIdResult[0].values[0][0];
      } else if (conversationId) {
        // Update existing conversation
        db.run(
          "UPDATE assistant_conversations SET last_message_at = datetime('now'), message_count = message_count + 2 WHERE id = ?",
          [conversationId]
        );
      } else {
        // Continuation without conversation_id - create new
        db.run(
          "INSERT INTO assistant_conversations (therapist_id, started_at, last_message_at, page_context, language, message_count) VALUES (?, datetime('now'), datetime('now'), ?, ?, 2)",
          [req.user.id, page_context || null, detectedLanguage]
        );
        const convIdResult = db.exec('SELECT last_insert_rowid()');
        conversationId = convIdResult[0].values[0][0];
      }

      // Save user message
      db.run(
        "INSERT INTO assistant_messages (conversation_id, role, content, is_cached, tokens_used, tags, created_at) VALUES (?, 'user', ?, 0, 0, ?, datetime('now'))",
        [conversationId, sanitized, userTag]
      );

      // Save assistant message
      db.run(
        "INSERT INTO assistant_messages (conversation_id, role, content, is_cached, tokens_used, tags, created_at) VALUES (?, 'assistant', ?, ?, 0, NULL, datetime('now'))",
        [conversationId, assistantReply, fromCache ? 1 : 0]
      );
    } catch (analyticsErr) {
      logger.warn('[Assistant] Analytics save error: ' + analyticsErr.message);
    }

    saveDatabaseAfterWrite();

    res.json({
      chat_id: activeChatId,
      response: assistantReply,
      language: detectedLanguage,
      cached: fromCache,
      messages: messages
    });

  } catch (error) {
    logger.error('[Assistant] Chat error: ' + error.message);
    res.status(500).json({ error: 'Failed to process assistant message' });
  }
});

// POST /api/assistant/new - Start a new chat
router.post('/new', (req, res) => {
  try {
    res.json({ chat_id: null, messages: [] });
  } catch (error) {
    logger.error('[Assistant] New chat error: ' + error.message);
    res.status(500).json({ error: 'Failed to create new chat' });
  }
});

// GET /api/assistant/history - Get recent chat history
router.get('/history', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.exec(
      'SELECT id, page_context, created_at, updated_at FROM assistant_chats WHERE therapist_id = ? ORDER BY updated_at DESC LIMIT 10',
      [req.user.id]
    );

    const chats = [];
    if (result.length > 0) {
      for (const row of result[0].values) {
        chats.push({
          id: row[0],
          page_context: row[1],
          created_at: row[2],
          updated_at: row[3]
        });
      }
    }

    res.json({ chats });
  } catch (error) {
    logger.error('[Assistant] History error: ' + error.message);
    res.status(500).json({ error: 'Failed to load chat history' });
  }
});

module.exports = router;
