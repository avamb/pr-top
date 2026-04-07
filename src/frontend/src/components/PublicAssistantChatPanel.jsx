import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import usePublicAssistantStore from '../stores/publicAssistantStore';
import { useCsrfToken } from '../hooks/useCsrfToken';

/**
 * Simple markdown-to-JSX renderer (same as in AssistantChatPanel).
 */
function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      elements.push(
        <pre key={elements.length} className="bg-gray-800 text-gray-100 rounded-md p-3 my-2 text-sm overflow-x-auto whitespace-pre-wrap">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }
    if (line.trim() === '') { i++; continue; }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const cls = level === 1 ? 'text-base font-bold mt-3 mb-1' : 'text-sm font-bold mt-2 mb-1';
      elements.push(<div key={elements.length} className={cls}>{renderInline(headingMatch[2])}</div>);
      i++;
      continue;
    }

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

    elements.push(<p key={elements.length} className="my-1 text-sm">{renderInline(line)}</p>);
    i++;
  }
  return elements;
}

function renderInline(text) {
  if (!text) return text;
  const parts = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1]) parts.push(<strong key={parts.length}>{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={parts.length}>{match[4]}</em>);
    else if (match[5]) parts.push(<code key={parts.length} className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono">{match[6]}</code>);
    else if (match[7]) parts.push(<a key={parts.length} href={match[9]} className="text-primary underline" target="_blank" rel="noopener noreferrer">{match[8]}</a>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}

function TypingIndicator() {
  return (
    <div className="flex items-center space-x-1 px-4 py-3">
      <div className="flex items-end space-x-1">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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

function StreamingMessage({ text }) {
  if (!text) return null;
  return (
    <div className="flex justify-start">
      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
 * CTA component shown after 5 messages are used.
 */
function RegisterCTA({ t }) {
  return (
    <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 border-t border-primary/20">
      <div className="text-center">
        <div className="text-2xl mb-2">&#x1F4AC;</div>
        <p className="text-sm font-semibold text-text mb-1">
          {t('publicChat.ctaTitle', 'Want to continue the conversation?')}
        </p>
        <p className="text-xs text-secondary mb-3">
          {t('publicChat.ctaDesc', 'Register for a free 14-day trial to get unlimited access to our AI assistant and all platform features.')}
        </p>
        <Link
          to="/register"
          className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary-600 transition-colors shadow-md shadow-primary/20"
        >
          {t('publicChat.ctaButton', 'Start Free Trial')}
        </Link>
        <p className="text-xs text-secondary mt-2">
          {t('publicChat.ctaNoCard', 'No credit card required')}
        </p>
      </div>
    </div>
  );
}

/**
 * Public assistant chat panel for landing page visitors.
 * Limited to 5 messages per session, no auth required.
 */
export default function PublicAssistantChatPanel() {
  const { t, i18n } = useTranslation();
  const csrfToken = useCsrfToken();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [inputText, setInputText] = useState('');

  const isOpen = usePublicAssistantStore(s => s.isOpen);
  const messages = usePublicAssistantStore(s => s.messages);
  const isLoading = usePublicAssistantStore(s => s.isLoading);
  const isStreaming = usePublicAssistantStore(s => s.isStreaming);
  const streamingText = usePublicAssistantStore(s => s.streamingText);
  const showCta = usePublicAssistantStore(s => s.showCta);
  const messagesRemaining = usePublicAssistantStore(s => s.messagesRemaining);
  const messagesUsed = usePublicAssistantStore(s => s.messagesUsed);
  const closePanel = usePublicAssistantStore(s => s.closePanel);
  const sendMessage = usePublicAssistantStore(s => s.sendMessage);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, showCta]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!inputText.trim() || isLoading) return;
    sendMessage(inputText, i18n.language, { csrfToken, useStreaming: true });
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 sm:hidden"
        onClick={closePanel}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 w-full sm:w-[400px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-white">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <h3 className="font-semibold text-sm">
              {t('publicChat.title', 'Ask about PR-TOP')}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {/* Messages remaining indicator */}
            <span className="text-xs text-white/70">
              {messagesUsed}/{5}
            </span>
            <button
              onClick={closePanel}
              className="p-1 rounded hover:bg-white/20 transition-colors"
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
          {/* Welcome message */}
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <h4 className="font-semibold text-text mb-2">
                {t('publicChat.welcomeTitle', 'Hi! I\'m the PR-TOP assistant')}
              </h4>
              <p className="text-sm text-secondary mb-4">
                {t('publicChat.welcomeDesc', 'Ask me anything about our therapist platform. I can help with features, pricing, security, and more.')}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  t('publicChat.suggestion1', 'What is PR-TOP?'),
                  t('publicChat.suggestion2', 'How secure is client data?'),
                  t('publicChat.suggestion3', 'What are the pricing plans?'),
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInputText(suggestion);
                      setTimeout(() => {
                        sendMessage(suggestion, i18n.language, { csrfToken, useStreaming: true });
                        setInputText('');
                      }, 50);
                    }}
                    className="text-xs px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <p className="text-xs text-secondary mt-4">
                {t('publicChat.freeMessages', 'You have {{count}} free messages', { count: 5 })}
              </p>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-sm'
                  : msg.isError
                    ? 'bg-red-50 text-red-700 rounded-bl-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="assistant-message">{renderMarkdown(msg.content)}</div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Streaming message */}
          {isStreaming && streamingText && <StreamingMessage text={streamingText} />}

          {/* Typing indicator */}
          {isLoading && !isStreaming && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* CTA or Input */}
        {showCta ? (
          <RegisterCTA t={t} />
        ) : (
          <div className="border-t p-3">
            {/* Messages remaining bar */}
            {messagesUsed > 0 && (
              <div className="mb-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-secondary">
                    {t('publicChat.messagesLeft', '{{count}} messages remaining', { count: messagesRemaining })}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div
                    className={`h-1 rounded-full transition-all duration-300 ${messagesRemaining <= 1 ? 'bg-red-500' : messagesRemaining <= 2 ? 'bg-amber-500' : 'bg-primary'}`}
                    style={{ width: `${(messagesRemaining / 5) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('publicChat.placeholder', 'Ask a question...')}
                className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary max-h-32"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !inputText.trim()}
                className="p-2.5 rounded-xl bg-primary text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                aria-label={t('publicChat.send', 'Send')}
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
