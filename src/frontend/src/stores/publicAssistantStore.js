import { create } from 'zustand';

const SESSION_UUID_KEY = 'public_assistant_session_uuid';
const PANEL_STATE_KEY = 'public_assistant_panel_open';
const LEAD_EMAIL_KEY = 'public_assistant_lead_email';
const MAX_MESSAGES = 5;
const MAX_MESSAGES_LEAD = 15; // 5 base + 10 after email
const MAX_MESSAGES_VERIFIED = 25; // 5 base + 10 + 10 after verification

// Generate a UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Get or create session UUID from localStorage
function getSessionUUID() {
  try {
    let uuid = localStorage.getItem(SESSION_UUID_KEY);
    if (!uuid) {
      uuid = generateUUID();
      localStorage.setItem(SESSION_UUID_KEY, uuid);
    }
    return uuid;
  } catch {
    return generateUUID();
  }
}

/**
 * Zustand store for the public (anonymous) assistant chat on the landing page.
 * Limited to 5 messages per session. No auth required.
 */
const VIEWER_REGISTERED_KEY = 'public_assistant_viewer_registered';

function getViewerRegistered() {
  try {
    return localStorage.getItem(VIEWER_REGISTERED_KEY) === 'true';
  } catch {
    return false;
  }
}

function getLeadEmail() {
  try {
    return localStorage.getItem(LEAD_EMAIL_KEY) || null;
  } catch {
    return null;
  }
}

const usePublicAssistantStore = create((set, get) => ({
  // Panel state
  isOpen: false,

  // Chat state
  messages: [],
  messagesUsed: 0,
  messagesRemaining: MAX_MESSAGES,
  isLoading: false,
  isStreaming: false,
  streamingText: '',
  error: null,
  showCta: false,
  conversationId: null,
  sessionUUID: getSessionUUID(),
  isRegistered: getViewerRegistered(),
  leadEmail: getLeadEmail(),
  maxMessages: getViewerRegistered() ? MAX_MESSAGES_LEAD : MAX_MESSAGES,

  // Panel actions
  togglePanel: () => set(state => ({ isOpen: !state.isOpen })),
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),

  /**
   * Handle successful lead registration.
   * Keeps messagesUsed intact (backend tracks real count), but extends the limit.
   */
  registerLead: (data) => {
    try {
      localStorage.setItem(VIEWER_REGISTERED_KEY, 'true');
      if (data?.lead?.email) {
        localStorage.setItem(LEAD_EMAIL_KEY, data.lead.email);
      }
    } catch {}

    const currentUsed = get().messagesUsed;
    set({
      isRegistered: true,
      showCta: false,
      leadEmail: data?.lead?.email || null,
      maxMessages: MAX_MESSAGES_LEAD,
      messagesRemaining: MAX_MESSAGES_LEAD - currentUsed,
    });
  },

  // Kept for backward compat
  registerViewer: (data) => {
    get().registerLead(data);
  },

  /**
   * Send a message to the public assistant chat.
   */
  sendMessage: async (text, locale, options = {}) => {
    const trimmed = (text || '').trim();
    if (!trimmed || get().isLoading) return;

    const state = get();
    if (state.messagesUsed >= state.maxMessages) {
      set({ showCta: !state.isRegistered });
      return;
    }

    const { csrfToken, useStreaming = true } = options;
    const userMessage = { role: 'user', content: trimmed, timestamp: new Date().toISOString() };

    set(s => ({
      messages: [...s.messages, userMessage],
      isLoading: true,
      isStreaming: false,
      streamingText: '',
      error: null,
      showCta: false
    }));

    try {
      const headers = {
        'Content-Type': 'application/json',
        'X-Locale': locale || 'en'
      };
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

      const body = {
        message: trimmed,
        session_uuid: state.sessionUUID,
        language: locale || 'en',
        stream: useStreaming,
        conversation_id: state.conversationId
      };

      const res = await fetch('/api/assistant/public-chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      // Handle message limit reached
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error === 'message_limit_reached') {
          const isReg = get().isRegistered;
          set(s => ({
            showCta: !isReg && errData.show_cta !== false,
            messagesUsed: s.maxMessages,
            messagesRemaining: 0,
            isLoading: false
          }));
          // If registered lead hits limit, show message in chat
          if (isReg && errData.message) {
            set(s => ({
              messages: [...s.messages, {
                role: 'assistant',
                content: errData.message,
                timestamp: new Date().toISOString(),
                isError: true
              }]
            }));
          }
          return;
        }
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `HTTP ${res.status}`);
      }

      const contentType = res.headers.get('content-type') || '';

      if (useStreaming && contentType.includes('text/event-stream')) {
        set({ isStreaming: true });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';
        let finalConvId = null;
        let messagesRemaining = null;

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
                  finalConvId = event.conversation_id;
                  messagesRemaining = event.messages_remaining;
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

        const assistantMessage = {
          role: 'assistant',
          content: fullText,
          timestamp: new Date().toISOString()
        };

        const newUsed = get().messagesUsed + 1;
        const curMax = get().maxMessages;
        const remaining = messagesRemaining != null ? messagesRemaining : curMax - newUsed;

        set(s => ({
          messages: [...s.messages, assistantMessage],
          conversationId: finalConvId || s.conversationId,
          messagesUsed: newUsed,
          messagesRemaining: remaining,
          isLoading: false,
          isStreaming: false,
          streamingText: '',
          showCta: remaining <= 0 && !s.isRegistered
        }));

      } else {
        // Non-streaming JSON path
        const data = await res.json();
        const assistantMessage = {
          role: 'assistant',
          content: data.response || '',
          timestamp: new Date().toISOString()
        };

        const newUsed = get().messagesUsed + 1;
        const curMax = get().maxMessages;
        const remaining = data.messages_remaining != null ? data.messages_remaining : curMax - newUsed;

        set(s => ({
          messages: [...s.messages, assistantMessage],
          conversationId: data.conversation_id || s.conversationId,
          messagesUsed: newUsed,
          messagesRemaining: remaining,
          isLoading: false,
          showCta: remaining <= 0 && !s.isRegistered
        }));
      }
    } catch (err) {
      const errorMessage = {
        role: 'assistant',
        content: `Sorry, something went wrong. Please try again.`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      set(s => ({
        messages: [...s.messages, errorMessage],
        isLoading: false,
        isStreaming: false,
        streamingText: '',
        error: err.message
      }));
    }
  },

  clearError: () => set({ error: null })
}));

export default usePublicAssistantStore;
