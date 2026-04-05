// Assistant Chat API Routes
// Provides chat endpoint for therapist-facing AI assistant

const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { authenticate } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const aiProviders = require('../services/aiProviders');
const { buildAssistantSystemPrompt } = require('../services/assistantPrompt');
const assistantCache = require('../services/assistantCache');

// All routes require authentication
router.use(authenticate);

// POST /api/assistant/chat - Send a message to the assistant
router.post('/chat', async (req, res) => {
  try {
    const { message, chat_id, page_context } = req.body;
    const locale = req.headers['x-locale'] || req.user.language || 'en';

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
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

    // Add user message
    const trimmedMessage = message.trim();
    messages.push({ role: 'user', content: trimmedMessage, timestamp: new Date().toISOString() });

    let assistantReply;
    let fromCache = false;

    // Check cache for similar questions (only for standalone questions, not mid-conversation)
    if (messages.filter(m => m.role === 'user').length <= 1) {
      const cacheResult = assistantCache.findCachedAnswer(trimmedMessage);
      if (cacheResult.hit) {
        assistantReply = cacheResult.answer;
        fromCache = true;
        logger.info(`[Assistant] Serving cached answer (id: ${cacheResult.cached_id}, similarity: ${cacheResult.similarity?.toFixed(3)})`);
      }
    }

    if (!fromCache) {
      // Build system prompt with context
      const systemPrompt = buildAssistantSystemPrompt({
        pageContext: page_context || '',
        locale: locale,
        plan: plan
      });

      // Prepare messages for AI (system + conversation history, limit to last 20 messages)
      const aiMessages = [
        { role: 'system', content: systemPrompt }
      ];

      // Add conversation history (last 20 messages to stay within token limits)
      const recentMessages = messages.slice(-20);
      for (const msg of recentMessages) {
        aiMessages.push({ role: msg.role, content: msg.content });
      }

      // Call AI provider
      try {
        const result = await aiProviders.chat(aiMessages, {
          temperature: 0.7,
          max_tokens: 1024,
          purpose: 'assistant'
        }, db);
        assistantReply = result.text;

        // Store Q&A in cache for future similar questions
        assistantCache.storeCachedAnswer(trimmedMessage, assistantReply);
      } catch (aiError) {
        logger.error('[Assistant] AI provider error: ' + aiError.message);
        // Provide a fallback response
        assistantReply = locale === 'ru' ? 'Извините, сейчас я не могу ответить. AI-провайдер не настроен или недоступен. Обратитесь к администратору.' :
          locale === 'es' ? 'Lo siento, no puedo responder ahora. El proveedor de IA no está configurado o no está disponible. Contacte al administrador.' :
          locale === 'uk' ? 'Вибачте, зараз я не можу відповісти. AI-провайдер не налаштований або недоступний. Зверніться до адміністратора.' :
          'Sorry, I cannot respond right now. The AI provider is not configured or unavailable. Please contact your administrator.';
      }
    }

    // Add assistant response
    messages.push({ role: 'assistant', content: assistantReply, timestamp: new Date().toISOString() });

    // Save to database
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
      // Get the new chat ID
      const idResult = db.exec('SELECT last_insert_rowid()');
      activeChatId = idResult[0].values[0][0];
    }

    saveDatabaseAfterWrite();

    res.json({
      chat_id: activeChatId,
      reply: assistantReply,
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
