import React, { createContext, useContext, useState, useCallback } from 'react';

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
 */
export function AssistantPanelProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const togglePanel = useCallback(() => {
    setIsOpen(prev => {
      if (!prev) {
        // Opening panel clears unread
        setHasUnread(false);
      }
      return !prev;
    });
  }, []);

  const openPanel = useCallback(() => {
    setIsOpen(true);
    setHasUnread(false);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
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
