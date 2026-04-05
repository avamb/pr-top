import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAssistantPanel } from '../contexts/AssistantPanelContext';

const INTRO_SEEN_KEY = 'assistant_intro_seen';

/**
 * Floating Action Button for the AI assistant chat.
 * Shows a chat icon at bottom-right, toggles the assistant side panel.
 * Displays unread indicator dot and pulse animation on first visit.
 */
export default function AssistantChatButton() {
  const { t } = useTranslation();
  const { isOpen, hasUnread, togglePanel } = useAssistantPanel();
  const [showPulse, setShowPulse] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Pulse animation on first visit
  useEffect(() => {
    const seen = localStorage.getItem(INTRO_SEEN_KEY);
    if (!seen) {
      setShowPulse(true);
      // Stop pulsing after 10 seconds
      const timer = setTimeout(() => {
        setShowPulse(false);
        localStorage.setItem(INTRO_SEEN_KEY, '1');
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClick = () => {
    // Mark intro as seen on first click
    if (showPulse) {
      setShowPulse(false);
      localStorage.setItem(INTRO_SEEN_KEY, '1');
    }
    togglePanel();
  };

  // Hide the FAB when the panel is open
  if (isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-800 text-white text-sm rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
          {t('dashboard.needHelp')}
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800" />
        </div>
      )}

      {/* Pulse ring animation */}
      {showPulse && (
        <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
      )}

      {/* Main FAB button */}
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="relative w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:bg-primary-600 hover:shadow-xl transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        aria-label={t('dashboard.needHelp')}
      >
        {/* Chat bubble icon */}
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>

        {/* Unread indicator dot */}
        {hasUnread && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full" />
        )}
      </button>
    </div>
  );
}
