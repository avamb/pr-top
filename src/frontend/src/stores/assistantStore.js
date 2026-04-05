import { create } from 'zustand';

const PANEL_STATE_KEY = 'assistant_panel_open';
const CONVERSATION_ID_KEY = 'assistant_conversation_id';

/**
 * Zustand store for assistant chat state.
 * Manages: panel open/close, messages, conversations, SSE streaming, history.
 */
const useAssistantStore = create((set, get) => ({
  // Panel state
  isOpen: (() => {
    try { return localStorage.getItem(PANEL_STATE_KEY) === '1'; } catch { return false; }
  })(),
  hasUnread: false,

  // Chat state
  messages: [],
  conversationId: (() => {
    try {
      const id = localStorage.getItem(CONVERSATION_ID_KEY);
      return id ? parseInt(id, 10) : null;
    } catch { return null; }
  })(),
  isLoading: false,
  isStreaming: false,
  streamingText: '',
  error: null,

  // History state
  conversationHistory: [],
  historyTotal: 0,
  historyLoading: false,

  // === Panel Actions ===
  togglePanel: () => {
    set(state => {
      const next = !state.isOpen;
      try { localStorage.setItem(PANEL_STATE_KEY, next ? '1' : '0'); } catch {}
      return { isOpen: next, hasUnread: next ? false : state.hasUnread };
    });
  },

  openPanel: () => {
    try { localStorage.setItem(PANEL_STATE_KEY, '1'); } catch {}
    set({ isOpen: true, hasUnread: false });
  },

  closePanel: () => {
    try { localStorage.setItem(PANEL_STATE_KEY, '0'); } catch {}
    set({ isOpen: false });
  },

  setHasUnread: (val) => set({ hasUnread: val }),

  // === Chat Actions ===

  /**
   * Send a message to the assistant. Supports SSE streaming.
   * @param {string} text - User message
   * @param {string} pageContext - Current page path
   * @param {string} locale - Current UI language
   * @param {object} options - { csrfToken, useStreaming }
   */
  sendMessage: async (text, pageContext, locale, options = {}) => {
    const trimmed = (text || '').trim();
    if (!trimmed || get().isLoading) return;

    const { csrfToken, useStreaming = true } = options;
    const userMessage = { role: 'user', content: trimmed, timestamp: new Date().toISOString() };

    set(state => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      isStreaming: false,
      streamingText: '',
      error: null
    }));

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        'X-Locale': locale || 'en'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

      const body = {
        message: trimmed,
        chat_id: get().conversationId,
        page_context: pageContext || '',
        language: locale || 'en',
        stream: useStreaming
      };

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const contentType = res.headers.get('content-type') || '';

      if (useStreaming && contentType.includes('text/event-stream')) {
        // === SSE Streaming Path ===
        set({ isStreaming: true });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';
        let finalChatId = null;
        let finalMessages = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimLine = line.trim();
              if (!trimLine || !trimLine.startsWith('data: ')) continue;

              try {
                const event = JSON.parse(trimLine.slice(6));

                if (event.type === 'chunk' && event.text) {
                  fullText += event.text;
                  set({ streamingText: fullText });
                } else if (event.type === 'done') {
                  finalChatId = event.chat_id;
                  finalMessages = event.messages;
                } else if (event.type === 'error') {
                  fullText = event.text || 'An error occurred';
                  set({ streamingText: fullText });
                }
              } catch (e) {
                // Skip unparseable events
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // Finalize: add assistant message and update conversationId
        const assistantMessage = {
          role: 'assistant',
          content: fullText,
          timestamp: new Date().toISOString()
        };

        set(state => {
          const newConvId = finalChatId || state.conversationId;
          if (newConvId) {
            try { localStorage.setItem(CONVERSATION_ID_KEY, String(newConvId)); } catch {}
          }
          return {
            messages: [...state.messages, assistantMessage],
            conversationId: newConvId,
            isLoading: false,
            isStreaming: false,
            streamingText: ''
          };
        });

      } else {
        // === Non-streaming JSON Path ===
        const data = await res.json();
        const assistantMessage = {
          role: 'assistant',
          content: data.response || data.reply || '',
          timestamp: new Date().toISOString()
        };

        set(state => {
          const newConvId = data.chat_id || state.conversationId;
          if (newConvId) {
            try { localStorage.setItem(CONVERSATION_ID_KEY, String(newConvId)); } catch {}
          }
          return {
            messages: [...state.messages, assistantMessage],
            conversationId: newConvId,
            isLoading: false
          };
        });
      }
    } catch (err) {
      const errorMessage = {
        role: 'assistant',
        content: `⚠️ ${err.message}`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      set(state => ({
        messages: [...state.messages, errorMessage],
        isLoading: false,
        isStreaming: false,
        streamingText: '',
        error: err.message
      }));
    }
  },

  /**
   * Load conversation history list.
   * @param {object} options - { csrfToken }
   */
  loadHistory: async (options = {}) => {
    if (get().historyLoading) return;
    set({ historyLoading: true });

    try {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (options.csrfToken) headers['X-CSRF-Token'] = options.csrfToken;

      const res = await fetch('/api/assistant/history', { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      set({
        conversationHistory: data.chats || [],
        historyTotal: data.total || 0,
        historyLoading: false
      });
    } catch (err) {
      set({ historyLoading: false });
      console.warn('[AssistantStore] Failed to load history:', err.message);
    }
  },

  /**
   * Select and load a specific conversation by ID.
   * @param {number} id - Conversation ID
   * @param {object} options - { csrfToken }
   */
  selectConversation: async (id, options = {}) => {
    if (!id) return;
    set({ isLoading: true, error: null });

    try {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (options.csrfToken) headers['X-CSRF-Token'] = options.csrfToken;

      const res = await fetch(`/api/assistant/history/${id}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const newConvId = data.id || id;
      try { localStorage.setItem(CONVERSATION_ID_KEY, String(newConvId)); } catch {}

      set({
        messages: data.messages || [],
        conversationId: newConvId,
        isLoading: false,
        error: null
      });
    } catch (err) {
      set({ isLoading: false, error: err.message });
      console.warn('[AssistantStore] Failed to load conversation:', err.message);
    }
  },

  /**
   * Start a new conversation - reset messages and conversationId.
   */
  newConversation: () => {
    try { localStorage.removeItem(CONVERSATION_ID_KEY); } catch {}
    set({
      messages: [],
      conversationId: null,
      isStreaming: false,
      streamingText: '',
      error: null
    });
  },

  /**
   * Delete a conversation (soft-delete).
   * @param {number} id - Conversation ID
   * @param {object} options - { csrfToken }
   */
  deleteConversation: async (id, options = {}) => {
    if (!id) return;

    try {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (options.csrfToken) headers['X-CSRF-Token'] = options.csrfToken;

      const res = await fetch(`/api/assistant/history/${id}`, {
        method: 'DELETE',
        headers
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Remove from history list
      set(state => ({
        conversationHistory: state.conversationHistory.filter(c => c.id !== id),
        historyTotal: Math.max(0, state.historyTotal - 1),
        // If we deleted the current conversation, clear it
        ...(state.conversationId === id ? {
          messages: [],
          conversationId: null,
          error: null
        } : {})
      }));

      // Clear localStorage if deleted current conversation
      if (get().conversationId === null) {
        try { localStorage.removeItem(CONVERSATION_ID_KEY); } catch {}
      }
    } catch (err) {
      console.warn('[AssistantStore] Failed to delete conversation:', err.message);
      throw err; // Re-throw so caller can handle
    }
  },

  /**
   * Clear error state
   */
  clearError: () => set({ error: null })
}));

export default useAssistantStore;
