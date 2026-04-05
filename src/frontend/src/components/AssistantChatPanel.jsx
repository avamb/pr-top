import React, { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import useAssistantStore from '../stores/assistantStore';
import { useCsrfToken } from '../hooks/useCsrfToken';

/**
 * Simple markdown-to-JSX renderer.
 * Supports: **bold**, *italic*, `code`, ```code blocks```, numbered/bullet lists, [links](url)
 */
function renderMarkdown(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trim().startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={elements.length} className="bg-gray-800 text-gray-100 rounded-md p-3 my-2 text-sm overflow-x-auto whitespace-pre-wrap">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Heading (## or ###)
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const cls = level === 1 ? 'text-base font-bold mt-3 mb-1' : level === 2 ? 'text-sm font-bold mt-2 mb-1' : 'text-sm font-semibold mt-2 mb-1';
      elements.push(<div key={elements.length} className={cls}>{renderInline(headingMatch[2])}</div>);
      i++;
      continue;
    }

    // Numbered list item
    const numMatch = line.match(/^\s*(\d+)\.\s+(.+)/);
    if (numMatch) {
      const listItems = [<li key={0}>{renderInline(numMatch[2])}</li>];
      i++;
      while (i < lines.length) {
        const nextNum = lines[i].match(/^\s*(\d+)\.\s+(.+)/);
        if (!nextNum) break;
        listItems.push(<li key={listItems.length}>{renderInline(nextNum[2])}</li>);
        i++;
      }
      elements.push(<ol key={elements.length} className="list-decimal ml-5 my-1 space-y-0.5 text-sm">{listItems}</ol>);
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)/);
    if (bulletMatch) {
      const listItems = [<li key={0}>{renderInline(bulletMatch[1])}</li>];
      i++;
      while (i < lines.length) {
        const nextBullet = lines[i].match(/^\s*[-*]\s+(.+)/);
        if (!nextBullet) break;
        listItems.push(<li key={listItems.length}>{renderInline(nextBullet[1])}</li>);
        i++;
      }
      elements.push(<ul key={elements.length} className="list-disc ml-5 my-1 space-y-0.5 text-sm">{listItems}</ul>);
      continue;
    }

    // Regular paragraph
    elements.push(<p key={elements.length} className="my-1 text-sm">{renderInline(line)}</p>);
    i++;
  }

  return elements;
}

/** Render inline markdown: **bold**, *italic*, `code`, [links](url) */
function renderInline(text) {
  if (!text) return text;
  const parts = [];
  // Regex: bold, italic, code, links
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      // bold
      parts.push(<strong key={parts.length}>{match[2]}</strong>);
    } else if (match[3]) {
      // italic
      parts.push(<em key={parts.length}>{match[4]}</em>);
    } else if (match[5]) {
      // code
      parts.push(<code key={parts.length} className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono">{match[6]}</code>);
    } else if (match[7]) {
      // link
      parts.push(<a key={parts.length} href={match[9]} className="text-primary underline" target="_blank" rel="noopener noreferrer">{match[8]}</a>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}

/**
 * Typing indicator - animated dots
 */
function TypingIndicator() {
  return (
    <div className="flex items-center space-x-1 px-4 py-3">
      <div className="flex items-end space-x-1">
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Streaming message display - shows the assistant's response as it streams in
 */
function StreamingMessage({ text }) {
  if (!text) return null;
  return (
    <div className="flex justify-start">
      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-gray-100 text-gray-800 rounded-bl-sm">
        <div className="assistant-message">
          {renderMarkdown(text)}
          <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom" />
        </div>
      </div>
    </div>
  );
}

/**
 * AssistantChatPanel - Slide-in side panel for AI assistant chat.
 * Uses Zustand store for state management and SSE streaming.
 */
/**
 * Conversation History List - Shows past conversations with titles and previews
 */
function ConversationHistoryList({ onSelect, onDelete, onNewChat, conversations, isLoading, t }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 space-y-3 px-6">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
          </svg>
        </div>
        <p className="text-sm text-gray-500">{t('assistant.noHistory', 'No conversations yet')}</p>
        <button
          onClick={onNewChat}
          className="text-sm text-primary hover:text-primary-600 font-medium"
        >
          {t('assistant.startFirst', 'Start your first conversation')}
        </button>
      </div>
    );
  }

  // Group conversations by date
  const grouped = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  for (const chat of conversations) {
    const chatDate = new Date(chat.updated_at);
    let group;
    if (chatDate >= today) group = t('assistant.today', 'Today');
    else if (chatDate >= yesterday) group = t('assistant.yesterday', 'Yesterday');
    else if (chatDate >= weekAgo) group = t('assistant.thisWeek', 'This week');
    else group = t('assistant.older', 'Older');

    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(chat);
  }

  return (
    <div className="space-y-1">
      {Object.entries(grouped).map(([group, chats]) => (
        <div key={group}>
          <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {group}
          </div>
          {chats.map(chat => (
            <div
              key={chat.id}
              className="group flex items-center px-3 py-2.5 hover:bg-gray-100 rounded-lg mx-1 cursor-pointer transition-colors"
              onClick={() => onSelect(chat.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {chat.title || 'New conversation'}
                </div>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="text-xs text-gray-400">
                    {new Date(chat.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">
                    {chat.message_count} {t('assistant.msgs', 'msgs')}
                  </span>
                  {chat.archived && (
                    <>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-amber-500">{t('assistant.archived', 'archived')}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(chat.id); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                title={t('assistant.deleteChat', 'Delete')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function AssistantChatPanel() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const csrfToken = useCsrfToken();

  // Zustand store
  const isOpen = useAssistantStore(s => s.isOpen);
  const closePanel = useAssistantStore(s => s.closePanel);
  const messages = useAssistantStore(s => s.messages);
  const isLoading = useAssistantStore(s => s.isLoading);
  const isStreaming = useAssistantStore(s => s.isStreaming);
  const streamingText = useAssistantStore(s => s.streamingText);
  const error = useAssistantStore(s => s.error);
  const sendMessage = useAssistantStore(s => s.sendMessage);
  const newConversation = useAssistantStore(s => s.newConversation);
  const clearError = useAssistantStore(s => s.clearError);
  const showHistory = useAssistantStore(s => s.showHistory);
  const toggleHistory = useAssistantStore(s => s.toggleHistory);
  const conversationHistory = useAssistantStore(s => s.conversationHistory);
  const historyLoading = useAssistantStore(s => s.historyLoading);
  const loadHistory = useAssistantStore(s => s.loadHistory);
  const selectConversation = useAssistantStore(s => s.selectConversation);
  const deleteConversation = useAssistantStore(s => s.deleteConversation);

  const [input, setInput] = React.useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, streamingText]);

  // Focus input when panel opens (and not in history view)
  useEffect(() => {
    if (isOpen && !showHistory && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, showHistory]);

  // Load history when switching to history view
  useEffect(() => {
    if (showHistory && isOpen) {
      loadHistory({ csrfToken });
    }
  }, [showHistory, isOpen, loadHistory, csrfToken]);

  const handleNewChat = useCallback(() => {
    newConversation();
    setInput('');
    clearError();
  }, [newConversation, clearError]);

  const handleSelectConversation = useCallback((id) => {
    selectConversation(id, { csrfToken });
  }, [selectConversation, csrfToken]);

  const handleDeleteConversation = useCallback(async (id) => {
    if (!window.confirm(t('assistant.deleteConfirm', 'Are you sure you want to delete this chat?'))) return;
    try {
      await deleteConversation(id, { csrfToken });
    } catch (err) {
      // Error already handled in store
    }
  }, [deleteConversation, csrfToken, t]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput('');
    await sendMessage(trimmed, location.pathname, i18n.language || 'en', {
      csrfToken,
      useStreaming: true
    });
  }, [input, isLoading, sendMessage, location.pathname, i18n.language, csrfToken]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={closePanel}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full z-50 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out w-full sm:w-[400px] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <h2 className="font-semibold text-gray-800">{t('assistant.title', 'Assistant')}</h2>
          </div>
          <div className="flex items-center space-x-1">
            {/* History button */}
            <button
              onClick={toggleHistory}
              className={`p-2 rounded-lg transition-colors ${showHistory ? 'text-primary bg-primary/10' : 'text-gray-500 hover:bg-gray-200'}`}
              title={t('assistant.history', 'Chat history')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {/* New chat button */}
            <button
              onClick={handleNewChat}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 transition-colors"
              title={t('assistant.newChat', 'New chat')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </button>
            {/* Close button */}
            <button
              onClick={closePanel}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden relative">
          {/* History view */}
          {showHistory ? (
          <div className="h-full overflow-y-auto py-2 transition-opacity duration-200">
            <ConversationHistoryList
              conversations={conversationHistory}
              isLoading={historyLoading}
              onSelect={handleSelectConversation}
              onDelete={handleDeleteConversation}
              onNewChat={handleNewChat}
              t={t}
            />
          </div>
          ) : (
          /* Chat view */
          <div className="h-full overflow-y-auto px-4 py-4 space-y-4 transition-opacity duration-200">
            {messages.length === 0 && !isLoading && !isStreaming && (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 space-y-3 px-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600">{t('assistant.welcome', 'How can I help you?')}</p>
                <p className="text-xs text-gray-400">{t('assistant.hint', 'Ask me about using PR-TOP — navigation, features, workflows, and more.')}</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                    <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-br-sm'
                      : msg.isError
                      ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="assistant-message">{renderMarkdown(msg.content)}</div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming response */}
            {isStreaming && streamingText && (
              <StreamingMessage text={streamingText} />
            )}

            {/* Loading indicator (shown when waiting for first token) */}
            {isLoading && !isStreaming && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>
          )}
        </div>

        {/* Input area - hidden when showing history */}
        {!showHistory && (
          <div className="border-t border-gray-200 px-4 py-3 bg-white flex-shrink-0">
            {error && (
              <div className="text-xs text-red-500 mb-2">{error}</div>
            )}
            <div className="flex items-end space-x-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('assistant.placeholder', 'Type your question...')}
                disabled={isLoading}
                rows={1}
                className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 max-h-32"
                style={{ minHeight: '42px' }}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
