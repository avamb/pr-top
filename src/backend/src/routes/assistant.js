// Assistant Chat API Routes
// Provides chat endpoint for therapist-facing AI assistant
// Features: SSE streaming, prompt injection protection, RAG context, cached answers, rate limiting

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

// === Auto-generate conversation title from first user message ===
function generateTitle(firstMessage) {
  if (!firstMessage || typeof firstMessage !== 'string') return 'New conversation';
  // Trim and take first 60 chars, cut at last word boundary
  let title = firstMessage.trim();
  if (title.length > 60) {
    title = title.substring(0, 60);
    const lastSpace = title.lastIndexOf(' ');
    if (lastSpace > 20) title = title.substring(0, lastSpace);
    title += '…';
  }
  return title;
}

// === Message tagging for analytics ===
function tagMessage(content) {
  if (!content || typeof content !== 'string') return null;
  const lower = content.toLowerCase();

  // Feature request patterns (EN + RU + ES + UK)
  if (/(?:can you add|i wish|it would be nice|please add|feature request|could you implement|i need a feature|i want a feature|would be great if|хочу функцию|нужна функция|было бы хорошо|добавьте|хотел бы видеть|мне нужно|хотелось бы|можно добавить|necesito|me gustaría|sería bueno|podrían agregar|хочу функцію|потрібна функція|було б добре|додайте|хотів би бачити)/i.test(lower)) {
    return 'feature_request';
  }
  // Difficulty/problem patterns (EN + RU + ES + UK)
  if (/(?:doesn't work|not working|can't find|where is|how do i|i'm stuck|error|problem|issue|broken|bug|confused|не работает|не могу найти|ошибка|проблема|не понимаю|сломано|no funciona|no puedo|error|problema|не працює|не можу знайти|помилка)/i.test(lower)) {
    return 'difficulty';
  }
  // Feedback patterns (EN + RU + ES + UK)
  if (/(?:great|love|thank|awesome|perfect|excellent|good job|well done|amazing|спасибо|отлично|прекрасно|замечательно|gracias|excelente|perfecto|genial|дякую|чудово|прекрасно)/i.test(lower)) {
    return 'feedback';
  }
  // Default: question
  return 'question';
}

// Helper: save chat exchange to database (used by both streaming and non-streaming paths)
function saveChatExchange(db, therapistId, activeChatId, messages, sanitized, assistantReply, fromCache, pageContext, detectedLanguage, conversationId) {
  // Save to assistant_chats table
  let chatId = activeChatId;
  if (chatId) {
    db.run(
      "UPDATE assistant_chats SET messages = ?, page_context = ?, updated_at = datetime('now') WHERE id = ? AND therapist_id = ?",
      [JSON.stringify(messages), pageContext || null, chatId, therapistId]
    );
  } else {
    // Auto-generate title from first user message
    const title = generateTitle(sanitized);
    db.run(
      "INSERT INTO assistant_chats (therapist_id, messages, page_context, title) VALUES (?, ?, ?, ?)",
      [therapistId, JSON.stringify(messages), pageContext || null, title]
    );
    const idResult = db.exec('SELECT last_insert_rowid()');
    chatId = idResult[0].values[0][0];
  }

  // Save to analytics tables
  try {
    const userTag = tagMessage(sanitized);

    if (!conversationId && messages.filter(m => m.role === 'user').length <= 1) {
      db.run(
        "INSERT INTO assistant_conversations (therapist_id, started_at, last_message_at, page_context, language, message_count) VALUES (?, datetime('now'), datetime('now'), ?, ?, 2)",
        [therapistId, pageContext || null, detectedLanguage]
      );
      const convIdResult = db.exec('SELECT last_insert_rowid()');
      conversationId = convIdResult[0].values[0][0];
    } else if (conversationId) {
      db.run(
        "UPDATE assistant_conversations SET last_message_at = datetime('now'), message_count = message_count + 2 WHERE id = ?",
        [conversationId]
      );
    } else {
      db.run(
        "INSERT INTO assistant_conversations (therapist_id, started_at, last_message_at, page_context, language, message_count) VALUES (?, datetime('now'), datetime('now'), ?, ?, 2)",
        [therapistId, pageContext || null, detectedLanguage]
      );
      const convIdResult = db.exec('SELECT last_insert_rowid()');
      conversationId = convIdResult[0].values[0][0];
    }

    db.run(
      "INSERT INTO assistant_messages (conversation_id, role, content, is_cached, tokens_used, tags, created_at) VALUES (?, 'user', ?, 0, 0, ?, datetime('now'))",
      [conversationId, sanitized, userTag]
    );
    db.run(
      "INSERT INTO assistant_messages (conversation_id, role, content, is_cached, tokens_used, tags, created_at) VALUES (?, 'assistant', ?, ?, 0, NULL, datetime('now'))",
      [conversationId, assistantReply, fromCache ? 1 : 0]
    );
  } catch (analyticsErr) {
    logger.warn('[Assistant] Analytics save error: ' + analyticsErr.message);
  }

  saveDatabaseAfterWrite();
  return chatId;
}

// === Feedback Prompt Tracking ===
// Update the last_prompted_at timestamp for a therapist after feedback prompt was included
function updateFeedbackPromptTracking(db, therapistId) {
  try {
    const existing = db.exec(
      "SELECT id FROM assistant_feedback_prompts WHERE therapist_id = ?",
      [therapistId]
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run(
        "UPDATE assistant_feedback_prompts SET last_prompted_at = datetime('now'), prompt_count = prompt_count + 1 WHERE therapist_id = ?",
        [therapistId]
      );
    } else {
      db.run(
        "INSERT INTO assistant_feedback_prompts (therapist_id, last_prompted_at, prompt_count) VALUES (?, datetime('now'), 1)",
        [therapistId]
      );
    }
    saveDatabaseAfterWrite();
  } catch (err) {
    logger.warn('[Assistant] Failed to update feedback prompt tracking: ' + err.message);
  }
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
// Supports SSE streaming when stream=true in body or Accept: text/event-stream header
router.post('/chat', async (req, res) => {
  try {
    const { message, chat_id, page_context, language, stream } = req.body;
    const useSSE = stream === true || req.headers.accept === 'text/event-stream';
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
    const sanitized = sanitizeInput(message.trim());

    const injectionResult = detectInjection(sanitized);
    if (injectionResult.isInjection) {
      logger.warn(`[Assistant] Prompt injection detected from therapist ${req.user.id}: pattern="${injectionResult.pattern}", confidence=${injectionResult.confidence}`);

      const detectedLang = detectLanguage(sanitized, uiLocale);
      const rejectionMessage = getInjectionRejection(detectedLang);

      if (useSSE) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: rejectionMessage })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', chat_id: chat_id || null, language: detectedLang, cached: false })}\n\n`);
        return res.end();
      }

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
      const chatResult = db.exec(
        'SELECT messages FROM assistant_chats WHERE id = ? AND therapist_id = ? AND deleted_at IS NULL',
        [activeChatId, req.user.id]
      );
      if (chatResult.length > 0 && chatResult[0].values.length > 0) {
        try {
          messages = JSON.parse(chatResult[0].values[0][0]);
        } catch (e) {
          messages = [];
        }
      } else {
        activeChatId = null;
      }
    }

    // Add sanitized user message
    messages.push({ role: 'user', content: sanitized, timestamp: new Date().toISOString() });

    // === Language Detection ===
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

    // If cached, return immediately (no need to stream)
    if (fromCache) {
      messages.push({ role: 'assistant', content: assistantReply, timestamp: new Date().toISOString() });
      const conversationId = req.body._conversation_id || null;
      const savedChatId = saveChatExchange(db, req.user.id, activeChatId, messages, sanitized, assistantReply, true, page_context, detectedLanguage, conversationId);

      if (useSSE) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: assistantReply })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', chat_id: savedChatId, language: detectedLanguage, cached: true, messages: messages })}\n\n`);
        return res.end();
      }

      return res.json({
        chat_id: savedChatId,
        response: assistantReply,
        language: detectedLanguage,
        cached: true,
        messages: messages
      });
    }

    // === RAG: Search knowledge base for relevant context ===
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
          logger.info(`[Assistant] RAG: found ${contextParts.length} relevant knowledge chunks`);
        }
      }
    } catch (ragError) {
      logger.warn('[Assistant] RAG search error: ' + ragError.message);
    }

    // === Proactive Feedback Prompt Check ===
    // Check if we should ask the therapist for feature feedback (every 14 days, not on first message)
    let shouldPromptFeedback = false;
    const userMessageCount = messages.filter(m => m.role === 'user').length;
    if (userMessageCount > 1 && req.user.role !== 'superadmin') {
      try {
        const feedbackResult = db.exec(
          "SELECT last_prompted_at FROM assistant_feedback_prompts WHERE therapist_id = ?",
          [req.user.id]
        );
        const FEEDBACK_INTERVAL_DAYS = 14;
        if (feedbackResult.length > 0 && feedbackResult[0].values.length > 0) {
          const lastPrompted = new Date(feedbackResult[0].values[0][0]);
          const daysSince = (Date.now() - lastPrompted.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince >= FEEDBACK_INTERVAL_DAYS) {
            shouldPromptFeedback = true;
          }
        } else {
          // Never prompted before — check if user has had at least 3 total conversations
          const convCountResult = db.exec(
            "SELECT COUNT(*) FROM assistant_conversations WHERE therapist_id = ?",
            [req.user.id]
          );
          const convCount = (convCountResult.length > 0 && convCountResult[0].values.length > 0)
            ? convCountResult[0].values[0][0] : 0;
          if (convCount >= 3) {
            shouldPromptFeedback = true;
          }
        }
      } catch (fbErr) {
        logger.warn('[Assistant] Feedback prompt check error: ' + fbErr.message);
      }
    }

    // Build system prompt with context + RAG
    const userRole = req.user.role || 'therapist';
    const systemPrompt = buildAssistantSystemPrompt({
      pageContext: page_context || '',
      locale: detectedLanguage,
      plan: plan,
      role: userRole,
      shouldPromptFeedback: shouldPromptFeedback,
      db: db,
      messageCount: userMessageCount
    }) + ragContext;

    // Prepare messages for AI (system + conversation history, limit to last 20 messages)
    const aiMessages = [
      { role: 'system', content: systemPrompt }
    ];
    const recentMessages = messages.slice(-20);
    for (const msg of recentMessages) {
      aiMessages.push({ role: msg.role, content: msg.content });
    }

    const activeAssistant = aiProviders.getActiveAssistantProvider(db);

    // === SSE Streaming Path ===
    if (useSSE) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      try {
        let fullText = '';
        const streamGen = aiProviders.chatStream(aiMessages, {
          temperature: 0.7,
          max_tokens: 1024,
          purpose: 'assistant',
          provider: activeAssistant.providerName,
          model: activeAssistant.model
        }, db);

        for await (const chunk of streamGen) {
          if (chunk.text) {
            fullText += chunk.text;
            res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk.text })}\n\n`);
          }
          if (chunk.done) {
            if (chunk.fullText) fullText = chunk.fullText;
          }
        }

        assistantReply = fullText || '';

        // Store Q&A in cache (only if RAG context was present to prevent cache poisoning)
        assistantCache.storeCachedAnswer(sanitized, assistantReply, hasRagContext);

        // Save to database
        messages.push({ role: 'assistant', content: assistantReply, timestamp: new Date().toISOString() });
        const conversationId = req.body._conversation_id || null;
        const savedChatId = saveChatExchange(db, req.user.id, activeChatId, messages, sanitized, assistantReply, false, page_context, detectedLanguage, conversationId);

        // Track feedback prompt if it was included
        if (shouldPromptFeedback) {
          updateFeedbackPromptTracking(db, req.user.id);
        }

        // Send done event with metadata
        res.write(`data: ${JSON.stringify({ type: 'done', chat_id: savedChatId, language: detectedLanguage, cached: false, messages: messages })}\n\n`);
        res.end();

      } catch (aiError) {
        logger.error('[Assistant] AI streaming error: ' + aiError.message);
        const fallbacks = {
          ru: 'Извините, сейчас я не могу ответить. AI-провайдер не настроен или недоступен. Обратитесь к администратору.',
          es: 'Lo siento, no puedo responder ahora. El proveedor de IA no está configurado o no está disponible. Contacte al administrador.',
          uk: 'Вибачте, зараз я не можу відповісти. AI-провайдер не налаштований або недоступний. Зверніться до адміністратора.'
        };
        const fallbackMsg = fallbacks[detectedLanguage] || 'Sorry, I cannot respond right now. The AI provider is not configured or unavailable. Please contact your administrator.';

        // Save conversation even on AI error so it appears in history
        messages.push({ role: 'assistant', content: fallbackMsg, timestamp: new Date().toISOString() });
        const conversationId = req.body._conversation_id || null;
        let savedChatId = null;
        try {
          savedChatId = saveChatExchange(db, req.user.id, activeChatId, messages, sanitized, fallbackMsg, false, page_context, detectedLanguage, conversationId);
        } catch (saveErr) {
          logger.warn('[Assistant] Failed to save errored conversation: ' + saveErr.message);
        }

        res.write(`data: ${JSON.stringify({ type: 'chunk', text: fallbackMsg })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', chat_id: savedChatId, language: detectedLanguage, cached: false, messages: messages })}\n\n`);
        res.end();
      }
      return;
    }

    // === Non-streaming JSON Path ===
    try {
      const result = await aiProviders.chat(aiMessages, {
        temperature: 0.7,
        max_tokens: 1024,
        purpose: 'assistant',
        provider: activeAssistant.providerName,
        model: activeAssistant.model
      }, db);
      assistantReply = result.text;

      // Store Q&A in cache (only if RAG context was present to prevent cache poisoning)
      assistantCache.storeCachedAnswer(sanitized, assistantReply, hasRagContext);
    } catch (aiError) {
      logger.error('[Assistant] AI provider error: ' + aiError.message);
      const fallbacks = {
        ru: 'Извините, сейчас я не могу ответить. AI-провайдер не настроен или недоступен. Обратитесь к администратору.',
        es: 'Lo siento, no puedo responder ahora. El proveedor de IA no está configurado o no está disponible. Contacte al administrador.',
        uk: 'Вибачте, зараз я не можу відповісти. AI-провайдер не налаштований або недоступний. Зверніться до адміністратора.'
      };
      assistantReply = fallbacks[detectedLanguage] || 'Sorry, I cannot respond right now. The AI provider is not configured or unavailable. Please contact your administrator.';
    }

    // Add assistant response
    messages.push({ role: 'assistant', content: assistantReply, timestamp: new Date().toISOString() });

    const conversationId = req.body._conversation_id || null;
    const savedChatId = saveChatExchange(db, req.user.id, activeChatId, messages, sanitized, assistantReply, false, page_context, detectedLanguage, conversationId);

    // Track feedback prompt if it was included
    if (shouldPromptFeedback) {
      updateFeedbackPromptTracking(db, req.user.id);
    }

    res.json({
      chat_id: savedChatId,
      response: assistantReply,
      language: detectedLanguage,
      cached: false,
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

// GET /api/assistant/history - Get recent chat history list
router.get('/history', (req, res) => {
  try {
    const db = getDatabase();
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = parseInt(req.query.offset) || 0;
    const includeArchived = req.query.include_archived === 'true';

    const archiveFilter = includeArchived ? '' : ' AND archived_at IS NULL';

    const result = db.exec(
      `SELECT id, messages, page_context, created_at, updated_at, title, archived_at FROM assistant_chats WHERE therapist_id = ? AND deleted_at IS NULL${archiveFilter} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );

    const chats = [];
    if (result.length > 0) {
      for (const row of result[0].values) {
        let messageCount = 0;
        let firstMessagePreview = '';
        try {
          const msgs = JSON.parse(row[1] || '[]');
          messageCount = msgs.length;
          const firstUserMsg = msgs.find(m => m.role === 'user');
          if (firstUserMsg) {
            firstMessagePreview = firstUserMsg.content.substring(0, 100);
            if (firstUserMsg.content.length > 100) firstMessagePreview += '…';
          }
        } catch (e) {}

        chats.push({
          id: row[0],
          page_context: row[2],
          created_at: row[3],
          updated_at: row[4],
          title: row[5] || firstMessagePreview || 'New conversation',
          message_count: messageCount,
          first_message_preview: firstMessagePreview,
          archived: !!row[6]
        });
      }
    }

    // Get total count for pagination
    const countResult = db.exec(
      `SELECT COUNT(*) FROM assistant_chats WHERE therapist_id = ? AND deleted_at IS NULL${archiveFilter}`,
      [req.user.id]
    );
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    res.json({ chats, total, limit, offset });
  } catch (error) {
    logger.error('[Assistant] History error: ' + error.message);
    res.status(500).json({ error: 'Failed to load chat history' });
  }
});

// GET /api/assistant/history/:id - Get a specific conversation
router.get('/history/:id', (req, res) => {
  try {
    const db = getDatabase();
    const chatId = parseInt(req.params.id);

    if (!chatId || isNaN(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const result = db.exec(
      'SELECT id, messages, page_context, created_at, updated_at, title FROM assistant_chats WHERE id = ? AND therapist_id = ? AND deleted_at IS NULL',
      [chatId, req.user.id]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const row = result[0].values[0];
    let messages = [];
    try {
      messages = JSON.parse(row[1]);
    } catch (e) {
      messages = [];
    }

    // Derive title from first user message if not set
    let title = row[5];
    if (!title) {
      const firstUser = messages.find(m => m.role === 'user');
      title = firstUser ? generateTitle(firstUser.content) : 'New conversation';
    }

    res.json({
      id: row[0],
      messages: messages,
      page_context: row[2],
      created_at: row[3],
      updated_at: row[4],
      title: title
    });
  } catch (error) {
    logger.error('[Assistant] Get conversation error: ' + error.message);
    res.status(500).json({ error: 'Failed to load conversation' });
  }
});

// DELETE /api/assistant/history/:id - Soft-delete a conversation (verify ownership)
router.delete('/history/:id', (req, res) => {
  try {
    const db = getDatabase();
    const chatId = parseInt(req.params.id);

    if (!chatId || isNaN(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    // Verify ownership and existence
    const result = db.exec(
      'SELECT id FROM assistant_chats WHERE id = ? AND therapist_id = ? AND deleted_at IS NULL',
      [chatId, req.user.id]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Soft-delete by setting deleted_at timestamp
    db.run(
      "UPDATE assistant_chats SET deleted_at = datetime('now') WHERE id = ? AND therapist_id = ?",
      [chatId, req.user.id]
    );

    saveDatabaseAfterWrite();
    logger.info(`[Assistant] Conversation ${chatId} soft-deleted by therapist ${req.user.id}`);

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    logger.error('[Assistant] Delete conversation error: ' + error.message);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// GET /api/assistant/conversations - List conversations (alias matching feature spec)
router.get('/conversations', (req, res) => {
  try {
    const db = getDatabase();
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = parseInt(req.query.offset) || 0;
    const includeArchived = req.query.include_archived === 'true';
    const archiveFilter = includeArchived ? '' : ' AND archived_at IS NULL';

    const result = db.exec(
      `SELECT id, messages, page_context, created_at, updated_at, title, archived_at FROM assistant_chats WHERE therapist_id = ? AND deleted_at IS NULL${archiveFilter} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );

    const chats = [];
    if (result.length > 0) {
      for (const row of result[0].values) {
        let messageCount = 0;
        let firstMessagePreview = '';
        try {
          const msgs = JSON.parse(row[1] || '[]');
          messageCount = msgs.length;
          const firstUserMsg = msgs.find(m => m.role === 'user');
          if (firstUserMsg) {
            firstMessagePreview = firstUserMsg.content.substring(0, 100);
            if (firstUserMsg.content.length > 100) firstMessagePreview += '\u2026';
          }
        } catch (e) {}

        chats.push({
          id: row[0],
          page_context: row[2],
          created_at: row[3],
          updated_at: row[4],
          title: row[5] || firstMessagePreview || 'New conversation',
          message_count: messageCount,
          first_message_preview: firstMessagePreview,
          archived: !!row[6]
        });
      }
    }

    const countResult = db.exec(
      `SELECT COUNT(*) FROM assistant_chats WHERE therapist_id = ? AND deleted_at IS NULL${archiveFilter}`,
      [req.user.id]
    );
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    res.json({ chats, total, limit, offset });
  } catch (error) {
    logger.error('[Assistant] Conversations list error: ' + error.message);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

// GET /api/assistant/conversations/:id/messages - Get messages for a specific conversation
router.get('/conversations/:id/messages', (req, res) => {
  try {
    const db = getDatabase();
    const chatId = parseInt(req.params.id);

    if (!chatId || isNaN(chatId)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    const result = db.exec(
      'SELECT id, messages, page_context, created_at, updated_at, title FROM assistant_chats WHERE id = ? AND therapist_id = ? AND deleted_at IS NULL',
      [chatId, req.user.id]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const row = result[0].values[0];
    let messages = [];
    try {
      messages = JSON.parse(row[1]);
    } catch (e) {
      messages = [];
    }

    // Derive title from first user message if not set
    let title = row[5];
    if (!title) {
      const firstUser = messages.find(m => m.role === 'user');
      title = firstUser ? generateTitle(firstUser.content) : 'New conversation';
    }

    res.json({
      id: row[0],
      messages: messages,
      title: title,
      page_context: row[2],
      created_at: row[3],
      updated_at: row[4]
    });
  } catch (error) {
    logger.error('[Assistant] Get conversation messages error: ' + error.message);
    res.status(500).json({ error: 'Failed to load conversation messages' });
  }
});

// === Auto-archive old conversations ===
// Runs on server start and then daily
function archiveOldConversations() {
  try {
    const db = getDatabase();
    // Get archive days from settings
    const settingResult = db.exec(
      "SELECT value FROM platform_settings WHERE key = 'assistant_chat_archive_days'"
    );
    const archiveDays = settingResult.length > 0 && settingResult[0].values.length > 0
      ? parseInt(settingResult[0].values[0][0]) || 90
      : 90;

    if (archiveDays <= 0) {
      logger.debug('[Assistant] Auto-archive disabled (archive_days=0)');
      return;
    }

    const result = db.run(
      `UPDATE assistant_chats SET archived_at = datetime('now') WHERE archived_at IS NULL AND deleted_at IS NULL AND updated_at < datetime('now', '-${archiveDays} days')`
    );

    logger.info(`[Assistant] Auto-archive check complete (threshold: ${archiveDays} days)`);
  } catch (error) {
    logger.warn('[Assistant] Auto-archive error: ' + error.message);
  }
}

// Run archive on startup (delayed to let DB initialize)
setTimeout(archiveOldConversations, 5000);

// Run daily at 3am
setInterval(archiveOldConversations, 24 * 60 * 60 * 1000);

module.exports = router;
