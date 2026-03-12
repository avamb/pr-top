import React, { createContext, useContext, useState, useCallback } from 'react';

const UnsavedChangesContext = createContext({
  hasUnsavedChanges: false,
  setHasUnsavedChanges: () => {},
  confirmNavigation: () => true,
});

/**
 * Provider that tracks unsaved changes and provides a confirmation
 * check for SPA navigation. Wrap your app layout with this.
 */
export function UnsavedChangesProvider({ children }) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const confirmNavigation = useCallback(() => {
    if (!hasUnsavedChanges) return true;
    return window.confirm('You have unsaved changes. Are you sure you want to leave?');
  }, [hasUnsavedChanges]);

  return (
    <UnsavedChangesContext.Provider value={{ hasUnsavedChanges, setHasUnsavedChanges, confirmNavigation }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

/**
 * Hook to access unsaved changes context.
 * - Pages use setHasUnsavedChanges(true/false) to flag dirty state
 * - Navigation components call confirmNavigation() before navigating
 */
export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext);
}
