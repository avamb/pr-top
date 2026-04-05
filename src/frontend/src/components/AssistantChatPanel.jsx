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

  const [input, setInput] = React.useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, streamingText]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleNewChat = useCallback(() => {
    newConversation();
    setInput('');
    clearError();
  }, [newConversation, clearError]);

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

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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

        {/* Input area */}
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
      </div>
    </>
  );
}
