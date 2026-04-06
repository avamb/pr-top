import React, { createContext, useContext, useState, useCallback } from 'react';

const PANEL_STATE_KEY = 'assistant_panel_open';

const AssistantPanelContext = createContext({
  isOpen: false,
  hasUnread: false,
  togglePanel: () => {},
  openPanel: () => {},
  closePanel: () => {},
  setHasUnread: () => {},
});

/**
 * Provider that manages assistant chat panel open/close state
 * and unread indicator. Wrap your app layout with this.
 * Persists open/closed state in localStorage.
 */
export function AssistantPanelProvider({ children }) {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return localStorage.getItem(PANEL_STATE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [hasUnread, setHasUnread] = useState(false);

  const togglePanel = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev;
      if (next) setHasUnread(false);
      try { localStorage.setItem(PANEL_STATE_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  }, []);

  const openPanel = useCallback(() => {
    setIsOpen(true);
    setHasUnread(false);
    try { localStorage.setItem(PANEL_STATE_KEY, '1'); } catch {}
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    try { localStorage.setItem(PANEL_STATE_KEY, '0'); } catch {}
  }, []);

  return (
    <AssistantPanelContext.Provider value={{ isOpen, hasUnread, togglePanel, openPanel, closePanel, setHasUnread }}>
      {children}
    </AssistantPanelContext.Provider>
  );
}

/**
 * Hook to access assistant panel state.
 * - Components use togglePanel/openPanel/closePanel to control visibility
 * - setHasUnread(true) to show the unread indicator dot on the FAB
 */
export function useAssistantPanel() {
  return useContext(AssistantPanelContext);
}
